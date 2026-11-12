import { elements } from "./counter_elements.js";
import {
  countStatistics,
  formatCount,
  formatStatistic,
  type CountStatistics,
} from "./count_statistics.js";
import { comparisonSettingsText } from "./detector_settings.js";
import type { DesignPoint, DetectorSettings } from "./experiment_design.js";
import type { ImageResult } from "./image_workspace.js";
import type { Refinement, RefinementRun } from "./analysis_types.js";

export type Comparison = RefinementRun;

export type ComparisonState = {
  runs: Comparison[];
  recommended?: Comparison;
  applied?: Comparison;
  file?: File;
};

type Hooks = {
  isActive: () => boolean;
  onApply: (comparison: Comparison) => Promise<void>;
};

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 1 : 0)} s`;
}

function cell(text: string, className?: string): HTMLTableCellElement {
  const output = document.createElement("td");
  output.textContent = text;
  if (className) output.className = className;
  return output;
}

function headerCell(text: string): HTMLTableCellElement {
  const output = document.createElement("th");
  output.scope = "row";
  output.colSpan = 3;
  output.textContent = text;
  return output;
}

function successfulRuns(state: ComparisonState): Comparison[] {
  return state.runs.filter(function isSuccessful(comparison: Comparison): boolean {
    return comparison.count !== undefined;
  });
}

export function createComparisonPanel(
  state: ComparisonState,
  hooks: Hooks,
): {
  render: () => void;
  clear: (message: string) => void;
  progress: (completed: number, total: number) => void;
  status: (message: string) => void;
  timing: (completed: number, total: number, started: number) => string;
  start: (candidates: DesignPoint[], input: DetectorSettings, file: File) => void;
  end: () => void;
  cancelled: (total: number) => CountStatistics | undefined;
  finish: (elapsed: number) => CountStatistics | undefined;
  applied: (result: ImageResult) => void;
  restore: (refinement: Refinement, file: File) => void;
} {
  function statistics(counts: number[]): CountStatistics | undefined {
    const result = countStatistics(counts);
    elements.comparisonStatistics.replaceChildren();
    elements.comparisonStatistics.hidden = !result;
    elements.comparisonHighlights.hidden = !result;
    if (!result) return undefined;
    elements.comparisonMean.textContent = formatStatistic(result.mean);
    elements.comparisonMedian.textContent = formatStatistic(result.median);
    elements.comparisonSd.textContent = formatStatistic(result.standardDeviation);
    for (const [label, value] of [
      ["MEAN", result.mean],
      ["MEDIAN", result.median],
      ["SD", result.standardDeviation],
    ] as const) {
      const row = document.createElement("tr");
      row.append(headerCell(label), cell(formatStatistic(value)), cell(""), cell(""), cell(""));
      elements.comparisonStatistics.append(row);
    }
    return result;
  }

  function render(): void {
    elements.inspectApplied.disabled = hooks.isActive() || !state.applied;
    elements.comparisonRows.replaceChildren();
    for (const comparison of state.runs) {
      const row = document.createElement("tr");
      if (comparison === state.recommended) row.className = "recommended";
      const count = comparison.count !== undefined ? formatCount(comparison.count) : "";
      const elapsed = `${comparison.elapsed.toFixed(0)} ms`;
      row.append(
        cell(comparison.settings.diameter.toFixed(2)),
        cell(comparison.settings.k.toFixed(2)),
        cell(comparison.settings.threshold.toFixed(5)),
        cell(count),
        cell(comparison.error ?? elapsed, comparison.error ? "error" : undefined),
        cell(comparison.kind),
      );
      const action = document.createElement("td");
      action.className = "comparison-decision";
      const labels: string[] = [];
      if (comparison === state.recommended) labels.push("Representative");
      if (comparison === state.applied) labels.push("Applied");
      if (labels.length > 0) {
        const label = document.createElement("span");
        label.className = "comparison-decision-label";
        label.textContent = labels.join(" * ");
        action.append(label);
      } else if (comparison.error) {
        const label = document.createElement("span");
        label.className = "comparison-decision-label";
        label.textContent = "Failed";
        action.append(label);
      }
      if (comparison.count !== undefined && state.applied) {
        const apply = document.createElement("button");
        apply.type = "button";
        apply.textContent = "Apply";
        apply.setAttribute(
          "aria-label",
          `Apply ${comparisonSettingsText(comparison.settings)} to ${state.file?.name ?? "the selected image"}`,
        );
        apply.disabled = hooks.isActive();
        apply.addEventListener("click", function applyComparison(): void {
          void hooks.onApply(comparison);
        });
        action.append(apply);
      }
      row.append(action);
      elements.comparisonRows.append(row);
    }
  }

  function progress(completed: number, total: number): void {
    elements.comparisonProgress.max = Math.max(1, total);
    elements.comparisonProgress.value = Math.min(completed, total);
    elements.comparisonProgressLabel.textContent =
      total === 0
        ? "Refinement progress: ready"
        : `Refinement progress: ${formatCount(completed)} of ${formatCount(total)} settings complete`;
  }

  function status(message: string): void {
    elements.comparisonStatus.textContent = message;
  }

  function timing(completed: number, total: number, started: number): string {
    if (completed === 0) return "";
    const elapsed = performance.now() - started;
    if (completed < 2) return ` ${formatDuration(elapsed)} elapsed.`;
    const averageRun =
      state.runs.reduce(function sum(totalElapsed: number, item: Comparison): number {
        return totalElapsed + item.elapsed;
      }, 0) / completed;
    return ` ${formatDuration(elapsed)} elapsed, about ${formatDuration(averageRun * (total - completed))} remaining.`;
  }

  function clear(message: string): void {
    elements.comparison.classList.remove("has-comparison");
    state.runs = [];
    state.recommended = undefined;
    state.applied = undefined;
    state.file = undefined;
    elements.comparisonSummary.textContent =
      "Select an image, then refine and count across cell-size, k, and threshold settings.";
    elements.comparisonRecommendation.textContent = "";
    elements.comparisonApplied.textContent = "";
    elements.comparisonStatistics.replaceChildren();
    elements.comparisonStatistics.hidden = true;
    elements.comparisonHighlights.hidden = true;
    elements.inspectApplied.disabled = true;
    progress(0, 0);
    status(message);
    end();
    render();
  }

  function range(
    candidates: Readonly<DetectorSettings>[],
    axis: keyof DetectorSettings,
    suffix = "",
  ): string {
    const values = candidates.map(function value(candidate: Readonly<DetectorSettings>): number {
      return candidate[axis];
    });
    const digits = axis === "threshold" ? 5 : 2;
    return `${Math.min(...values).toFixed(digits)}-${Math.max(...values).toFixed(digits)}${suffix}`;
  }

  function start(candidates: DesignPoint[], input: DetectorSettings, file: File): void {
    elements.comparison.classList.add("has-comparison");
    elements.comparisonStatistics.replaceChildren();
    elements.comparisonStatistics.hidden = true;
    elements.comparisonHighlights.hidden = true;
    elements.comparisonSummary.textContent = designSummary(
      candidates,
      input,
      file,
      candidates.length,
    );
    elements.comparisonRecommendation.textContent = "";
    elements.comparisonApplied.textContent = "";
    progress(0, candidates.length);
    status(
      `Preparing ${formatCount(candidates.length)} settings for ${file.name}. Decoding the image before refinement.`,
    );
    render();
    elements.comparisonCancel.disabled = false;
    elements.comparisonCancel.hidden = false;
  }

  function designSummary(
    candidates: Readonly<DetectorSettings>[],
    input: Readonly<DetectorSettings>,
    file: File,
    requestedRuns: number,
  ): string {
    const span = candidates.length
      ? ` Recorded settings span diameter ${range(candidates, "diameter", " px")}, k ${range(candidates, "k")}, and threshold ${range(candidates, "threshold")}.`
      : "";
    return `Refinement for ${file.name}: ${formatCount(requestedRuns)} requested settings in a 15-point central-composite design (8 factorial points at +/-1, 6 axial points at +/-8^(1/4), 1 center in logarithmic parameter coordinates) plus ${formatCount(Math.max(0, requestedRuns - 15))} supplemental settings. Starting point: ${comparisonSettingsText(input)}.${span} The median trial is the successful tested setting whose count is closest to the median. Statistics describe sensitivity to settings; the median does not establish accuracy.`;
  }

  function end(): void {
    elements.comparisonCancel.disabled = true;
    elements.comparisonCancel.hidden = true;
  }

  function cancelled(total: number): CountStatistics | undefined {
    const counts = successfulRuns(state).map(function count(comparison: Comparison): number {
      return comparison.count!;
    });
    const result = statistics(counts);
    status(
      `Cancelled after ${formatCount(state.runs.length)} of ${formatCount(total)} trials: ${formatCount(counts.length)} successful, ${formatCount(state.runs.length - counts.length)} failed. Partial results only.`,
    );
    return result;
  }

  function finish(elapsed: number): CountStatistics | undefined {
    const runs = successfulRuns(state);
    const counts = runs.map(function count(comparison: Comparison): number {
      return comparison.count!;
    });
    const result = statistics(counts);
    const recommendation = state.recommended;
    if (!result || !recommendation) {
      status(
        `Refinement: ${formatCount(runs.length)} successful and ${formatCount(state.runs.length - runs.length)} failed settings. No representative run is available.`,
      );
      render();
      return result;
    }
    const countRange = `${formatCount(Math.min(...counts))}-${formatCount(Math.max(...counts))}`;
    elements.comparisonRecommendation.textContent = `Median trial: ${formatCount(recommendation.count!)} cells; ${comparisonSettingsText(recommendation.settings)}.`;
    status(
      `${formatCount(runs.length)} successful, ${formatCount(state.runs.length - runs.length)} failed \u00b7 ${formatDuration(elapsed)} \u00b7 counts ${countRange}.`,
    );
    render();
    return result;
  }

  function applied(result: ImageResult): void {
    if (!result.analysis) return;
    elements.comparisonApplied.textContent = `Applied to ${result.file.name}: ${comparisonSettingsText(result.analysis.settings)}.`;
    const refinement = result.analysis.refinement;
    if (refinement) {
      elements.comparisonSummary.textContent = `${designSummary(
        refinement.runs.map((run) => run.settings),
        refinement.startingSettings,
        result.file,
        refinement.requestedRuns,
      )} Seed method: ${refinement.seedMethod}. Method: ${result.analysis.method}; version: ${result.analysis.version}.`;
    }
  }

  function restore(refinement: Refinement, file: File): void {
    state.runs = refinement.runs;
    state.recommended = refinement.runs[refinement.representativeIndex];
    state.applied = refinement.runs[refinement.selectedIndex];
    state.file = file;
    elements.comparison.classList.add("has-comparison");
    elements.comparisonSummary.textContent = designSummary(
      refinement.runs.map((run) => run.settings),
      refinement.startingSettings,
      file,
      refinement.requestedRuns,
    );
    elements.comparisonRecommendation.textContent = "";
    elements.comparisonApplied.textContent = state.applied
      ? `Applied to ${file.name}: ${comparisonSettingsText(state.applied.settings)}.`
      : "";
    progress(refinement.runs.length, refinement.requestedRuns);
    finish(refinement.runs.reduce((elapsed, run) => elapsed + run.elapsed, 0));
    end();
    render();
  }

  return {
    render,
    clear,
    progress,
    status,
    timing,
    start,
    end,
    cancelled,
    finish,
    applied,
    restore,
  };
}
