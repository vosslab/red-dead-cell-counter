/// <reference types="node" />
// Selector contract: src/index.html:105 controls, :233 morphology table, :370 viewport;
// src/morphology_panel.ts:109 challenge cards/CSV; src/image_workspace.ts:206 saved settings.
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { WorkerReply, WorkerRequest } from "../../src/analysis_types.js";
import type { MorphologyMeasurements } from "../../src/morphology_types.js";

type MeasurementLog = {
  detections: number[];
  requests: { diameter: number; k: number; threshold: number; centerCount: number }[];
  measurements: MorphologyMeasurements[];
  failMeasure: boolean;
};

async function measurementLog(page: Page): Promise<MeasurementLog> {
  return page.evaluate(
    () => (window as unknown as { measurementLog: MeasurementLog }).measurementLog,
  );
}

async function objectCsv(page: Page): Promise<string> {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download object measurements CSV" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("object-measurements.csv");
  const downloaded = await download.path();
  if (!downloaded) throw new Error("Object CSV download has no local path.");
  return readFile(downloaded, "utf8");
}

test("real-image object measurements remain tied to the saved count and settings", async ({
  page,
}) => {
  test.setTimeout(240_000);
  page.on("pageerror", (error: Error): void => {
    throw error;
  });
  await page.addInitScript(() => {
    const log: MeasurementLog = {
      detections: [],
      requests: [],
      measurements: [],
      failMeasure: false,
    };
    (window as unknown as { measurementLog: MeasurementLog }).measurementLog = log;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", (event: MessageEvent<WorkerReply>) => {
          const reply = event.data;
          if (reply.kind === "detect" && reply.ok) log.detections.push(reply.centers.length / 2);
          if (reply.kind === "measure" && reply.ok) log.measurements.push(reply.morphology);
        });
      }

      override postMessage(
        message: unknown,
        transferOrOptions?: Transferable[] | StructuredSerializeOptions,
      ): void {
        const request = message as WorkerRequest;
        if (request.kind === "measure") {
          log.requests.push({
            diameter: request.diameter,
            k: request.k,
            threshold: request.threshold,
            centerCount: request.centers.length / 2,
          });
          if (log.failMeasure) {
            queueMicrotask(() =>
              this.dispatchEvent(
                new MessageEvent("message", {
                  data: {
                    id: request.id,
                    kind: "measure",
                    ok: false,
                    error: "Injected measurement failure",
                  },
                }),
              ),
            );
            return;
          }
        }
        if (Array.isArray(transferOrOptions)) super.postMessage(message, transferOrOptions);
        else super.postMessage(message, transferOrOptions);
      }
    };
  });
  await page.goto("/");
  await page
    .getByLabel("Choose microscopy images", { exact: true })
    .setInputFiles(path.join(process.cwd(), "IMAGES", "H501.jpg"));
  await page.getByLabel("Cell diameter (px)").fill("10");
  await page.getByLabel("DoG k").fill("4");
  await page.getByLabel("Response threshold").fill("0.10000");
  const countOnce = page.getByRole("button", { name: "Count once with these settings" });
  await countOnce.click();
  await expect(page.locator("#status")).toContainText("Selected image manual counting finished");

  const log = await measurementLog(page);
  expect(log.detections).toHaveLength(1);
  expect(log.measurements).toHaveLength(1);
  const count = log.detections[0]!;
  expect(log.requests).toEqual([
    { diameter: 10, k: 4, threshold: Math.fround(0.1), centerCount: count },
  ]);
  const objects = log.measurements[0]!.objects;
  expect(objects.length).toBeGreaterThan(0);
  expect(objects.some((object) => object.centerIndices.length > 1)).toBe(true);
  expect(objects.reduce((total, object) => total + object.centerIndices.length, 0)).toBe(count);
  expect(objects.flatMap((object) => object.centerIndices).sort((a, b) => a - b)).toEqual(
    Array.from({ length: count }, (_, index) => index),
  );
  const savedCount = count.toLocaleString("en-US");
  await expect(page.locator("#selected-image-count")).toHaveText(savedCount);

  const panel = page.locator("#morphology-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Connected threshold objects, not cell boundaries.");
  await expect(panel.getByRole("columnheader")).toHaveText([
    "Measure",
    "Mean",
    "Median",
    "SD",
    "n",
  ]);
  const eligible = objects.filter(
    (object) => object.centerIndices.length === 1 && !object.touchesEdge,
  );
  expect(eligible.length).toBeGreaterThan(0);
  await expect(page.locator("#morphology-population")).toHaveText(
    `Single-center objects away from image edges (n = ${eligible.length.toLocaleString("en-US")}).`,
  );
  const metrics = [
    ["Area (px²)", "areaPx"],
    ["Equivalent diameter (px)", "equivalentDiameterPx"],
    ["Roundness", "roundness"],
    ["Inertia ratio", "inertiaRatio"],
    ["Mean squared radius (px²)", "meanSquaredRadiusPx2"],
  ] as const;
  for (const [label, key] of metrics) {
    const values = eligible
      .map((object) => object[key])
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const mean = values.reduce((total, value) => total + value, 0) / values.length;
    const middle = Math.floor(values.length / 2);
    const median =
      values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
    const sd = Math.sqrt(
      values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length,
    );
    const formatted = [mean, median, sd].map((value) =>
      Number.isFinite(value)
        ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "--",
    );
    await expect(
      panel
        .getByRole("row")
        .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) })
        .getByRole("cell"),
    ).toHaveText([...formatted, values.length.toLocaleString("en-US")]);
  }

  const gallery = page.locator("#challenge-regions");
  await expect(gallery).toBeVisible();
  await expect(page.locator("#challenge-status")).toContainText("Raw image crops");
  const canvases = gallery.locator("canvas");
  expect(await canvases.count()).toBeGreaterThan(0);
  expect(await canvases.count()).toBeLessThanOrEqual(3);
  for (const canvas of await canvases.all()) {
    await expect(canvas).toHaveAccessibleName(/raw image crop/);
    expect(
      await canvas.evaluate((element: HTMLCanvasElement) => {
        const pixels = element
          .getContext("2d")!
          .getImageData(0, 0, element.width, element.height).data;
        let minimum = 255;
        let maximum = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          minimum = Math.min(minimum, pixels[index]!, pixels[index + 1]!, pixels[index + 2]!);
          maximum = Math.max(maximum, pixels[index]!, pixels[index + 1]!, pixels[index + 2]!);
        }
        return element.width > 0 && element.height > 0 && maximum > minimum;
      }),
    ).toBe(true);
  }
  const csv = await objectCsv(page);
  const [header, ...lines] = csv.split("\r\n");
  const keys = header!.split(",");
  expect(keys).toEqual(
    expect.arrayContaining([
      "filename",
      "diameter_px",
      "k",
      "threshold",
      "area_px2",
      "roundness",
      "inertia_ratio",
      "mean_squared_radius_px2",
      "accepted_center_count",
      "center_indices_1_based",
    ]),
  );
  expect(lines).toHaveLength(objects.length);
  for (const [index, line] of lines.entries()) {
    const fields = [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) =>
      match[1]!.replace(/""/g, '"'),
    );
    const row = Object.fromEntries(keys.map((key, column) => [key, fields[column]]));
    expect(row).toMatchObject({
      filename: "H501.jpg",
      diameter_px: "10.00",
      k: "4.00",
      threshold: "0.10000",
      mode: "manual",
      area_px2: objects[index]!.areaPx.toFixed(2),
      roundness: objects[index]!.roundness.toFixed(2),
      inertia_ratio: Number.isFinite(objects[index]!.inertiaRatio)
        ? objects[index]!.inertiaRatio.toFixed(2)
        : "",
      mean_squared_radius_px2: objects[index]!.meanSquaredRadiusPx2.toFixed(2),
      accepted_center_count: String(objects[index]!.centerIndices.length),
    });
  }
  await page.getByRole("button", { name: "Fit image", exact: true }).click();
  const zoom = page.getByLabel("Zoom");
  const beforeZoom = await zoom.inputValue();
  await gallery
    .locator("article")
    .filter({ hasText: "Largest single-center object" })
    .getByRole("button", { name: "Inspect this region" })
    .click();
  await expect(zoom).not.toHaveValue(beforeZoom);
  await expect(
    page.getByRole("region", { name: "Image inspection viewport", exact: true }),
  ).toBeFocused();
  await expect(page.locator("#selected-image-count")).toHaveText(savedCount);

  const savedMeasurements = (await panel.textContent())!;
  await page.getByLabel("DoG k").fill("5");
  await page.getByLabel("Response threshold").fill("0.20000");
  await expect(page.locator("#selected-image-details")).toContainText("Controls changed");
  await expect(panel).toHaveText(savedMeasurements);
  expect(await objectCsv(page)).toBe(csv);
  await page.evaluate(() => {
    (window as unknown as { measurementLog: MeasurementLog }).measurementLog.failMeasure = true;
  });
  await countOnce.click();
  await expect(page.locator("#analysis-notice")).toContainText("Injected measurement failure");
  await expect(countOnce).toBeEnabled();
  await expect(page.locator("#analysis-notice")).toContainText("previous successful analysis");
  await expect(page.locator("#selected-image-count")).toHaveText(savedCount);
  await expect(panel).toHaveText(savedMeasurements);
  expect(await objectCsv(page)).toBe(csv);
  expect((await measurementLog(page)).measurements).toHaveLength(1);
});
