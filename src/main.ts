import { chooseStable } from "./choose_stable.js";

type Settings = { diameter: number; k: number; threshold: number };
type ImageResult = {
  file: File;
  width: number;
  height: number;
  settings?: Settings;
  centers?: Float32Array;
  error?: string;
};
type WorkerReply = { id: number; centers?: Float32Array; error?: string };
type Comparison = { settings: Settings; centers?: Float32Array; elapsed: number; error?: string };

const elements = {
  images: document.querySelector<HTMLInputElement>("#images")!,
  diameter: document.querySelector<HTMLInputElement>("#diameter")!,
  k: document.querySelector<HTMLInputElement>("#k")!,
  threshold: document.querySelector<HTMLInputElement>("#threshold")!,
  analyze: document.querySelector<HTMLButtonElement>("#analyze")!,
  analyzeSelected: document.querySelector<HTMLButtonElement>("#analyze-selected")!,
  compare: document.querySelector<HTMLButtonElement>("#compare")!,
  autoTuneBatch: document.querySelector<HTMLButtonElement>("#auto-tune-batch")!,
  cancel: document.querySelector<HTMLButtonElement>("#cancel")!,
  download: document.querySelector<HTMLButtonElement>("#download")!,
  status: document.querySelector<HTMLElement>("#status")!,
  rows: document.querySelector<HTMLTableSectionElement>("#rows")!,
  canvas: document.querySelector<HTMLCanvasElement>("#image")!,
  markers: document.querySelector<HTMLInputElement>("#markers")!,
  zoom: document.querySelector<HTMLInputElement>("#zoom")!,
  zoomValue: document.querySelector<HTMLElement>("#zoom-value")!,
  actualPixels: document.querySelector<HTMLButtonElement>("#actual-pixels")!,
  fitImage: document.querySelector<HTMLButtonElement>("#fit-image")!,
  comparison: document.querySelector<HTMLElement>("#comparison")!,
  comparisonSummary: document.querySelector<HTMLElement>("#comparison-summary")!,
  comparisonProgress: document.querySelector<HTMLProgressElement>("#comparison-progress")!,
  comparisonProgressLabel: document.querySelector<HTMLElement>("#comparison-progress-label")!,
  comparisonStatus: document.querySelector<HTMLElement>("#comparison-status")!,
  comparisonCancel: document.querySelector<HTMLButtonElement>("#cancel-comparison")!,
  comparisonRecommendation: document.querySelector<HTMLElement>("#comparison-recommendation")!,
  comparisonApplied: document.querySelector<HTMLElement>("#comparison-applied")!,
  comparisonRows: document.querySelector<HTMLTableSectionElement>("#comparison-rows")!,
};
let results: ImageResult[] = [];
let selected = 0;
let active = false;
let stopped = false;
let worker: Worker | undefined;
let pendingReject: ((reason: Error) => void) | undefined;
let previewToken = 0;
let comparisons: Comparison[] = [];
let recommended: Comparison | undefined;
let appliedComparison: Comparison | undefined;
let comparisonFile: File | undefined;

