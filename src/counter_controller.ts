import { elements } from "./counter_elements.js";
import { chooseRepresentative } from "./choose_representative.js";
import { comparisonDesign, type DesignPoint, type DetectorSettings } from "./experiment_design.js";
import {
  comparisonSettingsText,
  processedSettings,
  settingsValidationMessage,
  validate,
} from "./detector_settings.js";
import { formatCount } from "./count_statistics.js";
import { createDetectorClient, decoded, pixels } from "./detector_client.js";
import { createImageWorkspace, type ImageResult, type ImageSelection } from "./image_workspace.js";
import type { SavedAnalysis } from "./analysis_types.js";
import {
  createComparisonPanel,
  formatDuration,
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
      const result = selection.results[index];
      if (result && index !== selection.selected)
        clearComparison(`Comparison feedback cleared for ${result.file.name}.`);
      selection.selected = index;
    },
    setStatus,
  });
  const panel = createComparisonPanel(comparison, {
    isActive: () => active || previewPending > 0,
    onApply: applyComparisonResult,
  });

  function manualAnalysis(input: DetectorSettings): SavedAnalysis {
    return {
      settings: { ...input },
      mode: "manual",
      method: "manual",
      version: "dog-picker-1",
      reviewReasons: [],
      noSignal: false,
    };
  }

  function clearComparison(message: string): void {
    comparison.runs = [];
    comparison.recommended = undefined;
    comparison.applied = undefined;
    comparison.file = undefined;
    panel.clear(message);
    panel.render();
  }

  function setStatus(message: string): void {
    elements.status.textContent = message;
  }

  async function applyComparisonResult(run: Comparison): Promise<void> {
    const result = selection.results[selection.selected];
    if (active || previewPending > 0 || !result || comparison.file !== result.file || !run.centers)
      return;
    stopped = false;
    setRunning(true);
    try {
      if (result.width === 0 || result.height === 0) {
        const bitmap = await decoded(result.file);
        result.width = bitmap.width;
        result.height = bitmap.height;
        bitmap.close();
      }
      if (stopped) return;
      elements.diameter.value = run.settings.diameter.toFixed(2);
      elements.k.value = run.settings.k.toFixed(2);
      elements.threshold.value = run.settings.threshold.toFixed(5);
      result.centers = run.centers;
      result.analysis = manualAnalysis(run.settings);
      result.error = undefined;
      result.status = "completed";
      comparison.applied = run;
      workspace.invalidate();
      workspace.render();
      await workspace.showPreview(result);
      panel.applied(result);
      setStatus(`Applied manual comparison settings to ${result.file.name}.`);
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not apply comparison settings.");
    } finally {
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
    await runAnalysis(true);
  }

  async function analyzeSelected(): Promise<void> {
    await runAnalysis(false);
  }

  async function runAnalysis(automatic: boolean): Promise<void> {
    if (active || previewPending > 0) return;
    if (selection.results.length === 0) {
      setStatus("Choose one or more images first.");
      return;
    }
    // ASVS 2.2.1: automatic counting validates only the controls it actually uses.
    const requested = {
      diameter: Number(elements.diameter.value),
      k: Number(elements.k.value),
    };
    const automaticInput = {
      diameter: Number(requested.diameter.toFixed(2)),
      k: Number(requested.k.toFixed(2)),
    };
    const manualInput = automatic ? undefined : processedSettings();
    const validAutomatic =
      Number.isFinite(requested.diameter) &&
      requested.diameter >= 2 &&
      requested.diameter <= 200 &&
      Number.isFinite(requested.k) &&
      requested.k >= 1.1 &&
      requested.k <= 8;
    if (automatic ? !validAutomatic : !validate(manualInput)) {
      setStatus(
        automatic
          ? "Use a cell diameter of 2-200 px and k of 1.1-8 in Advanced settings."
          : settingsValidationMessage(),
      );
      return;
    }
    if (automatic) {
      elements.diameter.value = automaticInput.diameter.toFixed(2);
      elements.k.value = automaticInput.k.toFixed(2);
    }
    const indices = automatic ? selection.results.map((_, index) => index) : [selection.selected];
    const targets = indices.map((index) => selection.results[index]!);
    clearComparison("Comparison feedback cleared because a new count was started.");
    for (const result of targets) {
      result.status = "waiting";
      result.error = undefined;
    }
    stopped = false;
    setRunning(true);
    const scope = automatic ? "Automatic counting" : "Selected image manual counting";
    try {
      client.start();
      for (let position = 0; position < indices.length && !stopped; position += 1) {
        const index = indices[position]!;
        const result = selection.results[index]!;
        if (selection.selected !== index) workspace.clear();
        selection.selected = index;
        result.status = "working";
        setStatus(
          `${scope}: image ${position + 1} of ${indices.length}, ${result.file.name}. ${automatic ? "Adjusting this image's detection threshold." : "Using manual settings."}`,
        );
        workspace.render();
        try {
          const image = await pixels(result.file);
          if (stopped) break;
          const reply = automatic
            ? await client.processAutomatic(
                index,
                image.rgba,
                image.width,
                image.height,
                automaticInput,
              )
            : await client.process(index, image.rgba, image.width, image.height, manualInput!);
          if (stopped) break;
          if (!reply.ok) throw new Error(reply.error);
          result.width = image.width;
          result.height = image.height;
          result.centers = reply.centers;
          result.analysis =
            reply.kind === "automatic" ? reply.analysis : manualAnalysis(manualInput!);
          result.status = "completed";
          workspace.invalidate();
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
      setRunning(false);
      const completed = targets.filter((result) => result.status === "completed").length;
      const failed = targets.filter((result) => result.status === "failed").length;
      const cancelled = targets.filter((result) => result.status === "cancelled").length;
      setStatus(
        `${scope} ${stopped ? "cancelled" : "finished"}: ${completed} counted, ${failed} failed${cancelled ? `, ${cancelled} cancelled` : ""}. ${stopped ? "Completed and previously saved results are retained." : "Inspect detection markers before using the counts."}`,
      );
      (automatic ? elements.analyze : elements.analyzeSelected).focus({ preventScroll: true });
    }
  }

  async function compareSettings(): Promise<boolean> {
    if (active || previewPending > 0) return false;
    const input = processedSettings();
    const result = selection.results[selection.selected];
    if (!result) {
      setStatus("Choose an image first.");
      return false;
    }
    if (!validate(input)) {
      setStatus(settingsValidationMessage());
      return false;
    }
    const runCount = Number(elements.comparisonRuns.value);
    if (!Number.isInteger(runCount) || runCount < 15 || runCount > 100) {
      const message = "Choose a whole number of comparison runs from 15 through 100.";
      panel.status(message);
      setStatus(message);
      return false;
    }
    let candidates: DesignPoint[];
    try {
      candidates = comparisonDesign(input, runCount);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Comparison design could not be prepared.";
      panel.status(message);
      setStatus(message);
      return false;
    }
    comparison.runs = [];
    comparison.recommended = undefined;
    comparison.applied = undefined;
    comparison.file = result.file;
    panel.start(candidates, input, result.file);
    stopped = false;
    setRunning(true);
    const comparisonStarted = performance.now();
    let setupError: string | undefined;
    try {
      client.start();
      const image = await pixels(result.file);
      for (let index = 0; index < candidates.length && !stopped; index += 1) {
        const candidate = candidates[index];
        if (!candidate) continue;
        const completedBeforeRun = comparison.runs.length;
        panel.status(
          `Comparing ${formatCount(index + 1)} of ${formatCount(candidates.length)}: ${comparisonSettingsText(candidate)}. ${formatCount(completedBeforeRun)} completed.${panel.timing(completedBeforeRun, candidates.length, comparisonStarted)}`,
        );
        const started = performance.now();
        try {
          const reply = await client.process(
            10_000 + index,
            index === 0 ? image.rgba : undefined,
            image.width,
            image.height,
            candidate,
          );
          if (stopped) break;
          comparison.runs.push({
            settings: candidate,
            kind: candidate.kind,
            centers: reply.ok ? reply.centers : undefined,
            error: reply.ok ? undefined : reply.error,
            elapsed: performance.now() - started,
          });
        } catch (error: unknown) {
          if (!stopped)
            comparison.runs.push({
              settings: candidate,
              kind: candidate.kind,
              error: error instanceof Error ? error.message : "Comparison failed.",
              elapsed: performance.now() - started,
            });
        }
        panel.render();
        const completed = comparison.runs.length;
        panel.progress(completed, candidates.length);
        const successes = comparison.runs.filter(function isSuccessful(
          comparison: Comparison,
        ): boolean {
          return Boolean(comparison.centers);
        }).length;
        const failures = completed - successes;
        panel.status(
          `Completed ${formatCount(completed)} of ${formatCount(candidates.length)}: ${formatCount(successes)} successful, ${formatCount(failures)} failed.${panel.timing(completed, candidates.length, comparisonStarted)}`,
        );
      }
    } catch (error: unknown) {
      if (!stopped) setupError = error instanceof Error ? error.message : "Comparison failed.";
    } finally {
      client.finish();
      setRunning(false);
      panel.end();
      elements.compare.focus({ preventScroll: true });
    }
    if (stopped) {
      panel.cancelled(candidates.length);
      setStatus("Comparison cancelled.");
      return false;
    }
    if (setupError) {
      panel.status(
        `Comparison could not start for ${result.file.name}: ${setupError} No candidates were completed.`,
      );
      setStatus(setupError);
      return false;
    }
    const successful = comparison.runs.filter(function isSuccessful(
      comparison: Comparison,
    ): boolean {
      return Boolean(comparison.centers);
    });
    if (successful.length === 0) {
      panel.status(
        `Comparison finished after ${formatDuration(performance.now() - comparisonStarted)}: 0 successful and ${formatCount(comparison.runs.length)} failed.`,
      );
      setStatus(`No comparison settings completed for ${result.file.name}.`);
      return false;
    }
    const choice = chooseRepresentative(
      successful.map(function run(comparison: Comparison): {
        diameter: number;
        k: number;
        threshold: number;
        count: number;
      } {
        return {
          diameter: comparison.settings.diameter,
          k: comparison.settings.k,
          threshold: comparison.settings.threshold,
          count: (comparison.centers?.length ?? 0) / 2,
        };
      }),
    );
    comparison.recommended = successful[choice];
    if (!comparison.recommended) return false;
    panel.finish(performance.now() - comparisonStarted);
    if (comparison.recommended) await applyComparisonResult(comparison.recommended);
    setStatus(
      `Representative median run applied after comparing ${formatCount(comparison.runs.length)} settings for ${result.file.name}.`,
    );
    return true;
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
    clearComparison("Comparison feedback cleared. Choose an image to prepare a comparison.");
    elements.gate.hidden = true;
    elements.counter.hidden = false;
    elements.counter.dataset.workflow = files.length > 1 ? "batch" : "single";
    document.querySelector<HTMLElement>("#workflow-help")!.textContent =
      files.length > 1
        ? `Batch: ${files.length} images. Count cells adjusts each image's threshold separately.`
        : "Single image. Count cells adjusts the threshold from this image's pixels.";
    elements.counterTitle.focus();
    workspace.render();
    updateControls();
    setStatus(
      `${files.length} image${files.length === 1 ? "" : "s"} selected. Select Count cells to count ${files.length === 1 ? "this image" : "each image independently"}.`,
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
    const result = selection.results[selection.selected];
    if (result) void workspace.showPreview(result);
  }
  function settingsChanged(): void {
    workspace.updateSummary();
    const result = selection.results[selection.selected];
    if (result && !result.analysis) {
      workspace.invalidate();
      void workspace.showPreview(result);
    }
  }
  function inspectApplied(): void {
    const advanced = document.querySelector<HTMLDetailsElement>("#advanced-settings")!;
    advanced.open = false;
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
