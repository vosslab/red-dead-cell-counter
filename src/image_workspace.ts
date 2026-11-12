import { elements } from "./counter_elements.js";
import { comparisonSettingsText, settings } from "./detector_settings.js";
import type { SavedAnalysis } from "./analysis_types.js";
import { formatCount } from "./count_statistics.js";
import { roundSettings, type DetectorSettings } from "./experiment_design.js";
import { createImageViewer } from "./image_viewer.js";

export type ImageResult = {
  file: File;
  width: number;
  height: number;
  analysis?: SavedAnalysis;
  centers?: Float32Array;
  error?: string;
  status?: "waiting" | "working" | "completed" | "failed" | "cancelled";
};

export type ImageSelection = { results: ImageResult[]; selected: number };

type WorkspaceHooks = {
  isActive: () => boolean;
  isBatch: () => boolean;
  onSelect: (index: number) => void;
  onPreviewBusy: (busy: boolean) => void;
  setStatus: (message: string) => void;
};

type ImageWorkspace = {
  render: () => void;
  updateSummary: () => void;
  showPreview: (result: ImageResult) => Promise<void>;
  updateZoom: () => void;
  invalidate: () => void;
  clear: () => void;
  setBusy: (running: boolean) => void;
  download: () => void;
};

function safeCell(text: string): string {
  return /^[\t\r\n\0]|^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function cell(text: string, className?: string): HTMLTableCellElement {
  const output = document.createElement("td");
  output.textContent = text;
  if (className) output.className = className;
  return output;
}

function showNumber(value: number): string {
  return Number(value.toPrecision(4)).toString();
}

function reviewReasonText(reason: string): string {
  switch (reason) {
    case "provisional_calibration":
      return "Provisional automatic estimate: this method has been tested on eight calibration images and still needs independent validation.";
    case "threshold_sensitive":
      return "Count changes by more than 10% when the threshold is varied slightly; inspect the markers.";
    case "threshold_precision_limited":
      return "The threshold reached the processing precision limit; inspect faint detections.";
    case "no_detections":
      return "No cells were detected at this threshold.";
    case "no_positive_response":
      return "The image has no positive detection signal.";
    case "uniform_positive_response":
      return "The image has too little signal contrast for an automatic count.";
    case "nonfinite_response":
      return "The image produced invalid signal values; try another image.";
    case "li_empty_partition":
    case "li_invalid_iteration":
    case "li_iteration_limit":
    case "multi_otsu_empty_partition":
    case "otsu_empty_partition":
      return "The image's intensity groups could not be separated reliably; inspect the markers.";
    case "same_image_binary_otsu_fallback":
      return "A simpler automatic threshold method was used on this image; inspect the markers.";
    default:
      return `Review recommended: ${reason.replace(/_/g, " ")}.`;
  }
}

export function createImageWorkspace(
  selection: Readonly<ImageSelection>,
  hooks: WorkspaceHooks,
): ImageWorkspace {
  const inspection = document.querySelector<HTMLElement>("#image-inspection")!;
  const imageTools = document.querySelector<HTMLElement>("#image-tools")!;
  const viewTools = document.querySelector<HTMLElement>("#image-view-tools")!;
  const analysisNotice = document.querySelector<HTMLElement>("#analysis-notice")!;

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

  const viewer = createImageViewer({
    canvas: elements.canvas,
    emptyImage: elements.emptyImage,
    tabs: elements.imageViews,
    caption: elements.imageViewStatus,
    updateZoom,
    setStatus: hooks.setStatus,
  });

  function updateSummary(): void {
    const result = selection.results[selection.selected];
    elements.imageSelectionSummary.textContent = hooks.isBatch()
      ? selection.results.length
        ? `${formatCount(selection.results.length)} image${selection.results.length === 1 ? "" : "s"} selected.`
        : "No images selected."
      : result
        ? `Selected: ${result.file.name}`
        : "No image selected.";
    const counted = selection.results.filter((item) => item.centers !== undefined).length;
    const failed = selection.results.filter((item) => item.error !== undefined).length;
    const queued = selection.results.filter(
      (item) => item.status === "waiting" && item.centers !== undefined,
    ).length;
    const waiting = selection.results.filter(
      (item) =>
        item.centers === undefined &&
        !item.error &&
        item.status !== "working" &&
        item.status !== "cancelled",
    ).length;
    const working = selection.results.filter((item) => item.status === "working").length;
    const cancelled = selection.results.filter((item) => item.status === "cancelled").length;
    elements.batchSummary.textContent = selection.results.length
      ? `${formatCount(counted)} of ${formatCount(selection.results.length)} have saved counts${queued ? ` | ${formatCount(queued)} queued for recount` : ""}${working ? ` | ${formatCount(working)} working` : ""}${failed ? ` | ${formatCount(failed)} latest attempts failed` : ""}${cancelled ? ` | ${formatCount(cancelled)} cancelled` : ""}${waiting ? ` | ${formatCount(waiting)} pending` : ""}`
      : "No images selected.";
    elements.ledgerEmpty.hidden = selection.results.length > 0;
    inspection.hidden = !result;
    viewTools.hidden = !result?.analysis;
    elements.selectedImageName.textContent = result?.file.name ?? "Image inspection";
    elements.selectedImageCount.textContent = result?.centers
      ? formatCount(result.centers.length / 2)
      : "--";
    const prior =
      result?.centers !== undefined &&
      (result.error !== undefined ||
        result.status === "waiting" ||
        result.status === "working" ||
        result.status === "cancelled");
    elements.selectedCountLabel.textContent = prior
      ? "cells in previous saved count"
      : result?.centers
        ? "cells detected"
        : result?.error
          ? "Could not count"
          : "Not counted";
    const analysis = result?.analysis;
    const notices =
      analysis?.mode === "automatic"
        ? ["Automatic estimate. Review the detection markers before using this count."]
        : analysis
          ? ["Manual settings. Review the detection markers before using this count."]
          : ["Select Count cells to get an automatic count."];
    if (analysis?.noSignal) notices.push("No usable signal was found; the saved count is zero.");
    for (const reason of analysis?.reviewReasons ?? []) notices.push(reviewReasonText(reason));
    if (prior)
      notices.push("The displayed count and views are from the previous successful analysis.");
    if (result?.status === "working") notices.push("Counting this image...");
    if (result?.status === "cancelled")
      notices.push("The latest count was cancelled. You can retry it.");
    if (result?.error) notices.push(`The latest attempt failed: ${result.error}`);
    analysisNotice.textContent = notices.join(" ");
    if (!result) {
      elements.selectedImageDetails.textContent = "Choose an image to inspect it.";
    } else if (analysis) {
      const changed = Object.entries(roundSettings(settings())).some(
        ([key, value]) =>
          (analysis.mode === "manual" || key !== "threshold") &&
          value !== analysis.settings[key as keyof DetectorSettings],
      );
      elements.selectedImageDetails.textContent = `${changed ? "Controls changed; the displayed count still uses " : "Counted with "}${comparisonSettingsText(analysis.settings)}. ${formatCount(result.width)} x ${formatCount(result.height)} px. Method: ${analysis.method}; version: ${analysis.version}.`;
    } else if (result.error) {
      elements.selectedImageDetails.textContent = `${result.error} Choose another image or retry analysis.`;
    } else {
      elements.selectedImageDetails.textContent =
        "Ready to inspect. Select Count cells for an automatic estimate.";
    }
  }

  function drawDetections(
    context: CanvasRenderingContext2D,
    width: number,
    result: ImageResult,
  ): void {
    if (!elements.markers.checked || !result.centers || !result.analysis) return;
    context.strokeStyle = "#7dffb0";
    context.lineWidth = Math.max(2, width / 1300);
    const radius = result.analysis.settings.diameter / 2;
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

  async function showPreview(result: ImageResult): Promise<void> {
    updateSummary();
    hooks.onPreviewBusy(true);
    try {
      await viewer.show(
        result.file,
        result.analysis?.settings,
        function drawOverlay(context, width): void {
          drawDetections(context, width, result);
        },
      );
      if (selection.results[selection.selected] === result)
        imageTools.hidden = elements.canvas.hidden;
    } catch (error: unknown) {
      hooks.setStatus(error instanceof Error ? error.message : "Preview failed.");
    } finally {
      hooks.onPreviewBusy(false);
    }
  }

  function render(): void {
    updateSummary();
    elements.rows.replaceChildren();
    selection.results.forEach(function addRow(result: ImageResult, index: number): void {
      const row = document.createElement("tr");
      if (index === selection.selected) row.className = "selected";
      const count = result.centers ? formatCount(result.centers.length / 2) : "";
      const state =
        result.status === "waiting" && result.centers
          ? "Queued (previous count retained)"
          : result.status === "working"
            ? "Working"
            : result.error
              ? `Failed: ${result.error}${result.centers ? " (previous count retained)" : ""}`
              : result.status === "cancelled"
                ? `Cancelled${result.centers ? " (previous count retained)" : ""}`
                : result.centers
                  ? "Done"
                  : "Pending";
      const nameCell = cell("");
      const select = document.createElement("button");
      select.type = "button";
      select.className = "image-select";
      select.textContent = result.file.name;
      select.disabled = hooks.isActive();
      if (index === selection.selected) select.setAttribute("aria-current", "true");
      nameCell.append(select);
      row.append(
        nameCell,
        cell(count),
        cell(state, result.error ? "error" : result.centers ? "ok" : undefined),
      );
      row.addEventListener("click", function selectRow(): void {
        if (hooks.isActive()) return;
        hooks.onSelect(index);
        const keepFocus = document.activeElement === select;
        render();
        if (keepFocus) elements.rows.rows[index]?.querySelector("button")?.focus();
        void showPreview(result);
      });
      elements.rows.append(row);
    });
  }

  function download(): void {
    const lines = [
      "filename,width,height,count,status,error,diameter_px,k,threshold,algorithm_version,method,mode,review_reasons,no_signal",
    ];
    for (const result of selection.results) {
      const fields = [
        result.file.name,
        String(result.width),
        String(result.height),
        result.centers ? String(result.centers.length / 2) : "",
        result.status ?? (result.error ? "failed" : result.centers ? "completed" : "waiting"),
        result.error ?? "",
        result.analysis?.settings.diameter.toFixed(2) ?? "",
        result.analysis?.settings.k.toFixed(2) ?? "",
        result.analysis?.settings.threshold.toFixed(5) ?? "",
        result.analysis?.version ?? "",
        result.analysis?.method ?? "",
        result.analysis?.mode ?? "",
        result.analysis?.reviewReasons.join("; ") ?? "",
        result.analysis ? String(result.analysis.noSignal) : "",
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

  elements.zoom.addEventListener("input", updateZoom);
  elements.actualPixels.addEventListener("click", function showActualPixels(): void {
    const wrap = elements.canvas.parentElement;
    if (!wrap || elements.canvas.width === 0) return;
    const fit = Math.min(1, wrap.clientWidth / elements.canvas.width);
    elements.zoom.value = String(Math.min(6400, Math.max(25, 100 / fit)));
    updateZoom();
  });
  elements.fitImage.addEventListener("click", function fitImage(): void {
    elements.zoom.value = "100";
    updateZoom();
  });
  window.addEventListener("resize", updateZoom);

  return {
    render,
    updateSummary,
    showPreview,
    updateZoom,
    invalidate: (): void => viewer.invalidate(),
    clear: (): void => {
      viewer.clear();
      inspection.hidden = true;
      imageTools.hidden = true;
      viewTools.hidden = true;
      elements.canvas.hidden = true;
      elements.emptyImage.hidden = false;
    },
    setBusy: (running: boolean): void => viewer.setBusy(running),
    download,
  };
}