function settings(): Settings {
  return {
    diameter: Number(elements.diameter.value),
    k: Number(elements.k.value),
    threshold: Number(elements.threshold.value),
  };
}
function setStatus(message: string): void {
  elements.status.textContent = message;
}
function comparisonSettingsText(input: Settings): string {
  return `diameter ${input.diameter} px, k ${showNumber(input.k)}, threshold ${showNumber(input.threshold)}`;
}
function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 1 : 0)} s`;
}
function countStatisticsText(counts: number[]): string {
  const sorted = [...counts].sort(function ascending(first: number, second: number): number {
    return first - second;
  });
  const mean =
    sorted.reduce(function sum(total: number, count: number): number {
      return total + count;
    }, 0) / sorted.length;
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);
  const standardDeviation = Math.sqrt(
    sorted.reduce(function squaredDifference(total: number, count: number): number {
      return total + (count - mean) ** 2;
    }, 0) / sorted.length,
  );
  return `Across ${sorted.length} successful settings: mean ${mean.toFixed(1)}, median ${median.toFixed(1)}, standard deviation ${standardDeviation.toFixed(1)} cells.`;
}
function comparisonTimingText(completed: number, total: number, started: number): string {
  if (completed === 0) return "";
  const elapsed = performance.now() - started;
  if (completed < 2) return ` ${formatDuration(elapsed)} elapsed.`;
  const averageRun =
    comparisons.reduce(function sum(totalElapsed: number, item: Comparison): number {
      return totalElapsed + item.elapsed;
    }, 0) / completed;
  return ` ${formatDuration(elapsed)} elapsed, about ${formatDuration(averageRun * (total - completed))} remaining.`;
}
function setComparisonProgress(completed: number, total: number): void {
  elements.comparisonProgress.max = Math.max(1, total);
  elements.comparisonProgress.value = Math.min(completed, total);
  elements.comparisonProgressLabel.textContent =
    total === 0
      ? "Comparison progress: ready"
      : `Comparison progress: ${completed} of ${total} candidates complete`;
}
function setComparisonStatus(message: string): void {
  elements.comparisonStatus.textContent = message;
}
function clearComparisonFeedback(message: string): void {
  elements.comparisonSummary.textContent =
    "Select an image, then compare nearby cell-size, k, and threshold settings. Count stability is a tuning heuristic, not an accuracy measurement.";
  elements.comparisonRecommendation.textContent = "";
  elements.comparisonApplied.textContent = "";
  setComparisonProgress(0, 0);
  setComparisonStatus(message);
}
function safeCell(text: string): string {
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
}
function cell(text: string, className?: string): HTMLTableCellElement {
  const output = document.createElement("td");
  output.textContent = text;
  if (className) output.className = className;
  return output;
}
function drawRows(): void {
  elements.rows.replaceChildren();
  results.forEach(function addRow(result: ImageResult, index: number): void {
    const row = document.createElement("tr");
    if (index === selected) row.className = "selected";
    const count = result.centers ? String(result.centers.length / 2) : "";
    const state = result.error ? result.error : result.centers ? "Done" : "Waiting";
    row.tabIndex = 0;
    row.append(
      cell(result.file.name),
      cell(count),
      cell(state, result.error ? "error" : result.centers ? "ok" : undefined),
    );
    function selectRow(): void {
      if (active) return;
      if (index !== selected) {
        comparisons = [];
        recommended = undefined;
        appliedComparison = undefined;
        comparisonFile = undefined;
        clearComparisonFeedback(`Comparison feedback cleared for ${result.file.name}.`);
        drawComparisons();
      }
      selected = index;
      drawRows();
      void showPreview(result);
    }
    row.addEventListener("click", selectRow);
    row.addEventListener("keydown", function selectWithKeyboard(event: KeyboardEvent): void {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectRow();
      }
    });
    elements.rows.append(row);
  });
}
function showNumber(value: number): string {
  return Number(value.toPrecision(4)).toString();
}
function drawComparisons(): void {
  elements.comparisonRows.replaceChildren();
  for (const comparison of comparisons) {
    const row = document.createElement("tr");
    if (comparison === recommended) row.className = "recommended";
    const count = comparison.centers ? String(comparison.centers.length / 2) : "";
    const elapsed = `${comparison.elapsed.toFixed(0)} ms`;
    row.append(
      cell(String(comparison.settings.diameter)),
      cell(showNumber(comparison.settings.k)),
      cell(showNumber(comparison.settings.threshold)),
      cell(count),
      cell(comparison.error ?? elapsed, comparison.error ? "error" : undefined),
    );
    const action = document.createElement("td");
    action.className = "comparison-decision";
    const labels: string[] = [];
    if (comparison === recommended) labels.push("Recommended");
    if (comparison === appliedComparison) labels.push("Applied");
    if (labels.length > 0) {
      const label = document.createElement("span");
      label.className = "comparison-decision-label";
      label.textContent = labels.join(" · ");
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
        `Apply ${comparisonSettingsText(comparison.settings)} to ${comparisonFile?.name ?? "the selected image"}`,
      );
      apply.disabled = active;
      apply.addEventListener("click", function applyComparison(): void {
        void applyComparisonResult(comparison);
      });
      action.append(apply);
    }
    row.append(action);
    elements.comparisonRows.append(row);
  }
}
async function applyComparisonResult(comparison: Comparison): Promise<void> {
  const result = results[selected];
  if (active || !result || comparisonFile !== result.file || !comparison.centers) return;
  let dimensions: { width: number; height: number } | undefined;
  if (result.width === 0 || result.height === 0) {
    const bitmap = await decoded(result.file);
    dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
  }
  if (active || results[selected] !== result || comparisonFile !== result.file) return;
  elements.diameter.value = String(comparison.settings.diameter);
  elements.k.value = String(comparison.settings.k);
  elements.threshold.value = String(comparison.settings.threshold);
  result.centers = comparison.centers;
  result.settings = comparison.settings;
  result.error = undefined;
  if (dimensions) {
    result.width = dimensions.width;
    result.height = dimensions.height;
  }
  appliedComparison = comparison;
  drawRows();
  drawComparisons();
  await showPreview(result);
  elements.download.disabled = false;
  elements.comparisonApplied.textContent = `Applied: ${comparisonSettingsText(comparison.settings)}. These settings will be used by Analyze images.`;
  setStatus(`Applied comparison settings to ${result.file.name}.`);
}
async function decoded(file: File): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 40_000_000) {
    bitmap.close();
    throw new Error("Images larger than 40 megapixels are not supported.");
  }
  return bitmap;
}
async function pixels(
  file: File,
): Promise<{ rgba: Uint8ClampedArray; width: number; height: number }> {
  const bitmap = await decoded(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("Canvas is unavailable.");
  }
  context.drawImage(bitmap, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { rgba: image.data, width: canvas.width, height: canvas.height };
}
async function preview(result: ImageResult): Promise<void> {
  const token = ++previewToken;
  const bitmap = await decoded(result.file);
  if (token !== previewToken) {
    bitmap.close();
    return;
  }
  elements.canvas.width = bitmap.width;
  elements.canvas.height = bitmap.height;
  const context = elements.canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return;
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  if (elements.markers.checked && result.centers) {
    context.strokeStyle = "#7dffb0";
    context.lineWidth = Math.max(2, result.width / 1300);
    const radius = (result.settings?.diameter ?? settings().diameter) / 2;
    for (let index = 0; index < result.centers.length; index += 2) {
      const x = result.centers[index];
      const y = result.centers[index + 1];
      if (x !== undefined && y !== undefined) {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }
  updateZoom();
}
async function showPreview(result: ImageResult): Promise<void> {
  try {
    await preview(result);
  } catch (error: unknown) {
    setStatus(error instanceof Error ? error.message : "Preview failed.");
  }
}
function validate(input: Settings): boolean {
  return (
    Number.isFinite(input.diameter) &&
    input.diameter >= 2 &&
    input.diameter <= 200 &&
    Number.isFinite(input.k) &&
    input.k >= 1.1 &&
    input.k <= 8 &&
    Number.isFinite(input.threshold) &&
    input.threshold > 0
  );
}
function process(
  worker: Worker,
  id: number,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  input: Settings,
): Promise<WorkerReply> {
  return new Promise(function waitForResult(
    resolve: (reply: WorkerReply) => void,
    reject: (reason: Error) => void,
  ): void {
    function receive(event: MessageEvent<WorkerReply>): void {
      if (event.data.id === id) {
        cleanup();
        resolve(event.data);
      }
    }
    function failed(): void {
      cleanup();
      reject(new Error("Worker processing failed."));
    }
    function cleanup(): void {
      worker.removeEventListener("message", receive);
      worker.removeEventListener("error", failed);
      pendingReject = undefined;
    }
    worker.addEventListener("message", receive);
    worker.addEventListener("error", failed, { once: true });
    pendingReject = reject;
    worker.postMessage({ id, rgba: rgba.buffer, width, height, ...input }, [rgba.buffer]);
  });
}
function setRunning(running: boolean): void {
  active = running;
  for (const control of [
    elements.images,
    elements.diameter,
    elements.k,
    elements.threshold,
    elements.analyze,
    elements.analyzeSelected,
    elements.compare,
    elements.autoTuneBatch,
  ])
    control.disabled = running;
  elements.cancel.disabled = !running;
  drawComparisons();
}
async function analyze(): Promise<void> {
  const input = settings();
  if (!validate(input)) {
    setStatus("Use a diameter of 2-200 px, k of 1.1-8, and a positive threshold.");
    return;
  }
  if (results.length === 0) {
    setStatus("Choose images first.");
    return;
  }
  for (const result of results) {
    delete result.centers;
    delete result.error;
    delete result.settings;
    result.width = 0;
    result.height = 0;
  }
  setRunning(true);
  stopped = false;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  for (let index = 0; index < results.length && !stopped; index += 1) {
    const result = results[index];
    if (!result) continue;
    selected = index;
    setStatus(`Analyzing ${index + 1} of ${results.length}: ${result.file.name}`);
    drawRows();
    try {
      const image = await pixels(result.file);
      if (stopped) break;
      const reply = await process(worker, index, image.rgba, image.width, image.height, input);
      result.width = image.width;
      result.height = image.height;
      if (reply.error) result.error = reply.error;
      else {
        result.centers = reply.centers;
        result.settings = input;
      }
      if (!stopped) await preview(result);
    } catch (error: unknown) {
      if (!stopped)
        result.error = error instanceof Error ? error.message : "Image processing failed.";
    }
  }
  worker?.terminate();
  worker = undefined;
  setRunning(false);
  elements.download.disabled =
    results.some(function hasResult(result: ImageResult): boolean {
      return Boolean(result.centers || result.error);
    }) === false;
  drawRows();
  setStatus(stopped ? "Batch cancelled." : "Analysis complete.");
}
async function analyzeSelected(): Promise<void> {
  const input = settings();
  const result = results[selected];
  if (!result) {
    setStatus("Choose an image first.");
    return;
  }
  if (!validate(input)) {
    setStatus("Use a diameter of 2-200 px, k of 1.1-8, and a positive threshold.");
    return;
  }
  setRunning(true);
  stopped = false;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  setStatus(`Analyzing selected image: ${result.file.name}`);
  try {
    const image = await pixels(result.file);
    if (!stopped) {
      const reply = await process(worker, selected, image.rgba, image.width, image.height, input);
      result.width = image.width;
      result.height = image.height;
      result.error = reply.error;
      result.centers = reply.centers;
      result.settings = reply.error ? undefined : input;
      if (!reply.error) await preview(result);
    }
  } catch (error: unknown) {
    if (!stopped)
      result.error = error instanceof Error ? error.message : "Image processing failed.";
  }
  worker?.terminate();
  worker = undefined;
  setRunning(false);
  drawRows();
  elements.download.disabled =
    results.some(function hasResult(item: ImageResult): boolean {
      return Boolean(item.centers || item.error);
    }) === false;
  setStatus(stopped ? "Batch cancelled." : "Selected image analysis complete.");
}
function comparisonSettings(input: Settings): Settings[] {
  const diameters = [
    ...new Set(
      [input.diameter * 0.75, input.diameter, input.diameter * 1.25].map(function round(
        value: number,
      ): number {
        return Math.min(200, Math.max(2, Math.round(value)));
      }),
    ),
  ];
  const thresholds = [
    ...new Set(
      [input.threshold * 0.5, input.threshold, input.threshold * 2].filter(function valid(
        value: number,
      ): boolean {
        return Number.isFinite(value) && value > 0;
      }),
    ),
  ];
  const candidates: Settings[] = [];
  for (const diameter of diameters)
    for (const k of [3, 4, 6])
      for (const threshold of thresholds) candidates.push({ diameter, k, threshold });
  return candidates;
}
async function compareSettings(): Promise<boolean> {
  const input = settings();
  const result = results[selected];
  if (!result) {
    setStatus("Choose an image first.");
    return false;
  }
  if (!validate(input)) {
    setStatus("Use a diameter of 2-200 px, k of 1.1-8, and a positive threshold.");
    return false;
  }
  const candidates = comparisonSettings(input);
  comparisons = [];
  recommended = undefined;
  appliedComparison = undefined;
  comparisonFile = result.file;
  elements.comparisonSummary.textContent = `Testing ${candidates.length} nearby settings for ${result.file.name}. The recommendation favors a stable count across neighboring settings, not known biological accuracy.`;
  elements.comparisonRecommendation.textContent = "";
  elements.comparisonApplied.textContent = "";
  setComparisonProgress(0, candidates.length);
  setComparisonStatus(
    `Preparing ${candidates.length} candidates for ${result.file.name}. Decoding the image before comparison.`,
  );
  drawComparisons();
  elements.comparison.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
  setRunning(true);
  elements.comparisonCancel.disabled = false;
  stopped = false;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  const comparisonStarted = performance.now();
  let setupError: string | undefined;
  try {
    const image = await pixels(result.file);
    for (let index = 0; index < candidates.length && !stopped; index += 1) {
      const candidate = candidates[index];
      if (!candidate) continue;
      const completedBeforeRun = comparisons.length;
      setComparisonStatus(
        `Comparing ${index + 1} of ${candidates.length}: ${comparisonSettingsText(candidate)}. ${completedBeforeRun} completed.${comparisonTimingText(completedBeforeRun, candidates.length, comparisonStarted)}`,
      );
      const started = performance.now();
      try {
        const reply = await process(
          worker,
          10_000 + index,
          new Uint8ClampedArray(image.rgba),
          image.width,
          image.height,
          candidate,
        );
        comparisons.push({
          settings: candidate,
          centers: reply.centers,
          error: reply.error,
          elapsed: performance.now() - started,
        });
      } catch (error: unknown) {
        if (!stopped)
          comparisons.push({
            settings: candidate,
            error: error instanceof Error ? error.message : "Comparison failed.",
            elapsed: performance.now() - started,
          });
      }
      drawComparisons();
      const completed = comparisons.length;
      setComparisonProgress(completed, candidates.length);
      const successes = comparisons.filter(function isSuccessful(comparison: Comparison): boolean {
        return Boolean(comparison.centers);
      }).length;
      const failures = completed - successes;
      setComparisonStatus(
        `Completed ${completed} of ${candidates.length}: ${successes} successful, ${failures} failed.${comparisonTimingText(completed, candidates.length, comparisonStarted)}`,
      );
    }
  } catch (error: unknown) {
    if (!stopped) setupError = error instanceof Error ? error.message : "Comparison failed.";
  }
  worker?.terminate();
  worker = undefined;
  setRunning(false);
  elements.comparisonCancel.disabled = true;
  if (stopped) {
    const successes = comparisons.filter(function isSuccessful(comparison: Comparison): boolean {
      return Boolean(comparison.centers);
    }).length;
    setComparisonStatus(
      `Comparison cancelled after ${comparisons.length} of ${candidates.length} candidates: ${successes} successful and ${comparisons.length - successes} failed.${
        successes > 0
          ? ` Partial results: ${countStatisticsText(
              comparisons
                .filter(function isSuccessful(comparison: Comparison): boolean {
                  return Boolean(comparison.centers);
                })
                .map(function count(comparison: Comparison): number {
                  return (comparison.centers?.length ?? 0) / 2;
                }),
            )} These statistics describe sensitivity to settings.`
          : ""
      }`,
    );
    setStatus("Comparison cancelled.");
    return false;
  }
  if (setupError) {
    setComparisonStatus(
      `Comparison could not start for ${result.file.name}: ${setupError} No candidates were completed.`,
    );
    setStatus(setupError);
    return false;
  }
  const successful = comparisons.filter(function isSuccessful(comparison: Comparison): boolean {
    return Boolean(comparison.centers);
  });
  if (successful.length === 0) {
    setComparisonStatus(
      `Comparison finished after ${formatDuration(performance.now() - comparisonStarted)}: 0 successful and ${comparisons.length} failed.`,
    );
    setStatus(`No comparison settings completed for ${result.file.name}.`);
    return false;
  }
  const choice = chooseStable(
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
  recommended = successful[choice];
  if (!recommended) return false;
  const recommendation = recommended;
  const counts = successful.map(function count(comparison: Comparison): number {
    return (comparison.centers?.length ?? 0) / 2;
  });
  const countRange = `${Math.min(...counts)}–${Math.max(...counts)}`;
  function axisRange(axis: keyof Settings): string {
    const nearbyCounts = successful
      .filter(function neighboring(comparison: Comparison): boolean {
        return (Object.keys(comparison.settings) as (keyof Settings)[]).every(function sameSetting(
          key: keyof Settings,
        ): boolean {
          return key === axis || comparison.settings[key] === recommendation.settings[key];
        });
      })
      .map(function count(comparison: Comparison): number {
        return (comparison.centers?.length ?? 0) / 2;
      });
    return `${Math.min(...nearbyCounts)}–${Math.max(...nearbyCounts)}`;
  }
  const statistics = countStatisticsText(counts);
  elements.comparisonRecommendation.textContent = `Recommended: ${(recommendation.centers?.length ?? 0) / 2} cells with ${comparisonSettingsText(recommendation.settings)}. With the other two settings fixed, nearby counts range from ${axisRange("diameter")} across diameter, ${axisRange("k")} across k, and ${axisRange("threshold")} across threshold. This is a stability signal, not an accuracy measurement.`;
  setComparisonStatus(
    `Comparison finished: ${successful.length} successful and ${comparisons.length - successful.length} failed in ${formatDuration(performance.now() - comparisonStarted)}. Counts ranged from ${countRange}. ${statistics} These statistics describe sensitivity to settings.`,
  );
  drawComparisons();
  if (recommended) await applyComparisonResult(recommended);
  setStatus(
    `Most stable nearby count applied after comparing ${comparisons.length} settings for ${result.file.name}.`,
  );
  return true;
}
async function autoTuneAndAnalyzeBatch(): Promise<void> {
  const compared = await compareSettings();
  if (compared && !stopped && recommended) await analyze();
}
function download(): void {
  const lines = [
    "filename,width,height,count,status,error,diameter_px,k,threshold,algorithm_version",
  ];
  for (const result of results) {
    const fields = [
      result.file.name,
      String(result.width),
      String(result.height),
      result.centers ? String(result.centers.length / 2) : "",
      result.error ? "failed" : result.centers ? "done" : "waiting",
      result.error ?? "",
      String(result.settings?.diameter ?? ""),
      String(result.settings?.k ?? ""),
      String(result.settings?.threshold ?? ""),
      "dog-picker-1",
    ];
    // ASVS 1.2.10: prefix formula-like filenames before spreadsheet export.
    lines.push(
      fields
        .map(function quote(value: string): string {
          const safe = safeCell(value).replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(","),
    );
  }
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "dead-cell-counts.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}
function choose(): void {
  const files = Array.from(elements.images.files ?? []);
  results = files.map(function makeResult(file: File): ImageResult {
    return { file, width: 0, height: 0 };
  });
  selected = 0;
  comparisons = [];
  recommended = undefined;
  comparisonFile = undefined;
  appliedComparison = undefined;
  clearComparisonFeedback("Comparison feedback cleared. Choose an image to prepare a comparison.");
  drawComparisons();
  elements.download.disabled = true;
  drawRows();
  setStatus(`${results.length} image${results.length === 1 ? "" : "s"} selected.`);
}
function updateZoom(): void {
  const percent = Number(elements.zoom.value);
  const wrap = elements.canvas.parentElement;
  if (!wrap || elements.canvas.width === 0) {
    elements.zoomValue.textContent = `${showNumber(percent)}% fit`;
    return;
  }
  const fit = Math.min(1, wrap.clientWidth / elements.canvas.width);
  const scale = fit * (percent / 100);
  elements.zoomValue.textContent = `${showNumber(percent)}% fit (${scale.toFixed(scale < 1 ? 2 : 1)}x pixels)`;
  elements.canvas.style.width = `${elements.canvas.width * scale}px`;
  elements.canvas.style.height = `${elements.canvas.height * scale}px`;
}
function main(): void {
  elements.images.addEventListener("change", choose);
  elements.analyze.addEventListener("click", function start(): void {
    void analyze();
  });
  elements.analyzeSelected.addEventListener("click", function startSelected(): void {
    void analyzeSelected();
  });
  elements.compare.addEventListener("click", function startComparison(): void {
    void compareSettings();
  });
  elements.autoTuneBatch.addEventListener("click", function startAutoTuneBatch(): void {
    void autoTuneAndAnalyzeBatch();
  });
  elements.cancel.addEventListener("click", function cancel(): void {
    if (active) {
      stopped = true;
      worker?.terminate();
      worker = undefined;
      pendingReject?.(new Error("Batch cancelled."));
      pendingReject = undefined;
    }
  });
  elements.comparisonCancel.addEventListener("click", function cancelComparison(): void {
    elements.cancel.click();
  });
  elements.download.addEventListener("click", download);
  elements.markers.addEventListener("change", function redraw(): void {
    const result = results[selected];
    if (result) void showPreview(result);
  });
  elements.zoom.addEventListener("input", updateZoom);
  elements.actualPixels.addEventListener("click", function showActualPixels(): void {
    const wrap = elements.canvas.parentElement;
    if (!wrap || elements.canvas.width === 0) return;
    const fit = Math.min(1, wrap.clientWidth / elements.canvas.width);
    const actualPercent = Math.min(6400, Math.max(25, 100 / fit));
    elements.zoom.value = String(actualPercent);
    updateZoom();
  });
  elements.fitImage.addEventListener("click", function fitImage(): void {
    elements.zoom.value = "100";
    updateZoom();
  });
  window.addEventListener("resize", updateZoom);
}
main();
