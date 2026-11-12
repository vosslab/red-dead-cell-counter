import { elements } from "./counter_elements.js";
import { comparisonSettingsText, settings, validate } from "./detector_settings.js";
import { formatCount } from "./count_statistics.js";
import { roundSettings, type DetectorSettings } from "./experiment_design.js";
import { createImageViewer, type ViewerSettings } from "./image_viewer.js";

export type ImageResult = {
  file: File;
  width: number;
  height: number;
  settings?: DetectorSettings;
  centers?: Float32Array;
  error?: string;
};

export type ImageSelection = { results: ImageResult[]; selected: number };

type WorkspaceHooks = {
  isActive: () => boolean;
  isBatch: () => boolean;
  onSelect: (index: number) => void;
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
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
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

export function createImageWorkspace(
  selection: Readonly<ImageSelection>,
  hooks: WorkspaceHooks,
): ImageWorkspace {
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
    const counted = selection.results.filter(
      (item) => item.centers !== undefined && !item.error,
    ).length;
    const failed = selection.results.filter((item) => item.error !== undefined).length;
    const waiting = selection.results.length - counted - failed;
    elements.batchSummary.textContent = selection.results.length
      ? `${formatCount(counted)} of ${formatCount(selection.results.length)} counted${failed ? ` | ${formatCount(failed)} failed` : ""}${waiting ? ` | ${formatCount(waiting)} waiting` : ""}`
      : "No images selected.";
    elements.ledgerEmpty.hidden = selection.results.length > 0;
    elements.selectedImageName.textContent = result?.file.name ?? "Image inspection";
    elements.selectedImageCount.textContent =
      result?.centers && !result.error ? formatCount(result.centers.length / 2) : "--";
    elements.selectedCountLabel.textContent = result?.error
      ? "Could not count"
      : result?.centers
        ? "cells detected"
        : "Not counted";
    if (!result) {
      elements.selectedImageDetails.textContent = "Choose an image to inspect it.";
    } else if (result.error) {
      elements.selectedImageDetails.textContent = `${result.error} Choose another image or retry analysis.`;
    } else if (result.settings) {
      const changed = Object.entries(roundSettings(settings())).some(
        ([key, value]) => value !== result.settings?.[key as keyof DetectorSettings],
      );
      elements.selectedImageDetails.textContent = `${changed ? "Controls changed; the displayed count still uses " : "Counted with "}${comparisonSettingsText(result.settings)}. ${formatCount(result.width)} x ${formatCount(result.height)} px.`;
    } else {
      elements.selectedImageDetails.textContent =
        "Ready to inspect. Compare settings to count this image and test nearby values.";
    }
  }

  function drawDetections(
    context: CanvasRenderingContext2D,
    width: number,
    result: ImageResult,
  ): void {
    if (!elements.markers.checked || !result.centers) return;
    context.strokeStyle = "#7dffb0";
    context.lineWidth = Math.max(2, width / 1300);
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

  async function showPreview(result: ImageResult): Promise<void> {
    updateSummary();
    try {
      const rounded = roundSettings(settings());
      const projectionSettings: ViewerSettings | undefined =
        result.settings ?? (validate(rounded) ? rounded : undefined);
      await viewer.show(
        result.file,
        projectionSettings,
        function drawOverlay(context, width): void {
          drawDetections(context, width, result);
        },
      );
    } catch (error: unknown) {
      hooks.setStatus(error instanceof Error ? error.message : "Preview failed.");
    }
  }

  function render(): void {
    updateSummary();
    elements.rows.replaceChildren();
    selection.results.forEach(function addRow(result: ImageResult, index: number): void {
      const row = document.createElement("tr");
      if (index === selection.selected) row.className = "selected";
      const count = result.centers ? formatCount(result.centers.length / 2) : "";
      const state = result.error ? result.error : result.centers ? "Done" : "Waiting";
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
      "filename,width,height,count,status,error,diameter_px,k,threshold,algorithm_version",
    ];
    for (const result of selection.results) {
      const fields = [
        result.file.name,
        String(result.width),
        String(result.height),
        result.centers ? String(result.centers.length / 2) : "",
        result.error ? "failed" : result.centers ? "done" : "waiting",
        result.error ?? "",
        result.settings?.diameter.toFixed(2) ?? "",
        result.settings?.k.toFixed(2) ?? "",
        result.settings?.threshold.toFixed(5) ?? "",
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
      elements.canvas.hidden = true;
      elements.emptyImage.hidden = false;
    },
    setBusy: (running: boolean): void => viewer.setBusy(running),
    download,
  };
}
