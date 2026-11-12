/// <reference types="node" />
// Selector contract: arrival/refinement controls and visible settings in src/index.html;
// result rows and saved-setting captions in src/image_workspace.ts; viewer tabs in src/image_viewer.ts.
import { expect, test, type Download, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  installWorkerLog,
  workerLog,
  type Detection,
  type RefinementLog,
} from "./helper_worker_log.js";

const a501 = path.join(process.cwd(), "IMAGES", "A501.jpg");

type Payload = { name: string; mimeType: string; buffer: Buffer };

async function refinements(page: Page): Promise<RefinementLog[]> {
  return (await workerLog(page)).refinements;
}

function finalDetection(result: RefinementLog): Detection {
  const final = result.detections.slice(-1)[0];
  expect(final, "refinement must rerun a chosen trial").toBeDefined();
  expect(result.detections).toHaveLength(22);
  const trials = result.detections.slice(0, -1);
  for (const axis of ["diameter", "k", "threshold"] as const)
    expect(new Set(trials.map((trial) => trial.settings[axis])).size).toBeGreaterThan(1);
  expect(trials).toContainEqual(final);
  const counts = trials.map((trial) => trial.centers.length / 2).sort((a, b) => a - b);
  expect(final!.centers.length / 2).toBe(counts[10]);
  return final!;
}

async function realImageCrop(page: Page, side = 128): Promise<Payload> {
  const encoded = (await readFile(a501)).toString("base64");
  const dataUrl = await page.evaluate(
    async ({ encoded, side }) => {
      const bitmap = await createImageBitmap(
        await (await fetch(`data:image/jpeg;base64,${encoded}`)).blob(),
      );
      const canvas = document.createElement("canvas");
      canvas.width = side;
      canvas.height = side;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      context.drawImage(
        bitmap,
        Math.floor((bitmap.width - side) / 2),
        Math.floor((bitmap.height - side) / 2),
        side,
        side,
        0,
        0,
        side,
        side,
      );
      bitmap.close();
      return canvas.toDataURL("image/png");
    },
    { encoded, side },
  );
  return {
    name: "A501-central-crop.png",
    mimeType: "image/png",
    buffer: Buffer.from(dataUrl.split(",")[1]!, "base64"),
  };
}

async function csvContent(download: Download): Promise<string> {
  const downloaded = await download.path();
  if (!downloaded) throw new Error("CSV download has no local path.");
  return readFile(downloaded, "utf8");
}

async function csvRows(page: Page): Promise<Record<string, string>[]> {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("dead-cell-counts.csv");
  const [header, ...lines] = (await csvContent(download)).split("\r\n");
  const keys = header!.split(",");
  return lines.map((line) => {
    const fields = [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) =>
      match[1]!.replace(/""/g, '"'),
    );
    expect(fields).toHaveLength(keys.length);
    return Object.fromEntries(keys.map((key, index) => [key, fields[index]!]));
  });
}

function picker(page: Page): Locator {
  return page.getByLabel("Choose microscopy images", { exact: true });
}
async function open(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveTitle("Red Dead Cell Counter");
}
async function advanced(page: Page): Promise<void> {
  await expect(page.locator("#advanced-settings")).toBeVisible();
}
async function count(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Refine and count", exact: true }).click();
  await expect(page.locator("#status")).toContainText("Automatic refinement finished", {
    timeout: 1_150_000,
  });
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(240_000);
  page.on("pageerror", (error: Error): void => {
    throw error;
  });
  await installWorkerLog(page);
});

