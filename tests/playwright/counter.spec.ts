/// <reference types="node" />
// Selector contract: accessible labels and buttons in src/index.html.
import { expect, test, type Download, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const a501 = path.join(process.cwd(), "IMAGES", "A501.jpg");

async function a501Payload(): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  return { name: "A501.jpg", mimeType: "image/jpeg", buffer: await readFile(a501) };
}

async function realImageCrop(
  page: Page,
  side = 640,
): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const picker = page.getByLabel(/^Choose images?$/);
  await picker.setInputFiles(a501);
  const dataUrl = await picker.evaluate(
    async (input: HTMLInputElement, side: number): Promise<string> => {
      const file = input.files?.[0];
      if (!file) throw new Error("The A501 image was not selected.");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = side;
      canvas.height = side;
      const context = canvas.getContext("2d");
      if (!context) {
        bitmap.close();
        throw new Error("Canvas is unavailable.");
      }
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
      const blob = await new Promise<Blob>((resolve, reject): void => {
        canvas.toBlob((value): void => {
          if (value) resolve(value);
          else reject(new Error("Could not encode the real-image crop."));
        }, "image/png");
      });
      return new Promise<string>((resolve, reject): void => {
        const reader = new FileReader();
        reader.addEventListener("load", (): void => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("The crop encoder returned no data URL."));
        });
        reader.addEventListener("error", (): void =>
          reject(reader.error ?? new Error("Crop encoding failed.")),
        );
        reader.readAsDataURL(blob);
      });
    },
    side,
  );
  return {
    name: "A501-central-crop.png",
    mimeType: "image/png",
    buffer: Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"),
  };
}

async function csvContent(download: Download): Promise<string> {
  const downloaded = await download.path();
  if (!downloaded) throw new Error("CSV download has no local path.");
  return readFile(downloaded, "utf8");
}

function picker(page: Page): Locator {
  return page.getByLabel(/^Choose images?$/);
}

async function selectMode(page: Page, mode: "single" | "batch"): Promise<void> {
  const label = mode === "single" ? "Single image" : "Batch";
  const radio = page.getByRole("radio", { name: label, exact: true });
  await radio.check();
  await expect(radio).toBeChecked();
}

async function open(page: Page, mode: "single" | "batch" = "single"): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveTitle("Red Dead Cell Counter");
  await page.getByRole("button", { name: "Enter saloon" }).click();
  await expect(page.getByRole("status")).toHaveText("Choose a JPEG or PNG image.");
  if (mode === "batch") {
    await selectMode(page, "batch");
    await expect(page.getByRole("status")).toHaveText("Choose one or more JPEG or PNG images.");
  }
}

test.beforeEach(({ page }): void => {
  page.on("pageerror", (error: Error): void => {
    throw error;
  });
});

test("saloon entrance supports keyboard access and reveals the counter", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Red Dead Cell Counter" })).toBeVisible();
  await expect(page.getByLabel("Analysis controls")).toBeHidden();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Enter saloon" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Enter saloon" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Red Dead Cell Counter" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "No cells on the board" })).toBeVisible();
});

test("researcher can count a real PI image and download its CSV result", async ({ page }) => {
  await open(page, "batch");
  await expect(page.getByRole("heading", { name: "Red Dead Cell Counter" })).toBeVisible();

  await picker(page).setInputFiles(await a501Payload());
  await expect(page.getByRole("status")).toHaveText("1 image selected.");
  await page.getByRole("button", { name: "Analyze images" }).click();
  await expect(page.getByRole("status")).toHaveText("Analysis complete.", { timeout: 60_000 });
  await expect(page.getByRole("row", { name: /A501\.jpg/ })).toContainText("Done");
  await expect(
    page.locator("#rows tr").filter({ hasText: "A501.jpg" }).locator("td").nth(1),
  ).toHaveText(/^[1-9]\d*$/);
  await expect(page.locator("canvas")).toHaveAttribute("width", "4249");
  await expect(page.locator("canvas")).toHaveAttribute("height", "4258");

  await page.getByLabel("DoG k").fill("6");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const csv = await download;
  expect(csv.suggestedFilename()).toBe("dead-cell-counts.csv");
  const content = await csvContent(csv);
  expect(content).toContain(
    "filename,width,height,count,status,error,diameter_px,k,threshold,algorithm_version",
  );
  expect(content).toContain('"A501.jpg","4249","4258",');
  expect(content).toContain(',"done","","10.00","4.00","0.10000","dog-picker-1"');
});

