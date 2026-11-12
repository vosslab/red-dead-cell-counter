import { elements } from "./counter_elements.js";
import {
  countStatistics,
  countStatisticsText,
  formatCount,
  formatStatistic,
  type CountStatistics,
} from "./count_statistics.js";
import { comparisonSettingsText } from "./detector_settings.js";
import type { DesignPoint, DetectorSettings } from "./experiment_design.js";
import type { ImageResult } from "./image_workspace.js";

export type Comparison = {
  settings: DetectorSettings;
  kind: DesignPoint["kind"];
  centers?: Float32Array;
  elapsed: number;
  error?: string;
};

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
    return Boolean(comparison.centers);
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
      const count = comparison.centers ? formatCount(comparison.centers.length / 2) : "";
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
      if (comparison === state.recommended) labels.push("Recommended");
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
      if (comparison.centers) {
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
        ? "Comparison progress: ready"
        : `Comparison progress: ${formatCount(completed)} of ${formatCount(total)} candidates complete`;
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
    elements.comparisonSummary.textContent =
      "Select an image, then compare a compact central-composite design of cell-size, k, and threshold settings.";
    elements.comparisonRecommendation.textContent = "";
    elements.comparisonApplied.textContent = "";
    elements.comparisonStatistics.replaceChildren();
    elements.comparisonStatistics.hidden = true;
    elements.comparisonHighlights.hidden = true;
    elements.inspectApplied.disabled = true;
    progress(0, 0);
    status(message);
  }

  function range(candidates: DesignPoint[], axis: keyof DetectorSettings, suffix = ""): string {
    const values = candidates.map(function value(candidate: DesignPoint): number {
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
    elements.comparisonSummary.textContent = `Testing ${formatCount(candidates.length)} settings for ${file.name}: the 15-point central-composite design (1 center, 8 factorial, 6 axial) plus ${formatCount(candidates.length - 15)} supplemental settings. Processed starting point: ${comparisonSettingsText(input)}. Actual design center: ${comparisonSettingsText(candidates[0]!)}. Rounded settings span diameter ${range(candidates, "diameter", " px")}, k ${range(candidates, "k")}, and threshold ${range(candidates, "threshold")}.`;
    elements.comparisonRecommendation.textContent = "";
    elements.comparisonApplied.textContent = "";
    progress(0, candidates.length);
    status(
      `Preparing ${formatCount(candidates.length)} candidates for ${file.name}. Decoding the image before comparison.`,
    );
    render();
    elements.comparison.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    elements.comparisonCancel.disabled = false;
  }

  function end(): void {
    elements.comparisonCancel.disabled = true;
  }

  function cancelled(total: number): CountStatistics | undefined {
    const counts = successfulRuns(state).map(function count(comparison: Comparison): number {
      return (comparison.centers?.length ?? 0) / 2;
    });
    const result = statistics(counts);
    status(
      `Comparison cancelled after ${formatCount(state.runs.length)} of ${formatCount(total)} candidates: ${formatCount(counts.length)} successful and ${formatCount(state.runs.length - counts.length)} failed.${
        result
          ? ` Partial results (n=${formatCount(result.count)}): ${countStatisticsText(result)} These statistics describe sensitivity to settings.`
          : ""
      }`,
    );
    return result;
  }

  function finish(elapsed: number): CountStatistics | undefined {
    const runs = successfulRuns(state);
    const counts = runs.map(function count(comparison: Comparison): number {
      return (comparison.centers?.length ?? 0) / 2;
    });
    const result = statistics(counts);
    const recommendation = state.recommended;
    if (!result || !recommendation) return result;
    const countRange = `${formatCount(Math.min(...counts))}-${formatCount(Math.max(...counts))}`;
    elements.comparisonRecommendation.textContent = `Representative median run: ${formatCount((recommendation.centers?.length ?? 0) / 2)} cells with ${comparisonSettingsText(recommendation.settings)}. This is an actual tested setting whose count is closest to the median of the successful design runs. These statistics describe sensitivity to settings.`;
    status(
      `Comparison finished: ${formatCount(runs.length)} successful and ${formatCount(state.runs.length - runs.length)} failed in ${formatDuration(elapsed)}. Counts ranged from ${countRange}. ${countStatisticsText(result)} These statistics describe sensitivity to settings.`,
    );
    render();
    return result;
  }

  function applied(result: ImageResult): void {
    if (!result.analysis) return;
    elements.comparisonApplied.textContent = `Applied to ${result.file.name} only: ${comparisonSettingsText(result.analysis.settings)}. Inspect the detections. Comparison counts describe sensitivity to settings; the median does not establish accuracy.`;
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
  };
}