test("native image picker opens the workbench without counting", async ({ page }) => {
  await open(page);
  await expect(page.locator("#counter")).toBeHidden();
  await expect(page.getByRole("button", { name: "Try an example", exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  const choose = page.getByRole("button", { name: "Choose images", exact: true });
  await expect(choose).toBeFocused();
  const chosen = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const chooser = await chosen;
  expect(chooser.isMultiple()).toBe(true);
  await chooser.setFiles(a501);
  await expect(page.locator("#counter")).toBeVisible();
  await expect(page.locator("#counter-title")).toBeFocused();
  await expect(page.locator("#saloon-gate")).toBeHidden();
  await expect(page.locator("#rows tr")).toHaveCount(1);
  await expect(page.locator("#rows tr")).toContainText("Pending");
  await expect(page.locator("#selected-image-count")).toHaveText("--");
  await expect(page.getByRole("button", { name: "Refine and count", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Download CSV", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Cell diameter (px)")).toBeVisible();
  expect((await workerLog(page)).results).toHaveLength(0);
  const next = page.waitForEvent("filechooser");
  await page.locator("#choose-more-images").click();
  await (await next).setFiles(a501);
  await expect(page.locator("#rows tr")).toContainText("Pending");
});

test("Try example lazily counts the real image through the same automatic pipeline", async ({
  page,
}) => {
  const examples: string[] = [];
  page.on("request", (request) => {
    if (/example_a501\.jpg/.test(request.url())) examples.push(request.url());
  });
  await open(page);
  expect(examples).toHaveLength(0);
  await page.getByRole("button", { name: "Try an example", exact: true }).click();
  await expect(page.locator("#rows tr")).toContainText("Done", { timeout: 230_000 });
  const example = finalDetection((await refinements(page))[0]!);
  expect(example).toBeDefined();
  expect(examples).toHaveLength(1);
  await picker(page).setInputFiles(a501);
  await expect(page.locator("#rows tr")).toContainText("Pending");
  await count(page);
  expect(finalDetection((await refinements(page))[1]!)).toEqual(example);
});

test("automatic results and CSV preserve each saved cutoff after manual controls change", async ({
  page,
}) => {
  await open(page);
  await picker(page).setInputFiles(await realImageCrop(page));
  await count(page);
  const result = (await refinements(page))[0]!;
  const saved = finalDetection(result);
  const [before] = await csvRows(page);
  expect(before).toMatchObject({
    mode: "automatic",
    method: "dog_ccd_median",
    algorithm_version: "dog-refinement-1",
    refinement_runs_requested: "21",
    refinement_runs_successful: "21",
    refinement_runs_failed: "0",
    seed_method: result.seed.analysis.method,
    seed_threshold: result.seed.analysis.settings.threshold.toFixed(5),
    count: String(saved.centers.length / 2),
    diameter_px: saved.settings.diameter.toFixed(2),
    k: saved.settings.k.toFixed(2),
    threshold: saved.settings.threshold.toFixed(5),
  });
  expect(before!.review_reasons).toContain("provisional_refinement");
  await expect(page.locator("#selected-image-count")).toHaveText(
    (saved.centers.length / 2).toLocaleString("en-US"),
  );
  await expect(page.locator("#analysis-notice")).toContainText(/Experimental refinement pipeline/);
  await advanced(page);
  await page.getByLabel("DoG k").fill("6");
  await page.getByLabel("Response threshold").fill("0.50000");
  await expect(page.locator("#selected-image-details")).toContainText("Controls changed");
  await page.getByLabel("Show detections").uncheck();
  await page.getByRole("tab", { name: "DoG", exact: true }).click();
  await expect(page.locator("#image-view-status")).toContainText(
    `k ${saved.settings.k.toFixed(2)}`,
  );
  await page.getByRole("tab", { name: "Threshold", exact: true }).click();
  await expect(page.locator("#image-view-status")).toContainText(
    saved.settings.threshold.toFixed(5),
  );
  expect((await workerLog(page)).previews.slice(-1)[0]).toEqual({
    k: saved.settings.k,
    threshold: Math.fround(saved.settings.threshold),
  });
  expect(await csvRows(page)).toEqual([before]);
});

test("automatic counts depend on each image, independent of batch order and filenames", async ({
  page,
}) => {
  await open(page);
  const first = await realImageCrop(page, 128);
  const second = await realImageCrop(page, 320);
  const singles: Detection[] = [];
  for (const image of [first, second]) {
    await picker(page).setInputFiles(image);
    await count(page);
    singles.push(finalDetection((await refinements(page)).slice(-1)[0]!));
  }
  const renamed = [
    { ...second, name: '=first,"sample".png' },
    { ...first, name: "second.png" },
  ];
  await picker(page).setInputFiles(renamed);
  await advanced(page);
  await page.getByLabel("Cell diameter (px)").fill("10");
  await page.getByLabel("DoG k").fill("4");
  await page.getByLabel("Response threshold").fill("0.7");
  await count(page);
  expect((await refinements(page)).slice(-2).map(finalDetection)).toEqual(
    singles.slice().reverse(),
  );
  const rows = await csvRows(page);
  expect(rows.map((row) => row.filename)).toEqual(['\'=first,"sample".png', "second.png"]);
  expect(rows.map((row) => row.threshold)).toEqual(
    singles
      .slice()
      .reverse()
      .map((result) => result.settings.threshold.toFixed(5)),
  );
});

test("all supplied images receive their own automatic count and review record", async ({
  page,
}) => {
  test.setTimeout(1_200_000);
  const names = [
    "A101.jpg",
    "A501.jpg",
    "B301.jpg",
    "C601.jpg",
    "E401.jpg",
    "F201.jpg",
    "H1001.jpg",
    "H501.jpg",
  ];
  await open(page);
  await picker(page).setInputFiles(names.map((name) => path.join(process.cwd(), "IMAGES", name)));
  await count(page);
  await expect(page.locator("#rows tr")).toHaveCount(8);
  await expect(page.locator("#rows tr .ok")).toHaveCount(8);
  const logs = await refinements(page);
  expect(new Set(logs.map((log) => log.seed.analysis.settings.threshold)).size).toBeGreaterThan(1);
  const results = logs.map(finalDetection);
  expect(results).toHaveLength(8);
  expect(new Set(results.map((result) => result.settings.threshold)).size).toBeGreaterThan(1);
  const rows = await csvRows(page);
  expect(rows.map((row) => row.filename)).toEqual(names);
  for (const [index, row] of rows.entries()) {
    const result = results[index]!;
    expect(row).toMatchObject({
      count: String(result.centers.length / 2),
      mode: "automatic",
      status: "completed",
      threshold: result.settings.threshold.toFixed(5),
    });
    expect(row.review_reasons).toContain("provisional_refinement");
    expect(row.refinement_runs_successful).toBe("21");
  }
  await test.info().attach("eight_automatic_results.json", {
    body: JSON.stringify(names.map((name, index) => ({ name, ...results[index] }))),
    contentType: "application/json",
  });
});

test("bad and blank images do not prevent a valid automatic result", async ({ page }) => {
  await open(page);
  const blank = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      return canvas.toDataURL("image/png").split(",")[1]!;
    }),
    "base64",
  );
  await picker(page).setInputFiles([
    { name: "bad.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") },
    { name: "blank.png", mimeType: "image/png", buffer: blank },
    await realImageCrop(page),
  ]);
  await count(page);
  const rows = await csvRows(page);
  expect(rows[0]).toMatchObject({
    filename: "bad.jpg",
    status: "failed",
    count: "",
    mode: "",
    threshold: "",
  });
  expect(rows[0]!.error).not.toBe("");
  expect(rows[1]).toMatchObject({
    filename: "blank.png",
    status: "completed",
    count: "0",
    no_signal: "true",
    mode: "automatic",
  });
  const logs = await refinements(page);
  expect(logs[0]!.seed.analysis.noSignal).toBe(true);
  expect(logs[0]!.detections).toHaveLength(0);
  expect(logs[1]!.detections).toHaveLength(22);
  expect(rows[1]!.refinement_runs_requested).toBe("");
  expect(Number(rows[1]!.threshold)).toBeGreaterThan(0);
  expect(rows[1]!.review_reasons).not.toBe("");
  expect(rows[2]).toMatchObject({ status: "completed", mode: "automatic" });
  await page.getByRole("button", { name: "blank.png", exact: true }).click();
  await expect(page.locator("#analysis-notice")).toContainText(/no (usable|positive).*signal/i);
  await expect(page.locator("#selected-image-count")).toHaveText("0");
});