test("bad files fail without preventing a valid batch result", async ({ page }) => {
  await open(page, "batch");
  await page
    .getByLabel(/^Choose images?$/)
    .setInputFiles([
      { name: "not-an-image.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") },
      await a501Payload(),
    ]);
  await page.getByRole("button", { name: "Analyze images" }).click();
  await expect(page.getByRole("status")).toHaveText("Analysis complete.", { timeout: 60_000 });
  await expect(page.getByRole("row", { name: /not-an-image\.jpg/ })).toContainText(/failed|image/i);
  await expect(page.getByRole("row", { name: /A501\.jpg/ })).toContainText("Done");
});

test("cancellation during image preparation completes without a worker request", async ({
  page,
}) => {
  await open(page, "batch");
  await picker(page).setInputFiles(a501);
  await page.getByRole("button", { name: "Analyze images" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Batch cancelled.", { timeout: 60_000 });
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
        { id: 1, rgba: rgba.buffer, width, height, diameter: 8, k: 3, threshold: 0.01 },
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

test("comparison applies one real-image setting to a subsequent batch CSV", async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  const crop = await realImageCrop(page);
  await picker(page).setInputFiles(crop);
  await expect(page.getByRole("status")).toHaveText("1 image selected.");

  const runs = page.getByLabel("Comparison runs");
  await expect(runs).toHaveAttribute("min", "15");
  await expect(runs).toHaveAttribute("max", "100");
  await expect(runs).toHaveValue("21");

  await page.getByRole("button", { name: "Compare settings" }).click();
  const comparisonRows = page.locator("#comparison-rows tr");
  await expect(comparisonRows).toHaveCount(21, { timeout: 80_000 });
  const appliedRow = comparisonRows
    .filter({ hasText: "Factorial" })
    .filter({ has: page.getByRole("button", { name: "Apply" }) })
    .first();
  const values = await appliedRow
    .locator("td")
    .evaluateAll((cells) => cells.slice(0, 3).map((cell) => cell.textContent ?? ""));
  expect(values).toEqual([
    expect.stringMatching(/^\d+\.\d{2}$/),
    expect.stringMatching(/^\d+\.\d{2}$/),
    expect.stringMatching(/^\d+\.\d{5}$/),
  ]);
  await appliedRow.getByRole("button", { name: "Apply" }).click();
  const appliedValues = await Promise.all(
    ["Cell diameter (px)", "DoG k", "Response threshold"].map((label) =>
      page.getByLabel(label).inputValue(),
    ),
  );
  expect(appliedValues).toEqual(values);
  await page.getByRole("button", { name: "Use settings for batch", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Batch", exact: true })).toBeChecked();
  await picker(page).setInputFiles([
    { ...crop, name: "crop-one.png" },
    { ...crop, name: "crop-two.png" },
  ]);
  await page.getByRole("button", { name: "Analyze images" }).click();
  await expect(page.getByRole("status")).toHaveText("Analysis complete.", { timeout: 80_000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const lines = (await csvContent(await download)).split("\r\n");
  expect(lines).toHaveLength(3);
  for (const line of lines.slice(1)) {
    const fields = line.split(",").map((field) => field.replace(/^"|"$/g, ""));
    expect(fields.slice(6, 9)).toEqual(appliedValues);
  }
});

test("auto-tune compares a real crop before analyzing its batch", async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, "batch");
  const crop = await realImageCrop(page);
  await picker(page).setInputFiles([
    { ...crop, name: "auto-one.png" },
    { ...crop, name: "auto-two.png" },
  ]);
  await page.getByRole("button", { name: "Compare, then analyze batch" }).click();
  await expect(page.getByRole("status")).toHaveText("Analysis complete.", { timeout: 80_000 });
  await expect(page.locator("#comparison-rows tr")).toHaveCount(21);
  await expect(page.locator("#rows tr .ok")).toHaveCount(2);
});

test("all supplied images finish through the browser worker", async ({ page }) => {
  test.setTimeout(240_000);
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
  await open(page, "batch");
  await page
    .getByLabel(/^Choose images?$/)
    .setInputFiles(names.map((name) => path.join(process.cwd(), "IMAGES", name)));
  await expect(page.getByRole("status")).toHaveText(`${names.length} images selected.`);
  const started = Date.now();
  await page.getByRole("button", { name: "Analyze images" }).click();
  await expect(page.getByRole("status")).toHaveText("Analysis complete.", { timeout: 230_000 });
  await expect(page.locator("#rows tr")).toHaveCount(names.length);
  for (const name of names) {
    const row = page.locator("#rows tr").filter({ hasText: name });
    await expect(row).toContainText("Done");
    await expect(row.locator("td").nth(1)).toHaveText(/^\d{1,3}(,\d{3})*$/);
  }
  await expect(
    page.locator("#rows tr").filter({ hasText: "H501.jpg" }).locator("td").nth(1),
  ).toHaveText("3,021");
  await test.info().attach("eight-real-images-timing.txt", {
    body: `${Date.now() - started} ms\n`,
    contentType: "text/plain",
  });
  await page.screenshot({ path: "/private/tmp/red-cell-experiment/browser.png", fullPage: true });
});

test("96-image batch produces one completed row per image and a CSV", async ({ page }) => {
  test.setTimeout(240_000);
  const files = Array.from({ length: 96 }, () => a501);
  await open(page, "batch");
  await picker(page).setInputFiles(files);
  await expect(page.getByRole("status")).toHaveText("96 images selected.");
  await page.getByRole("button", { name: "Analyze images" }).click();
  await expect(page.getByRole("status")).toHaveText("Analysis complete.", { timeout: 230_000 });
  await expect(page.locator("#rows tr")).toHaveCount(96);
  await expect(page.locator("#rows tr .ok")).toHaveCount(96);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  expect((await download).suggestedFilename()).toBe("dead-cell-counts.csv");
});

test("cancellation stops a queued batch", async ({ page }) => {
  test.setTimeout(90_000);
  const source = await a501Payload();
  await open(page, "batch");
  await picker(page).setInputFiles([
    { ...source, name: "first.jpg" },
    { ...source, name: "second.jpg" },
  ]);
  await page.getByRole("button", { name: "Analyze images" }).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
  await expect(page.getByRole("radio", { name: "Single image", exact: true })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "Batch", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Batch cancelled.", { timeout: 80_000 });
  await expect(page.getByRole("radio", { name: "Single image", exact: true })).toBeEnabled();
  await expect(page.getByRole("radio", { name: "Batch", exact: true })).toBeEnabled();
});

test("zoom exposes individual picks and returns to a fitted overview", async ({ page }) => {
  await open(page);
  await picker(page).setInputFiles(a501);
  await page.getByRole("button", { name: "Analyze selected image", exact: true }).click();
  await expect(page.locator("#status")).toHaveText("Selected image analysis complete.");
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
  await page.screenshot({
    path: "/private/tmp/red-cell-experiment/feedback-zoom.png",
    fullPage: true,
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
  await page.getByRole("button", { name: "Analyze selected image", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Selected image analysis complete.");
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
  await page.getByRole("button", { name: "Analyze selected image", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Selected image analysis complete.");
  await page.getByRole("tab", { name: "DoG", exact: true }).click();
  await expect(page.locator("#image-view-status")).toContainText("Loading DoG response");
  await picker(page).setInputFiles(second);
  await expect(page.locator("#image-view-status")).toHaveText("Raw original RGB image.");
  await expect(page.locator("#image")).toHaveAttribute("width", "160");
  await expect(page.getByRole("tab", { name: "Raw", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("comparison reports progress, explains its recommendation, and confirms applied settings", async ({
  page,
}) => {
  await open(page);
  const crop = await realImageCrop(page);
  await picker(page).setInputFiles(crop);
  await page.getByRole("button", { name: "Compare settings", exact: true }).click();
  await expect(page.locator("#comparison-progress")).toBeVisible();
  await expect(page.locator("#comparison-status")).toHaveAttribute("aria-live", "polite");
  await expect(page.locator("#comparison-progress")).toHaveAttribute("value", "21", {
    timeout: 80_000,
  });
  await expect(
    page.getByRole("button", { name: "Use settings for batch", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("#comparison-recommendation")).toContainText(/diameter/i);
  await expect(page.locator("#comparison-recommendation")).toContainText(/threshold/i);
  await expect(page.locator("#comparison-rows")).toContainText("Recommended");
  await expect(page.locator("#comparison-rows")).toContainText("Applied");
  await expect(page.locator("#comparison-rows")).toContainText("Supplemental");
  await page.screenshot({
    path: "/private/tmp/red-cell-experiment/comparison-feedback.png",
    fullPage: true,
  });
});

test("comparison supports 100 real-image runs and summarizes their visible counts", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await open(page);
  const crop = await realImageCrop(page, 128);
  await picker(page).setInputFiles(crop);
  await page.getByLabel("Comparison runs").fill("101");
  await page.getByRole("button", { name: "Compare settings", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/15.*100/);
  await expect(page.locator("#comparison-rows tr")).toHaveCount(0);

  await page.getByLabel("Comparison runs").fill("100");
  await page.getByRole("button", { name: "Compare settings", exact: true }).click();

  const rows = page.locator("#comparison-rows tr");
  await expect(rows).toHaveCount(100, { timeout: 40_000 });
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
  await page.route("**/worker.js", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}\nconst originalHandler = self.onmessage; self.onmessage = async event => { await new Promise(resolve => setTimeout(resolve, 60)); return originalHandler.call(self, event); };`,
    });
  });
  await page.getByRole("button", { name: "Compare settings", exact: true }).click();
  await expect
    .poll(async () => Number(await page.locator("#comparison-progress").getAttribute("value")))
    .toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Cancel comparison", exact: true }).click();
  await expect(page.locator("#comparison-status")).toContainText(/cancelled/i);
  const completed = Number(await page.locator("#comparison-progress").getAttribute("value"));
  expect(completed).toBeGreaterThanOrEqual(2);
  expect(completed).toBeLessThan(21);
  await expect(page.locator("#comparison-rows tr")).toHaveCount(completed);
  await expect(page.getByRole("button", { name: "Compare settings", exact: true })).toBeEnabled();
});

test("comparison requires a threshold above 0.00001 and keeps small valid values", async ({
  page,
}) => {
  await open(page);
  const crop = await realImageCrop(page);
  await picker(page).setInputFiles(crop);
  await page.getByLabel("Response threshold").fill("0.00001");
  await page.getByRole("button", { name: "Compare settings", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/threshold above 0\.00001/i);
  await expect(page.locator("#comparison-rows tr")).toHaveCount(0);

  await page.getByLabel("Response threshold").fill("0.00002");
  await page.getByRole("button", { name: "Compare settings", exact: true }).click();
  await expect(page.locator("#comparison-status")).toContainText("21 successful", {
    timeout: 80_000,
  });
  const thresholds = (
    await page.locator("#comparison-rows tr td:nth-child(3)").allTextContents()
  ).map(Number);
  expect(thresholds).toHaveLength(21);
  expect(Math.min(...thresholds)).toBeGreaterThan(0);
  expect(Math.max(...thresholds)).toBeLessThan(0.001);
  await expect(page.locator("#comparison-rows")).toContainText("Center");
  await expect(page.locator("#comparison-rows")).toContainText("Factorial");
  await expect(page.locator("#comparison-rows")).toContainText("Axial");
  const fractional = page.locator("#comparison-rows tr").filter({ hasText: "Factorial" }).first();
  await fractional.getByRole("button", { name: "Apply" }).click();
  for (const id of ["diameter", "k", "threshold"]) {
    expect(
      await page.locator(`#${id}`).evaluate((input: HTMLInputElement) => input.validity.valid),
    ).toBe(true);
  }
});

test("single and batch modes separate their workflows while preserving a handoff", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await open(page);
  const single = page.getByRole("radio", { name: "Single image", exact: true });
  const batch = page.getByRole("radio", { name: "Batch", exact: true });
  await expect(single).toBeChecked();
  await expect(picker(page)).not.toHaveAttribute("multiple");
  await expect(page.getByRole("button", { name: "Compare settings", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Analyze selected image", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze images", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Download CSV", exact: true })).toBeHidden();
  await expect(page.locator(".results-panel")).toBeHidden();

  await single.focus();
  await page.keyboard.press("ArrowRight");
  await expect(batch).toBeChecked();
  await expect(picker(page)).toHaveAttribute("multiple", "");
  await expect(page.getByRole("button", { name: "Compare settings", exact: true })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Analyze selected image", exact: true }),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "Analyze images", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Compare, then analyze batch", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tune selected image", exact: true }),
  ).toBeVisible();

  const crop = await realImageCrop(page, 128);
  await picker(page).setInputFiles([
    { ...crop, name: "first.png" },
    { ...crop, name: "second.png" },
  ]);
  await expect(page.locator("#image-selection-summary")).toHaveText("2 images selected.");
  await expect(page.locator("#batch-summary")).toContainText("0 of 2 counted");
  await page.getByRole("button", { name: "Tune selected image", exact: true }).click();
  await expect(single).toBeChecked();
  await expect(page.locator("#image-selection-summary")).toHaveText("Selected: first.png");
  expect(await picker(page).evaluate((input: HTMLInputElement) => input.files?.length)).toBe(2);
  await expect(page.getByRole("button", { name: "Compare settings", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Analyze selected image", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Selected image analysis complete.");
  const selectedCountText = await page.locator("#selected-image-count").textContent();
  if (selectedCountText === null || selectedCountText === "--")
    throw new Error("The selected image count is missing.");
  await expect(page.locator("#selected-image-count")).toHaveText(selectedCountText);
  await expect(page.locator("#selected-image-details")).toContainText("Counted with diameter");
  await expect(page.locator("#selected-image-details")).toContainText("128");

  await page.getByLabel("DoG k").fill("6");
  await expect(page.locator("#selected-image-details")).toContainText("Controls changed");
  await expect(page.locator("#selected-image-count")).toHaveText(selectedCountText);
  await page.getByLabel("DoG k").fill("4");
  await page.getByRole("button", { name: "Compare settings", exact: true }).click();
  await expect(page.locator("#comparison-progress")).toHaveAttribute("value", "21", {
    timeout: 80_000,
  });
  const appliedCountText = await page.locator("#selected-image-count").textContent();
  if (appliedCountText === null || appliedCountText === "--")
    throw new Error("The applied comparison count is missing.");
  const appliedValues = await Promise.all(
    ["diameter", "k", "threshold"].map((id) => page.locator(`#${id}`).inputValue()),
  );
  await expect(page.locator("#comparison-highlights")).toBeVisible();
  const footerValues = await page
    .locator("#comparison-statistics tr td:nth-child(2)")
    .allTextContents();
  await expect(page.locator("#comparison-mean")).toHaveText(footerValues[0] ?? "");
  await expect(page.locator("#comparison-median")).toHaveText(footerValues[1] ?? "");
  await expect(page.locator("#comparison-sd")).toHaveText(footerValues[2] ?? "");
  await page.getByRole("button", { name: "Use settings for batch", exact: true }).click();
  await expect(batch).toBeChecked();
  expect(await picker(page).evaluate((input: HTMLInputElement) => input.files?.length)).toBe(2);
  await expect
    .poll(async () =>
      Promise.all(["diameter", "k", "threshold"].map((id) => page.locator(`#${id}`).inputValue())),
    )
    .toEqual(appliedValues);
  await expect(page.locator("#rows tr")).toHaveCount(2);
  await expect(page.locator("#rows tr").first().locator("td").nth(1)).toHaveText(appliedCountText);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV", exact: true }).click();
  const csv = await csvContent(await download);
  expect(csv).toContain('"first.png"');
  expect(csv).toContain('"second.png"');
  await expect(page.getByRole("button", { name: "Analyze images", exact: true })).toBeEnabled();
});
