import { elements } from "./counter_elements.js";
import { chooseRepresentative } from "./choose_representative.js";
import { comparisonDesign, type DesignPoint } from "./experiment_design.js";
import {
  comparisonSettingsText,
  processedSettings,
  settingsValidationMessage,
  validate,
} from "./detector_settings.js";
import { formatCount } from "./count_statistics.js";
import { createDetectorClient, decoded, pixels } from "./detector_client.js";
import { createImageWorkspace, type ImageResult, type ImageSelection } from "./image_workspace.js";
import {
  createComparisonPanel,
  formatDuration,
  type Comparison,
  type ComparisonState,
} from "./comparison_panel.js";
import { createWorkflowModes } from "./workflow_modes.js";

type CounterController = {
  choose: () => void;
  analyze: () => Promise<void>;
  analyzeSelected: () => Promise<void>;
  compareSettings: () => Promise<boolean>;
  autoTuneAndAnalyzeBatch: () => Promise<void>;
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
  const client = createDetectorClient();
  const workspace = createImageWorkspace(selection, {
    isActive: () => active,
    isBatch: () => workflow.isBatch(),
    onSelect(index) {
      const result = selection.results[index];
      if (result && index !== selection.selected)
        clearComparison(`Comparison feedback cleared for ${result.file.name}.`);
      selection.selected = index;
    },
    setStatus,
  });
  const panel = createComparisonPanel(comparison, {
    isActive: () => active,
    onApply: applyComparisonResult,
  });
  const workflow = createWorkflowModes(function modeChanged(): void {
    workspace.updateZoom();
    workspace.updateSummary();
    if (selection.results.length === 0)
      setStatus(
        workflow.isBatch()
          ? "Choose one or more JPEG or PNG images."
          : "Choose a JPEG or PNG image.",
      );
  });

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
    if (active || !result || comparison.file !== result.file || !run.centers) return;
    let dimensions: { width: number; height: number } | undefined;
    if (result.width === 0 || result.height === 0) {
      const bitmap = await decoded(result.file);
      dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
    }
    if (
      active ||
      selection.results[selection.selected] !== result ||
      comparison.file !== result.file
    )
      return;
    elements.diameter.value = run.settings.diameter.toFixed(2);
    elements.k.value = run.settings.k.toFixed(2);
    elements.threshold.value = run.settings.threshold.toFixed(5);
    result.centers = run.centers;
    result.settings = run.settings;
    result.error = undefined;
    if (dimensions) {
      result.width = dimensions.width;
      result.height = dimensions.height;
    }
    comparison.applied = run;
    workspace.invalidate();
    workspace.render();
    panel.render();
    await workspace.showPreview(result);
    elements.download.disabled = false;
    panel.applied(result, selection.results.length);
    setStatus(`Applied comparison settings to ${result.file.name}.`);
  }

  function setRunning(running: boolean): void {
    active = running;
    workflow.setBusy(running);
    for (const control of [
      elements.images,
      elements.diameter,
      elements.k,
      elements.threshold,
      elements.comparisonRuns,
    ])
      control.disabled = running;
    for (const control of [
      elements.analyze,
      elements.analyzeSelected,
      elements.compare,
      elements.autoTuneBatch,
    ])
      control.disabled = running || selection.results.length === 0;
    elements.cancel.disabled = !running;
    elements.cancel.hidden = !running;
    workspace.setBusy(running);
    workspace.render();
    panel.render();
  }

  async function analyze(): Promise<void> {
    const input = processedSettings();
    if (!validate(input)) {
      setStatus(settingsValidationMessage());
      return;
    }
    if (selection.results.length === 0) {
      setStatus("Choose images first.");
      return;
    }
    for (const result of selection.results) {
      delete result.centers;
      delete result.error;
      delete result.settings;
      result.width = 0;
      result.height = 0;
    }
    setRunning(true);
    stopped = false;
    client.start();
    for (let index = 0; index < selection.results.length && !stopped; index += 1) {
      const result = selection.results[index];
      if (!result) continue;
      selection.selected = index;
      setStatus(`Analyzing ${index + 1} of ${selection.results.length}: ${result.file.name}`);
      workspace.render();
      try {
        const image = await pixels(result.file);
        if (stopped) break;
        const reply = await client.process(index, image.rgba, image.width, image.height, input);
        result.width = image.width;
        result.height = image.height;
        if (reply.error) result.error = reply.error;
        else {
          result.centers = reply.centers;
          result.settings = input;
        }
        if (!stopped) await workspace.showPreview(result);
      } catch (error: unknown) {
        if (!stopped)
          result.error = error instanceof Error ? error.message : "Image processing failed.";
      }
    }
    client.finish();
    setRunning(false);
    elements.download.disabled =
      selection.results.some(function hasResult(result: ImageResult): boolean {
        return Boolean(result.centers || result.error);
      }) === false;
    workspace.render();
    setStatus(stopped ? "Batch cancelled." : "Analysis complete.");
  }

  async function analyzeSelected(): Promise<void> {
    const input = processedSettings();
    const result = selection.results[selection.selected];
    if (!result) {
      setStatus("Choose an image first.");
      return;
    }
    if (!validate(input)) {
      setStatus(settingsValidationMessage());
      return;
    }
    setRunning(true);
    stopped = false;
    client.start();
    setStatus(`Analyzing selected image: ${result.file.name}`);
    try {
      const image = await pixels(result.file);
      if (!stopped) {
        const reply = await client.process(
          selection.selected,
          image.rgba,
          image.width,
          image.height,
          input,
        );
        result.width = image.width;
        result.height = image.height;
        result.error = reply.error;
        result.centers = reply.centers;
        result.settings = reply.error ? undefined : input;
        if (!reply.error) await workspace.showPreview(result);
      }
    } catch (error: unknown) {
      if (!stopped)
        result.error = error instanceof Error ? error.message : "Image processing failed.";
    }
    client.finish();
    setRunning(false);
    workspace.render();
    elements.download.disabled =
      selection.results.some(function hasResult(item: ImageResult): boolean {
        return Boolean(item.centers || item.error);
      }) === false;
    setStatus(stopped ? "Selected image analysis cancelled." : "Selected image analysis complete.");
  }

  async function compareSettings(): Promise<boolean> {
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
    setRunning(true);
    stopped = false;
    client.start();
    const comparisonStarted = performance.now();
    let setupError: string | undefined;
    try {
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
          comparison.runs.push({
            settings: candidate,
            kind: candidate.kind,
            centers: reply.centers,
            error: reply.error,
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
    }
    client.finish();
    setRunning(false);
    panel.end();
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

  async function autoTuneAndAnalyzeBatch(): Promise<void> {
    const compared = await compareSettings();
    if (compared && !stopped && comparison.recommended) await analyze();
  }

  function choose(): void {
    const files = Array.from(elements.images.files ?? []);
    workspace.clear();
    selection.results = files.map(function makeResult(file: File): ImageResult {
      return { file, width: 0, height: 0 };
    });
    selection.selected = 0;
    clearComparison("Comparison feedback cleared. Choose an image to prepare a comparison.");
    elements.download.disabled = true;
    setRunning(false);
    const first = selection.results[0];
    if (first) void workspace.showPreview(first);
    setStatus(
      `${selection.results.length} image${selection.results.length === 1 ? "" : "s"} selected.`,
    );
  }

  function cancel(): void {
    if (active) {
      stopped = true;
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
    if (result && !result.settings) {
      workspace.invalidate();
      void workspace.showPreview(result);
    }
  }
  function inspectApplied(): void {
    workflow.select("single");
    elements.selectedImageName.focus({ preventScroll: true });
    elements.selectedImageName.scrollIntoView({ block: "start", behavior: "auto" });
  }
  workflow.select("single");
  return {
    choose,
    analyze,
    analyzeSelected,
    compareSettings,
    autoTuneAndAnalyzeBatch,
    cancel,
    redraw,
    settingsChanged,
    inspectApplied,
    download: workspace.download,
  };
}