test("failed and cancelled recounts preserve saved rows and allow a fresh retry", async ({
  page,
}) => {
  await page.route("**/worker.js", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}\nconst originalHandler = self.onmessage; self.onmessage = async event => { await new Promise(resolve => setTimeout(resolve, 200)); return originalHandler.call(self, event); };`,
    });
  });
  await open(page);
  const crop = await realImageCrop(page, 640);
  await picker(page).setInputFiles([
    { ...crop, name: "first.png" },
    { ...crop, name: "second.png" },
  ]);
  await count(page);
  const before = await csvRows(page);
  await page.evaluate(() => {
    (window as unknown as { failAutomatic: boolean }).failAutomatic = true;
  });
  await count(page);
  const failed = await csvRows(page);
  expect(failed.map((row) => ({ ...row, status: "", error: "" }))).toEqual(
    before.map((row) => ({ ...row, status: "", error: "" })),
  );
  expect(
    failed.every((row) => row.status === "failed" && row.error === "Injected worker failure"),
  ).toBe(true);
  await expect(page.locator("#analysis-notice")).toContainText("previous successful analysis");
  await page.evaluate(() => {
    (window as unknown as { failAutomatic: boolean }).failAutomatic = false;
  });
  await page.getByRole("button", { name: "Refine and count", exact: true }).click();
  await expect(page.locator("#rows tr").filter({ hasText: "second.png" })).toContainText(
    "Queued (previous count retained)",
  );
  await expect(page.locator("#batch-summary")).toContainText("queued");
  await page.locator("#cancel").click();
  await expect(page.locator("#status")).toContainText(/cancelled/i);
  const cancelled = await csvRows(page);
  expect(cancelled.map((row) => ({ ...row, status: "", error: "" }))).toEqual(
    before.map((row) => ({ ...row, status: "", error: "" })),
  );
  expect(cancelled.some((row) => row.status === "cancelled")).toBe(true);
  await expect(page.locator("#batch-summary")).toContainText("2 of 2");
  await count(page);
  expect(await csvRows(page)).toEqual(before);
});

test("worker finds the two known synthetic blobs and returns stable preview planes", async ({
  page,
}) => {
  await open(page);
  const reply = await page.evaluate(async () => {
    const width = 80;
    const height = 80;
    function image(): Uint8Array {
      const rgba = new Uint8Array(width * height * 4);
      for (const { x: centerX, y: centerY } of [
        { x: 20, y: 20 },
        { x: 60, y: 60 },
      ]) {
        for (let y = centerY - 3; y <= centerY + 3; y += 1) {
          for (let x = centerX - 3; x <= centerX + 3; x += 1) {
            if ((x - centerX) ** 2 + (y - centerY) ** 2 <= 9) {
              rgba[(y * width + x) * 4] = 255;
            }
          }
        }
      }
      return rgba;
    }
    function fnv1a(bytes: Uint8Array): number {
      let hash = 2_166_136_261;
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 16_777_619) >>> 0;
      return hash;
    }
    return await new Promise<{
      centers: number[];
      dogLength: number;
      thresholdLength: number;
      dogChecksum: number;
      thresholdChecksum: number;
      thresholdIsBinary: boolean;
    }>((resolve, reject) => {
      const worker = new Worker("worker.js", { type: "module" });
      let centers: number[] = [];
      worker.onmessage = (
        event: MessageEvent<{
          id: number;
          error?: string;
          centers?: ArrayLike<number>;
          dogImage?: Uint8Array;
          thresholdImage?: Uint8Array;
        }>,
      ): void => {
        if (event.data.error) reject(new Error(event.data.error));
        else if (event.data.id === 1 && event.data.centers) {
          centers = Array.from(event.data.centers);
          const rgba = image();
          worker.postMessage(
            {
              kind: "preview",
              id: 2,
              rgba: rgba.buffer,
              width,
              height,
              diameter: 8,
              k: 3,
              threshold: 0.01,
            },
            [rgba.buffer],
          );
        } else if (event.data.id === 2 && event.data.dogImage && event.data.thresholdImage) {
          const { dogImage, thresholdImage } = event.data;
          worker.terminate();
          resolve({
            centers,
            dogLength: dogImage.length,
            thresholdLength: thresholdImage.length,
            dogChecksum: fnv1a(dogImage),
            thresholdChecksum: fnv1a(thresholdImage),
            thresholdIsBinary: thresholdImage.every((value) => value === 0 || value === 255),
          });
        } else reject(new Error("Worker returned no detections or preview planes."));
      };
      const rgba = image();
      worker.postMessage(
        {
          kind: "detect",
          id: 1,
          rgba: rgba.buffer,
          width,
          height,
          diameter: 8,
          k: 3,
          threshold: 0.01,
        },
        [rgba.buffer],
      );
    });
  });
  expect(reply.centers).toEqual([20, 20, 60, 60]);
  expect(reply.dogLength).toBe(80 * 80);
  expect(reply.thresholdLength).toBe(80 * 80);
  expect(reply.dogChecksum).toBe(4_040_210_429);
  expect(reply.thresholdChecksum).toBe(2_186_775_013);
  expect(reply.thresholdIsBinary).toBe(true);
});

test("zoom exposes individual picks and returns to a fitted overview", async ({ page }) => {
  await open(page);
  await picker(page).setInputFiles(a501);
  await advanced(page);
  await page.locator("#analyze-selected").click();
  await expect(page.locator("#status")).toContainText("Selected image manual counting finished");
  await page.getByRole("button", { name: "Actual pixels", exact: true }).click();
  const canvas = page.locator("#image");
  await expect
    .poll(async () =>
      canvas.evaluate(
        (image: HTMLCanvasElement) => image.getBoundingClientRect().width / image.width,
      ),
    )
    .toBeCloseTo(1, 2);
  await page.locator("#zoom").fill("6400");
  await expect
    .poll(async () =>
      canvas.evaluate(
        (image: HTMLCanvasElement) => image.getBoundingClientRect().width / image.width,
      ),
    )
    .toBeGreaterThan(4);
  await page.locator("#canvas-wrap").evaluate((wrap: HTMLElement) => {
    const image = wrap.querySelector("canvas")!;
    const scale = image.getBoundingClientRect().width / image.width;
    wrap.scrollLeft = 3688 * scale - wrap.clientWidth / 2;
    wrap.scrollTop = 3326 * scale - wrap.clientHeight / 2;
  });
  await page.getByRole("button", { name: "Fit image", exact: true }).click();
  expect(
    await canvas.evaluate(
      (image: HTMLCanvasElement) =>
        image.getBoundingClientRect().width <= image.parentElement!.clientWidth + 1,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () =>
      canvas.evaluate(
        (image: HTMLCanvasElement) =>
          image.getBoundingClientRect().width <= image.parentElement!.clientWidth + 1,
      ),
    )
    .toBe(true);
});

test("viewer tabs retain the analyzed settings and render raw, DoG, and threshold planes", async ({
  page,
}) => {
  await open(page);
  const crop = await realImageCrop(page, 128);
  await picker(page).setInputFiles(crop);
  await advanced(page);
  await expect(page.locator("#image")).toBeVisible();
  await expect(page.locator("#image-view-status")).toHaveText("Raw original RGB image.");
  expect(
    await page.locator("#image").evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      return Array.from({ length: pixels.length / 4 }, (_, index) => {
        const offset = index * 4;
        return pixels[offset] !== pixels[offset + 1] || pixels[offset + 1] !== pixels[offset + 2];
      }).some(Boolean);
    }),
  ).toBe(true);
  await page.locator("#analyze-selected").click();
  await expect(page.locator("#status")).toContainText("Selected image manual counting finished");
  await page.getByLabel("Show detections").uncheck();

  const raw = page.getByRole("tab", { name: "Raw", exact: true });
  const dog = page.getByRole("tab", { name: "DoG", exact: true });
  const threshold = page.getByRole("tab", { name: "Threshold", exact: true });
  const panel = page.getByRole("tabpanel");
  await expect(raw).toHaveAttribute("aria-selected", "true");
  await expect(dog).toHaveAttribute("aria-selected", "false");
  await raw.focus();
  await page.keyboard.press("ArrowRight");
  await expect(dog).toBeFocused();
  await expect(raw).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(dog).toHaveAttribute("aria-selected", "true");
  const dogId = await dog.getAttribute("id");
  if (!dogId) throw new Error("The DoG tab needs an id for its tabpanel link.");
  await expect(panel).toHaveAttribute("aria-labelledby", dogId);
  await expect(dog).toHaveAttribute("aria-controls", "image-view-panel");
  await expect(page.locator("#image-view-status")).toContainText("DoG response");
  await expect(page.locator("#image-view-status")).toContainText("k 4.00");
  expect(
    await page.locator("#image").evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      return Array.from({ length: pixels.length / 4 }, (_, index) => {
        const offset = index * 4;
        return pixels[offset] === pixels[offset + 1] && pixels[offset + 1] === pixels[offset + 2];
      }).every(Boolean);
    }),
  ).toBe(true);

  await page.locator("#zoom").fill("175");
  await page.getByLabel("DoG k").fill("6");
  await raw.click();
  await dog.click();
  await expect(page.locator("#image-view-status")).toContainText("k 4.00");
  await expect(page.locator("#zoom")).toHaveValue("175");
  await dog.focus();
  await page.keyboard.press("End");
  await expect(threshold).toBeFocused();
  await expect(dog).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(threshold).toHaveAttribute("aria-selected", "true");
  expect(
    await page.locator("#image").evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      return Array.from({ length: pixels.length / 4 }, (_, index) => {
        const value = pixels[index * 4];
        return value === 0 || value === 255;
      }).every(Boolean);
    }),
  ).toBe(true);
});

test("dragging pans each image view and releases cleanly without blocking keyboard scrolling", async ({
  page,
}) => {
  await open(page);
  await picker(page).setInputFiles(await realImageCrop(page, 128));
  await count(page);
  const canvas = page.locator("#image");
  const viewport = page.getByRole("region", { name: "Image inspection viewport" });
  await expect(canvas).toBeVisible();
  await page.locator("#zoom").fill("2000");
  let previousPan: number[] | undefined;
  for (const [name, caption] of [
    ["Raw", "Raw original RGB image."],
    ["DoG", "DoG response"],
    ["Threshold", "Binary threshold"],
  ]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.locator("#image-view-status")).toContainText(caption ?? "");
    if (previousPan)
      expect(await viewport.evaluate((wrap) => [wrap.scrollLeft, wrap.scrollTop])).toEqual(
        previousPan,
      );
    await viewport.scrollIntoViewIfNeeded();
    await viewport.evaluate((wrap: HTMLElement) => wrap.scrollTo(100, 100));
    const bounds = await viewport.boundingBox();
    if (!bounds) throw new Error("Image viewport has no bounds.");
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await expect(canvas).toHaveCSS("cursor", "grab");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(viewport).toBeFocused();
    await expect(canvas).toHaveCSS("cursor", "grabbing");
    await page.mouse.move(x - 80, y - 50, { steps: 4 });
    expect(await viewport.evaluate((wrap) => [wrap.scrollLeft, wrap.scrollTop])).toEqual([
      180, 150,
    ]);
    // Capture keeps panning even after the pointer crosses the viewport's top edge.
    await page.mouse.move(x - 80, bounds.y - 20);
    const outside = await viewport.evaluate((wrap) => [wrap.scrollLeft, wrap.scrollTop]);
    previousPan = outside;
    expect(outside[1]).toBeGreaterThan(150);
    await page.mouse.up();
    await expect(canvas).toHaveCSS("cursor", "grab");
    await page.mouse.move(x, y);
    expect(await viewport.evaluate((wrap) => [wrap.scrollLeft, wrap.scrollTop])).toEqual(outside);
  }
  const bounds = await viewport.boundingBox();
  if (!bounds) throw new Error("Image viewport has no bounds.");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(canvas).toHaveCSS("cursor", "grab");
  const before = await viewport.evaluate((wrap) => [wrap.scrollLeft, wrap.scrollTop]);
  await page.mouse.move(bounds.x + 40, bounds.y + 40);
  await page.mouse.up();
  expect(await viewport.evaluate((wrap) => [wrap.scrollLeft, wrap.scrollTop])).toEqual(before);
  await viewport.press("ArrowRight");
  await expect
    .poll(async () => viewport.evaluate((wrap) => wrap.scrollLeft))
    .toBeGreaterThan(before[0] ?? 0);
  await expect(canvas).toHaveCSS("touch-action", "auto");
});

test("a delayed derived preview cannot replace a newly chosen source image", async ({ page }) => {
  await page.route("**/worker.js", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}\nconst originalHandler = self.onmessage; self.onmessage = async event => { await new Promise(resolve => setTimeout(resolve, 80)); return originalHandler.call(self, event); };`,
    });
  });
  await open(page);
  const first = await realImageCrop(page, 128);
  const second = await realImageCrop(page, 160);
  await picker(page).setInputFiles(first);
  await advanced(page);
  await page.locator("#analyze-selected").click();
  await expect(page.locator("#status")).toContainText("Selected image manual counting finished");
  await page.getByRole("tab", { name: "DoG", exact: true }).click();
  await expect(page.locator("#image-view-status")).toContainText("Loading DoG response");
  await picker(page).setInputFiles(second);
  await advanced(page);
  await expect(page.locator("#image-view-status")).toHaveText("Raw original RGB image.");
  await expect(page.locator("#image")).toHaveAttribute("width", "160");
  await expect(page.locator("#image-view-tools")).toBeHidden();
  await expect(page.locator("#raw-view")).toHaveAttribute("aria-selected", "true");
});

