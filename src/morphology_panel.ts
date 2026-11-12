import type { ImageResult } from "./image_workspace.js";
import type { ObjectMeasurement } from "./morphology_types.js";
import { challengeExamples, summarizeMorphology } from "./morphology_statistics.js";
import { downloadCsv } from "./csv_export.js";

function number(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value)
    ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "--";
}

function csvNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "";
}

function textElement<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  text: string,
): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

export function createMorphologyPanel(hooks: {
  isBusy: () => boolean;
  onInspect: (bounds: readonly [number, number, number, number]) => void;
}): { render: (result: ImageResult | undefined) => void; clear: () => void } {
  const panel = document.querySelector<HTMLElement>("#morphology-panel")!;
  const population = document.querySelector<HTMLElement>("#morphology-population")!;
  const cohorts = document.querySelector<HTMLElement>("#morphology-cohorts")!;
  const rows = document.querySelector<HTMLTableSectionElement>("#morphology-rows")!;
  const download = document.querySelector<HTMLButtonElement>("#download-morphology")!;
  const gallery = document.querySelector<HTMLElement>("#challenge-regions")!;
  const cards = document.querySelector<HTMLElement>("#challenge-cards")!;
  const galleryStatus = document.querySelector<HTMLElement>("#challenge-status")!;
  let current: ImageResult | undefined;
  let drawnAnalysis: ImageResult["analysis"];
  let drawnFile: File | undefined;
  let token = 0;

  function clear(): void {
    current = undefined;
    drawnAnalysis = undefined;
    drawnFile = undefined;
    token += 1;
    panel.hidden = true;
    gallery.hidden = true;
    cards.replaceChildren();
    download.disabled = true;
  }

  function exportObjects(): void {
    const analysis = current?.analysis;
    const morphology = analysis?.morphology;
    if (hooks.isBusy() || !current || !analysis || !morphology?.objects.length) return;
    const headers = [
      "filename",
      "diameter_px",
      "k",
      "threshold",
      "method",
      "algorithm_version",
      "mode",
      "object_id",
      "area_px2",
      "centroid_x_px",
      "centroid_y_px",
      "x_min_px",
      "y_min_px",
      "x_max_exclusive_px",
      "y_max_exclusive_px",
      "equivalent_diameter_px",
      "roundness",
      "inertia_ratio",
      "mean_squared_radius_px2",
      "touches_edge",
      "accepted_center_count",
      "center_indices_1_based",
    ];
    const file = current.file;
    downloadCsv(
      "object-measurements.csv",
      headers,
      morphology.objects.map((object, index) => [
        file.name,
        csvNumber(analysis.settings.diameter),
        csvNumber(analysis.settings.k),
        analysis.settings.threshold.toFixed(5),
        analysis.method,
        analysis.version,
        analysis.mode,
        String(index + 1),
        csvNumber(object.areaPx),
        csvNumber(object.centroidX),
        csvNumber(object.centroidY),
        ...object.bounds.map(csvNumber),
        csvNumber(object.equivalentDiameterPx),
        csvNumber(object.roundness),
        csvNumber(object.inertiaRatio),
        csvNumber(object.meanSquaredRadiusPx2),
        String(object.touchesEdge),
        String(object.centerIndices.length),
        object.centerIndices.map((center) => center + 1).join("; "),
      ]),
    );
  }

  function addCard(
    result: ImageResult,
    bitmap: ImageBitmap,
    title: string,
    object: ObjectMeasurement,
  ): void {
    const card = document.createElement("article");
    card.className = "challenge-card";
    card.append(textElement("h3", title));
    const canvas = document.createElement("canvas");
    const pad = Math.max(8, result.analysis!.settings.diameter);
    const [xMin, yMin, xMax, yMax] = object.bounds;
    const left = Math.max(0, Math.floor(xMin - pad));
    const top = Math.max(0, Math.floor(yMin - pad));
    const width = Math.min(bitmap.width, Math.ceil(xMax + pad)) - left;
    const height = Math.min(bitmap.height, Math.ceil(yMax + pad)) - top;
    const scale = Math.min(360 / width, 240 / height);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      `${title}: raw image crop, gold object bounding box and ${object.centerIndices.length} accepted centers in green rings.`,
    );
    const context = canvas.getContext("2d");
    if (context) {
      context.imageSmoothingEnabled = false;
      context.drawImage(bitmap, left, top, width, height, 0, 0, canvas.width, canvas.height);
      context.scale(canvas.width / width, canvas.height / height);
      context.translate(-left, -top);
      context.strokeStyle = "#ffdb77";
      context.lineWidth = 1.5 / scale;
      context.strokeRect(xMin, yMin, xMax - xMin, yMax - yMin);
      context.strokeStyle = "#7dffb0";
      context.lineWidth = 2 / scale;
      for (const index of object.centerIndices) {
        const x = result.centers?.[index * 2];
        const y = result.centers?.[index * 2 + 1];
        if (x === undefined || y === undefined) continue;
        context.beginPath();
        context.arc(x, y, result.analysis!.settings.diameter / 2, 0, Math.PI * 2);
        context.stroke();
      }
    }
    card.append(canvas);
    const count = object.centerIndices.length;
    card.append(
      textElement(
        "p",
        `${count} accepted center${count === 1 ? "" : "s"} in one connected object${object.touchesEdge ? " · image edge" : ""}.`,
      ),
    );
    const metrics = textElement(
      "p",
      `Area ${number(object.areaPx)} px² · Roundness ${number(object.roundness)} · Inertia ratio ${number(object.inertiaRatio)} · Mean squared radius ${number(object.meanSquaredRadiusPx2)} px²`,
    );
    metrics.className = "challenge-metrics";
    card.append(metrics);
    card.append(
      textElement(
        "p",
        count
          ? "The existing peak and spacing rules retained these centers; no boundary splitting or shape rejection."
          : "No center was retained by the peak and spacing rules; roundness does not reject objects.",
      ),
    );
    const inspect = textElement("button", "Inspect this region");
    inspect.type = "button";
    inspect.disabled = hooks.isBusy();
    inspect.addEventListener("click", () => {
      if (!hooks.isBusy()) hooks.onInspect(object.bounds);
    });
    card.append(inspect);
    cards.append(card);
  }

  async function drawChallenges(result: ImageResult, drawToken: number): Promise<void> {
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(result.file);
      if (drawToken !== token) return;
      const examples = challengeExamples(result.analysis!.morphology!);
      for (const example of examples) addCard(result, bitmap, example.title, example.object);
      galleryStatus.textContent = examples.length
        ? "Raw image crops · gold: object bounds · green: accepted centers."
        : "No representative challenge regions for this result.";
    } catch {
      if (drawToken === token)
        galleryStatus.textContent =
          "Region previews could not be loaded. Use the main image to inspect the saved measurements.";
    } finally {
      bitmap?.close();
    }
  }

  function render(result: ImageResult | undefined): void {
    const morphology = result?.analysis?.morphology;
    if (!result || !morphology) {
      clear();
      return;
    }
    current = result;
    panel.hidden = false;
    gallery.hidden = false;
    download.disabled = hooks.isBusy() || morphology.objects.length === 0;
    cards.querySelectorAll("button").forEach((button) => {
      button.disabled = hooks.isBusy();
    });
    const summary = summarizeMorphology(morphology);
    population.textContent = `Single-center objects away from image edges (n = ${summary.eligibleCount.toLocaleString("en-US")}).`;
    cohorts.textContent = `All objects ${summary.objectCount.toLocaleString("en-US")} · One center ${summary.singleCenterCount.toLocaleString("en-US")} · Multiple centers ${summary.multiCenterCount.toLocaleString("en-US")} · No peak ${summary.noCenterCount.toLocaleString("en-US")} · At edge ${summary.edgeCount.toLocaleString("en-US")}`;
    rows.replaceChildren();
    const metricRows = [
      ["Area (px²)", summary.metrics.areaPx],
      ["Equivalent diameter (px)", summary.metrics.equivalentDiameterPx],
      ["Roundness", summary.metrics.roundness],
      ["Inertia ratio", summary.metrics.inertiaRatio],
      ["Mean squared radius (px²)", summary.metrics.meanSquaredRadiusPx2],
    ] as const;
    for (const [label, statistics] of metricRows) {
      const row = document.createElement("tr");
      const heading = textElement("th", label);
      heading.scope = "row";
      row.append(heading);
      for (const value of [statistics?.mean, statistics?.median, statistics?.standardDeviation])
        row.append(textElement("td", number(value)));
      row.append(textElement("td", (statistics?.count ?? 0).toLocaleString("en-US")));
      rows.append(row);
    }
    if (drawnAnalysis === result.analysis && drawnFile === result.file) return;
    drawnAnalysis = result.analysis;
    drawnFile = result.file;
    token += 1;
    cards.replaceChildren();
    galleryStatus.textContent = morphology.objects.length
      ? "Loading region previews…"
      : "No connected threshold objects to show.";
    if (morphology.objects.length) void drawChallenges(result, token);
  }

  download.addEventListener("click", exportObjects);
  return { render, clear };
}
