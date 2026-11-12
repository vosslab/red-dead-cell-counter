import { elements } from "./counter_elements.js";
import type { DetectorSettings } from "./experiment_design.js";
import { processedSettings, settingsValidationMessage, validate } from "./detector_settings.js";
import { countStatistics, countStatisticsText, formatCount } from "./count_statistics.js";
import { createDetectorClient, pixels } from "./detector_client.js";
import { createImageWorkspace, type ImageResult, type ImageSelection } from "./image_workspace.js";
import type { SavedAnalysis } from "./analysis_types.js";
import { refineImage } from "./refine_image.js";
import {
  createComparisonPanel,
  type Comparison,
  type ComparisonState,
} from "./comparison_panel.js";

type CounterController = {
  choose: () => Promise<void>;
  tryExample: () => Promise<void>;
  analyze: () => Promise<void>;
  analyzeSelected: () => Promise<void>;
  compareSettings: () => Promise<boolean>;
  cancel: () => void;
  redraw: () => void;
  settingsChanged: () => void;
  inspectApplied: () => void;
  download: () => void;
};

type QueueMode = "allrefine" | "selectedrefine" | "manual";

export function createCounterController(): CounterController {
  const selection: ImageSelection = { results: [], selected: 0 };
  const comparison: ComparisonState = { runs: [] };
  let active = false;
  let stopped = false;
  let previewPending = 0;
  const client = createDetectorClient();
  const workspace = createImageWorkspace(selection, {
    isActive: () => active || previewPending > 0,
    isBatch: () => selection.results.length > 1,
    onPreviewBusy(busy) {
      previewPending += busy ? 1 : -1;
      updateControls();
      workspace.render();
      panel.render();
    },
    onSelect(index) {
      selection.selected = index;
      restoreComparison();
    },
    setStatus,
  });
  const panel = createComparisonPanel(comparison, {
    isActive: () => active || previewPending > 0,
    onApply: applyComparisonResult,
  });

  function manualAnalysis(input: DetectorSettings): SavedAnalysis {
    return {
      settings: { ...input, threshold: Math.fround(input.threshold) },
      mode: "manual",
      method: "manual",
      version: "dog-picker-1",
      reviewReasons: [],
      noSignal: false,
    };
  }

  function writeSettings(input: Readonly<DetectorSettings>): void {
    elements.diameter.value = input.diameter.toFixed(2);
    elements.k.value = input.k.toFixed(2);
    elements.threshold.value = input.threshold.toFixed(5);
  }

  function clearComparison(message: string): void {
    comparison.runs = [];
    comparison.recommended = undefined;
    comparison.applied = undefined;
    comparison.file = undefined;
    panel.clear(message);
    panel.render();
  }

  function restoreComparison(): void {
    const result = selection.results[selection.selected];
    const refinement = result?.analysis?.refinement;
    if (result && refinement) {
      panel.restore(refinement, result.file);
      panel.applied(result);
    } else {
      clearComparison(
        result?.analysis?.noSignal
          ? `No usable signal in ${result.file.name}; the saved count is zero. No refinement trials were needed.`
          : "Refine this image to compare settings and see count statistics.",
      );
    }
  }

  function setStatus(message: string): void {
    elements.status.textContent = message;
  }

  async function measureFinalAnalysis(
    analysis: SavedAnalysis,
    centers: Float32Array,
    width: number,
    height: number,
    id: number,
  ): Promise<SavedAnalysis> {
    const reply = await client.processMeasurements(id, width, height, analysis.settings, centers);
    if (!reply.ok) throw new Error(reply.error);
    return { ...analysis, morphology: reply.morphology };
  }

  async function applyComparisonResult(run: Comparison): Promise<void> {
    const result = selection.results[selection.selected];
    const refinement = result?.analysis?.refinement;
    const selectedIndex = refinement?.runs.indexOf(run) ?? -1;
    if (
      active ||
      previewPending > 0 ||
      !result ||
      !refinement ||
      comparison.file !== result.file ||
      selectedIndex < 0 ||
      run.error !== undefined ||
      run.count === undefined ||
      !validate(run.settings)
    )
      return;
    stopped = false;
    setRunning(true);
    try {
      client.start();
      const image = await pixels(result.file);
      if (stopped) return;
      const reply = await client.process(
        selection.selected,
        image.rgba,
        image.width,
        image.height,
        run.settings,
      );
      if (stopped) return;
      if (!reply.ok) throw new Error(reply.error);
      setStatus(`Measuring objects in ${result.file.name}.`);
      const analysis = await measureFinalAnalysis(
        {
          ...manualAnalysis(run.settings),
          refinement: { ...refinement, selectedIndex },
        },
        reply.centers,
        image.width,
        image.height,
        selection.selected,
      );
      if (stopped) return;
      result.width = image.width;
      result.height = image.height;
      result.centers = reply.centers;
      result.analysis = analysis;
      result.error = undefined;
      result.status = "completed";
      writeSettings(result.analysis.settings);
      workspace.invalidate();
      setStatus(`Applied manual refinement settings to ${result.file.name}.`);
    } catch (error: unknown) {
      result.status = stopped ? "cancelled" : "failed";
      if (!stopped)
        result.error =
          error instanceof Error ? error.message : "Could not apply refinement settings.";
      setStatus(
        stopped
          ? "Applying refinement settings cancelled. Previous count retained."
          : error instanceof Error
            ? error.message
            : "Could not apply refinement settings.",
      );
    } finally {
      client.finish();
      if (stopped) result.status = "cancelled";
      restoreComparison();
      panel.end();
      workspace.render();
      await workspace.showPreview(result);
      setRunning(false);
    }
  }

  function updateControls(): void {
    const busy = active || previewPending > 0;
    for (const control of [
      elements.images,
      elements.chooseImages,
      elements.chooseMoreImages,
      elements.tryExample,
      elements.diameter,
      elements.k,
      elements.threshold,
      elements.comparisonRuns,
    ])
      control.disabled = busy;
    for (const control of [elements.analyze, elements.analyzeSelected, elements.compare])
      control.disabled = busy || selection.results.length === 0;
    elements.download.disabled = !selection.results.some(
      (result) => result.analysis || result.status === "failed" || result.status === "cancelled",
    );
  }

  function setRunning(running: boolean, cancellable = true): void {
    active = running;
    updateControls();
    elements.cancel.disabled = !running || !cancellable || stopped;
    elements.cancel.hidden = !running || !cancellable;
    workspace.setBusy(running);
    workspace.render();
    panel.render();
  }

  async function analyze(): Promise<void> {
    await runQueue("allrefine");
  }

  async function analyzeSelected(): Promise<void> {
    await runQueue("manual");
  }

  async function compareSettings(): Promise<boolean> {
    return runQueue("selectedrefine");
  }

  async function runQueue(mode: QueueMode): Promise<boolean> {
    if (active || previewPending > 0) return false;
    if (selection.results.length === 0) {
      setStatus("Choose one or more images first.");
      return false;
    }
    const refine = mode !== "manual";
    // Capture starting controls once: each image must start from the same diameter and k.
    const requested = { diameter: Number(elements.diameter.value), k: Number(elements.k.value) };
    const initial = {
      diameter: Number(requested.diameter.toFixed(2)),
      k: Number(requested.k.toFixed(2)),
    };
    const manualInput = refine ? undefined : processedSettings();
    const validInitial =
      Number.isFinite(requested.diameter) &&
      requested.diameter >= 2 &&
      requested.diameter <= 200 &&
      Number.isFinite(requested.k) &&
      requested.k >= 1.1 &&
      requested.k <= 8;
    if (refine ? !validInitial : !validate(manualInput)) {
      setStatus(
        refine ? "Use a cell diameter of 2-200 px and k of 1.1-8." : settingsValidationMessage(),
      );
      return false;
    }
    const runCount = Number(elements.comparisonRuns.value);
    if (refine && (!Number.isInteger(runCount) || runCount < 15 || runCount > 100)) {
      const message = "Choose a whole number of refinement runs from 15 through 100.";
      panel.status(message);
      setStatus(message);
      return false;
    }
    if (refine) {
      elements.diameter.value = initial.diameter.toFixed(2);
      elements.k.value = initial.k.toFixed(2);
    }
    const indices =
      mode === "allrefine" ? selection.results.map((_, index) => index) : [selection.selected];
    const targets = indices.map((index) => selection.results[index]!);
    for (const result of targets) {
      result.status = "waiting";
      result.error = undefined;
    }
    stopped = false;
    setRunning(true);
    const scope =
      mode === "allrefine"
        ? "Automatic refinement"
        : refine
          ? "Selected image refinement"
          : "Selected image manual counting";
    try {
      client.start();
      for (let position = 0; position < indices.length && !stopped; position += 1) {
        const index = indices[position]!;
        const result = selection.results[index]!;
        if (selection.selected !== index) workspace.clear();
        selection.selected = index;
        clearComparison(
          `Preparing ${result.file.name}. Previous saved trials are retained until refinement finishes.`,
        );
        result.status = "working";
        const imageProgress = `${scope}: image ${position + 1} of ${indices.length}, ${result.file.name}`;
        setStatus(
          `${imageProgress}. ${refine ? "Finding this image's starting threshold." : "Using manual settings."}`,
        );
        workspace.render();
        const started = performance.now();
        try {
          const image = await pixels(result.file);
          if (stopped) break;
          let centers: Float32Array;
          let analysis: SavedAnalysis;
          if (refine) {
            const reply = await refineImage(client, index * 1_000, image, initial, runCount, {
              stopped: () => stopped,
              onStart(candidates, starting) {
                comparison.runs = [];
                comparison.file = result.file;
                panel.start(candidates, starting, result.file);
                const message = `${imageProgress}. Trial 1 of ${formatCount(candidates.length)}.`;
                panel.status(message);
                setStatus(message);
              },
              onRun(runs, completed, total) {
                comparison.runs = [...runs];
                panel.render();
                panel.progress(completed, total);
                const message = `${imageProgress}. ${formatCount(completed)} of ${formatCount(total)} trials complete.${completed < total ? ` Running trial ${formatCount(completed + 1)} of ${formatCount(total)}.` : " Applying the representative median setting."}${panel.timing(completed, total, started)}`;
                panel.status(message);
                setStatus(message);
              },
            });
            centers = reply.centers;
            analysis = reply.analysis;
          } else {
            const reply = await client.process(
              index,
              image.rgba,
              image.width,
              image.height,
              manualInput!,
            );
            if (!reply.ok) throw new Error(reply.error);
            centers = reply.centers;
            analysis = manualAnalysis(manualInput!);
          }
          if (stopped) break;
          setStatus(`${imageProgress}. Measuring objects.`);
          analysis = await measureFinalAnalysis(
            analysis,
            centers,
            image.width,
            image.height,
            index,
          );
          if (stopped) break;
          result.width = image.width;
          result.height = image.height;
          result.centers = centers;
          result.analysis = analysis;
          result.status = "completed";
          result.error = undefined;
          if (refine) elements.threshold.value = analysis.settings.threshold.toFixed(5);
          else writeSettings(analysis.settings);
          workspace.invalidate();
          restoreComparison();
          if (analysis.refinement) panel.finish(performance.now() - started);
          panel.applied(result);
          workspace.render();
          updateControls();
          await workspace.showPreview(result);
        } catch (error: unknown) {
          if (stopped) break;
          result.error = error instanceof Error ? error.message : "Image processing failed.";
          result.status = "failed";
          workspace.render();
        }
      }
    } catch (error: unknown) {
      if (!stopped)
        for (const result of targets) {
          if (result.status === "waiting" || result.status === "working") {
            result.status = "failed";
            result.error = error instanceof Error ? error.message : "Counting could not start.";
          }
        }
    } finally {
      client.finish();
      if (stopped)
        for (const result of targets)
          if (result.status === "waiting" || result.status === "working")
            result.status = "cancelled";
      const selected = selection.results[selection.selected];
      if (
        stopped &&
        comparison.file === selected?.file &&
        comparison.runs.length > 0 &&
        !selected?.analysis?.refinement
      ) {
        panel.cancelled(runCount);
      } else {
        restoreComparison();
      }
      panel.end();
      workspace.render();
      if (selected) await workspace.showPreview(selected);
      setRunning(false);
      const completed = targets.filter((result) => result.status === "completed").length;
      const failed = targets.filter((result) => result.status === "failed").length;
      const cancelled = targets.filter((result) => result.status === "cancelled").length;
      const statistics = countStatistics(
        selected?.analysis?.refinement?.runs.flatMap((run) =>
          run.count === undefined || run.error !== undefined ? [] : [run.count],
        ) ?? [],
      );
      setStatus(
        `${scope} ${stopped ? "cancelled" : "finished"}: ${completed} counted, ${failed} failed${cancelled ? `, ${cancelled} cancelled` : ""}. ${stopped || failed ? "Completed and previously saved results are retained." : "Inspect detection markers before using the counts."}${statistics ? ` ${selected!.file.name}: ${countStatisticsText(statistics)}` : ""}`,
      );
      (mode === "allrefine"
        ? elements.analyze
        : refine
          ? elements.compare
          : elements.analyzeSelected
      ).focus({ preventScroll: true });
    }
    return !stopped && targets.every((result) => result.status === "completed");
  }

  async function choose(): Promise<void> {
    if (active || previewPending > 0) return;
    const files = Array.from(elements.images.files ?? []);
    if (files.length === 0) return;
    elements.images.value = "";
    await selectFiles(files);
  }

  async function selectFiles(files: File[]): Promise<void> {
    workspace.clear();
    selection.results = files.map(function makeResult(file: File): ImageResult {
      return { file, width: 0, height: 0, status: "waiting" };
    });
    selection.selected = 0;
    clearComparison("Refine an image to compare settings and see count statistics.");
    elements.gate.hidden = true;
    elements.counter.hidden = false;
    elements.counter.dataset.workflow = files.length > 1 ? "batch" : "single";
    document.querySelector<HTMLElement>("#workflow-help")!.textContent =
      files.length > 1
        ? `Batch: ${files.length} images. Refine and count tests settings for each image independently.`
        : "Single image. Refine and count tests settings using this image's pixels.";
    elements.counterTitle.focus();
    workspace.render();
    updateControls();
    setStatus(
      `${files.length} image${files.length === 1 ? "" : "s"} selected. Select Refine and count to count ${files.length === 1 ? "this image" : "each image independently"}.`,
    );
    const first = selection.results[0];
    if (first) await workspace.showPreview(first);
  }

  async function tryExample(): Promise<void> {
    if (active || previewPending > 0) return;
    stopped = false;
    setRunning(true, false);
    elements.exampleStatus.textContent = "Loading the example image...";
    try {
      const response = await fetch(new URL("assets/example_a501.jpg", document.baseURI));
      if (!response.ok) throw new Error(`Example image download failed (${response.status}).`);
      const blob = await response.blob();
      await selectFiles([new File([blob], "A501.jpg", { type: "image/jpeg" })]);
      elements.exampleStatus.textContent = "";
    } catch (error: unknown) {
      const message = `${error instanceof Error ? error.message : "Example image could not load."} Select Try an example to retry, or choose your own images.`;
      elements.exampleStatus.textContent = message;
      setStatus(message);
      return;
    } finally {
      setRunning(false);
    }
    await analyze();
  }

  function cancel(): void {
    if (active) {
      stopped = true;
      elements.cancel.disabled = true;
      elements.comparisonCancel.disabled = true;
      setStatus("Cancelling. Completed and previously saved results will be retained.");
      client.cancel();
    }
  }
  function redraw(): void {
    if (active || previewPending > 0) return;
    const result = selection.results[selection.selected];
    if (result) void workspace.showPreview(result);
  }
  function settingsChanged(): void {
    if (active || previewPending > 0) return;
    workspace.updateSummary();
    const result = selection.results[selection.selected];
    if (result && !result.analysis) {
      workspace.invalidate();
      void workspace.showPreview(result);
    }
  }
  function inspectApplied(): void {
    elements.selectedImageName.focus({ preventScroll: true });
    elements.selectedImageName.scrollIntoView({ block: "start", behavior: "auto" });
  }
  updateControls();
  workspace.render();
  return {
    choose,
    tryExample,
    analyze,
    analyzeSelected,
    compareSettings,
    cancel,
    redraw,
    settingsChanged,
    inspectApplied,
    download: workspace.download,
  };
}