test("selected refinement applies a real trial and summarizes 100 visible counts", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await open(page);
  const crop = await realImageCrop(page, 128);
  await picker(page).setInputFiles([
    { ...crop, name: "selected.png" },
    { ...crop, name: "untouched.png" },
  ]);
  await advanced(page);
  await page.locator("#analyze-selected").click();
  await expect(page.locator("#status")).toContainText("Selected image manual counting finished");
  const manual = await csvRows(page);
  expect(manual[0]).toMatchObject({ mode: "manual", method: "manual", threshold: "0.10000" });
  expect(manual[1]).toMatchObject({
    status: "waiting",
    count: "",
    threshold: "",
    method: "",
    mode: "",
    review_reasons: "",
    no_signal: "",
  });
  await page.getByLabel("Refinement trials").fill("14");
  await page.locator("#compare").click();
  await expect(page.locator("#status")).toContainText(/15.*100/);
  await page.getByLabel("Refinement trials").fill("101");
  await advanced(page);
  await page.locator("#compare").click();
  await expect(page.locator("#status")).toContainText(/15.*100/);
  await expect(page.locator("#comparison-rows tr")).toHaveCount(0);

  await page.getByLabel("Refinement trials").fill("100");
  await page.locator("#compare").click();

  await expect(page.locator("#status")).toContainText("Selected image refinement finished");
  await page.getByText("Inspect all trial settings and counts", { exact: true }).click();
  const rows = page.locator("#comparison-rows tr");
  await expect(rows).toHaveCount(100, { timeout: 40_000 });
  await expect(page.locator("#comparison-statistics")).toBeVisible();
  await expect(page.locator("#rows tr").filter({ hasText: "untouched.png" })).toContainText(
    "Pending",
  );
  await expect(page.locator("#status")).toContainText("Selected image refinement finished");
  const compared = await csvRows(page);
  expect(compared[0]).toMatchObject({
    mode: "automatic",
    method: "dog_ccd_median",
    refinement_runs_successful: "100",
  });
  await expect(page.locator("#status")).toContainText("Selected image refinement finished");
  expect(compared[1]).toEqual(manual[1]);
  await expect(page.locator("#comparison-progress")).toHaveAttribute("max", "100");
  await expect(page.locator("#comparison-progress")).toHaveAttribute("value", "100");
  const countTexts = await rows.locator("td:nth-child(4)").allTextContents();
  expect(countTexts.every((count) => /^\d{1,3}(,\d{3})*$/.test(count))).toBe(true);
  const counts = countTexts
    .map((count) => Number(count.replace(/,/g, "")))
    .sort((first, second) => first - second);
  expect(counts.every(Number.isFinite)).toBe(true);
  const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  const median = (counts[49] ?? 0) / 2 + (counts[50] ?? 0) / 2;
  const deviation = Math.sqrt(
    counts.reduce((sum, count) => sum + (count - mean) ** 2, 0) / counts.length,
  );
  const formatted = (value: number): string =>
    value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const statistics = page.locator("#comparison-statistics");
  await expect(statistics).toBeVisible();
  await expect(statistics.getByRole("row")).toHaveCount(3);
  await expect(statistics.getByRole("row", { name: /MEAN/ })).toContainText(formatted(mean));
  await expect(statistics.getByRole("row", { name: /MEDIAN/ })).toContainText(formatted(median));
  await expect(statistics.getByRole("row", { name: /SD/ })).toContainText(formatted(deviation));
});

