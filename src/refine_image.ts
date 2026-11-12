import type { RefinementRun, SavedAnalysis } from "./analysis_types.js";
import { chooseRepresentative } from "./choose_representative.js";
import type { createDetectorClient, pixels } from "./detector_client.js";
import { comparisonDesign, type DesignPoint, type DetectorSettings } from "./experiment_design.js";

export async function refineImage(
  client: ReturnType<typeof createDetectorClient>,
  id: number,
  image: Awaited<ReturnType<typeof pixels>>,
  initial: Pick<DetectorSettings, "diameter" | "k">,
  runCount: number,
  hooks: {
    stopped: () => boolean;
    onStart: (candidates: DesignPoint[], starting: DetectorSettings) => void;
    onRun: (runs: RefinementRun[], completed: number, total: number) => void;
  },
): Promise<{ centers: Float32Array; analysis: SavedAnalysis }> {
  function checkStopped(): void {
    if (hooks.stopped()) throw new Error("Refinement cancelled.");
  }

  checkStopped();
  const seed = await client.processAutomatic(id, image.rgba, image.width, image.height, initial);
  checkStopped();
  if (!seed.ok) throw new Error(seed.error);
  if (seed.analysis.noSignal) return { centers: seed.centers, analysis: seed.analysis };

  const startingSettings = { ...seed.analysis.settings };
  const candidates = comparisonDesign(startingSettings, runCount);
  const runs: RefinementRun[] = [];
  hooks.onStart(candidates, startingSettings);
  for (const [index, candidate] of candidates.entries()) {
    checkStopped();
    const settings = {
      diameter: candidate.diameter,
      k: candidate.k,
      threshold: candidate.threshold,
    };
    const started = performance.now();
    let run: RefinementRun;
    try {
      const reply = await client.process(
        id + 1 + index,
        undefined,
        image.width,
        image.height,
        settings,
      );
      checkStopped();
      if (!reply.ok) throw new Error(reply.error);
      run = {
        settings,
        kind: candidate.kind,
        count: reply.centers.length / 2,
        elapsed: performance.now() - started,
      };
    } catch (error: unknown) {
      checkStopped();
      run = {
        settings,
        kind: candidate.kind,
        elapsed: performance.now() - started,
        error: error instanceof Error ? error.message : "Refinement run failed.",
      };
    }
    runs.push(run);
    hooks.onRun(runs, runs.length, candidates.length);
  }

  checkStopped();
  const successful = runs.flatMap((run, index) =>
    run.count === undefined ? [] : [{ ...run.settings, count: run.count, index }],
  );
  if (successful.length === 0) throw new Error("No refinement settings completed successfully.");
  const selected = successful[chooseRepresentative(successful)]!;
  // Recompute one result rather than retaining every trial's center array.
  const final = await client.process(
    id + 1 + candidates.length,
    undefined,
    image.width,
    image.height,
    selected,
  );
  checkStopped();
  if (!final.ok) throw new Error(final.error);

  const counts = successful.map((run) => run.count);
  const reviewReasons = ["provisional_refinement"];
  if (Math.max(...counts) - Math.min(...counts) > selected.count * 0.1) {
    reviewReasons.push("refinement_sensitive");
  }
  const analysis: SavedAnalysis = {
    settings: {
      diameter: selected.diameter,
      k: selected.k,
      threshold: Math.fround(selected.threshold),
    },
    mode: "automatic",
    method: "dog_ccd_median",
    version: "dog-refinement-1",
    reviewReasons,
    noSignal: false,
    refinement: {
      startingSettings,
      seedMethod: seed.analysis.method,
      requestedRuns: runCount,
      runs: runs.map((run) => ({ ...run, settings: { ...run.settings } })),
      representativeIndex: selected.index,
      selectedIndex: selected.index,
    },
  };
  return { centers: final.centers, analysis };
}