test("cancelled comparison preserves partial progress rather than claiming completion", async ({
  page,
}) => {
  await open(page);
  const crop = await realImageCrop(page);
  await picker(page).setInputFiles(crop);
  await advanced(page);
  await page.route("**/worker.js", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}\nconst originalHandler = self.onmessage; self.onmessage = async event => { await new Promise(resolve => setTimeout(resolve, 60)); return originalHandler.call(self, event); };`,
    });
  });
  await page.locator("#compare").click();
  await expect
    .poll(async () => Number(await page.locator("#comparison-progress").getAttribute("value")))
    .toBeGreaterThanOrEqual(2);
  await page.locator("#cancel-comparison").click();
  await expect(page.locator("#comparison-status")).toContainText(/cancelled/i);
  const completed = Number(await page.locator("#comparison-progress").getAttribute("value"));
  expect(completed).toBeGreaterThanOrEqual(2);
  expect(completed).toBeLessThan(21);
  await expect(page.locator("#comparison-rows tr")).toHaveCount(completed);
  await expect(page.locator("#compare")).toBeEnabled();
});

test("Apply reruns the chosen trial and preserves its settings after controls change", async ({
  page,
}) => {
  await open(page);
  await picker(page).setInputFiles(await realImageCrop(page));
  await page.getByLabel("Refinement trials").fill("15");
  await page.getByLabel("Response threshold").fill("0.00002");
  await page.getByRole("button", { name: "Refine selected image", exact: true }).click();
  await expect(page.locator("#status")).toContainText("Selected image refinement finished");
  const log = (await refinements(page))[0]!;
  expect(log.detections).toHaveLength(16);
  expect(
    new Set(log.detections.slice(0, 15).map((run) => run.settings.threshold)).size,
  ).toBeGreaterThan(1);
  await page.getByText("Inspect all trial settings and counts", { exact: true }).click();
  const trial = page.locator("#comparison-rows tr").filter({ hasText: "Factorial" }).first();
  await expect(trial).toBeVisible();
  const settings = await trial.locator("td").allTextContents();
  const beforeApply = (await workerLog(page)).detections.length;
  await trial.getByRole("button", { name: /^Apply / }).click();
  await expect(page.locator("#status")).toContainText("Applied manual refinement settings");
  await expect.poll(async () => (await workerLog(page)).detections.length).toBe(beforeApply + 1);
  const fresh = (await workerLog(page)).detections.slice(-1)[0]!;
  const [saved] = await csvRows(page);
  expect(saved).toMatchObject({
    diameter_px: settings[0],
    k: settings[1],
    threshold: settings[2],
    count: String(fresh.centers.length / 2),
    mode: "manual",
  });
  await page.getByLabel("DoG k").fill("7");
  expect(await csvRows(page)).toEqual([saved]);
});
