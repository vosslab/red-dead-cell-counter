/// <reference types="node" />
// Selector contract: accessible labels and buttons in src/index.html.
import { expect, test, type Download, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const a501 = path.join(process.cwd(), "IMAGES", "A501.jpg");

async function a501Payload(): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  return { name: "A501.jpg", mimeType: "image/jpeg", buffer: await readFile(a501) };
}

async function realImageCrop(
  page: Page,
): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const picker = page.getByLabel("Choose images");
  await picker.setInputFiles(a501);
  const dataUrl = await picker.evaluate(async (input: HTMLInputElement): Promise<string> => {
    const file = input.files?.[0];
    if (!file) throw new Error("The A501 image was not selected.");
    const bitmap = await createImageBitmap(file);
    const side = 640;
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
  });
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

async function open(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Choose one or more JPEG or PNG images.");
}

test.beforeEach(({ page }): void => {
  page.on("pageerror", (error: Error): void => {
    throw error;
  });
});

test("researcher can count a real PI image and download its CSV result", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { name: "Dead cell counter" })).toBeVisible();

  await page.getByLabel("Choose images").setInputFiles(await a501Payload());
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
  expect(content).toContain(',"done","","10","4","0.1","dog-picker-1"');
});

test("bad files fail without preventing a valid batch result", async ({ page }) => {
  await open(page);
  await page
    .getByLabel("Choose images")
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
  await open(page);
  await page.getByLabel("Choose images").setInputFiles(a501);
  await page.getByRole("button", { name: "Analyze images" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("status")).toHaveText("Batch cancelled.", { timeout: 60_000 });
});

test("worker finds the two known synthetic blobs", async ({ page }) => {
  await open(page);
  const centers = await page.evaluate(async () => {
    const width = 80;
    const height = 80;
    const rgba = new Uint8Array(width * height * 4);
    for (const { x: centerX, y: centerY } of [
      { x: 20, y: 20 },
      { x: 60, y: 60 },
    ]) {
      for (let y = centerY - 3; y <= centerY + 3; y += 1) {
        for (let x = centerX - 3; x <= centerX + 3; x += 1) {
          if ((x - centerX) ** 2 + (y - centerY) ** 2 <= 9) rgba[(y * width + x) * 4] = 255;
        }
      }
    }
    return await new Promise<number[]>((resolve, reject) => {
      const worker = new Worker("worker.js", { type: "module" });
      worker.onmessage = (
        event: MessageEvent<{ error?: string; centers?: ArrayLike<number> }>,
      ): void => {
        worker.terminate();
        if (event.data.error) reject(new Error(event.data.error));
        else if (event.data.centers) resolve(Array.from(event.data.centers));
        else reject(new Error("Worker returned no detections."));
      };
      worker.postMessage(
        { id: 1, rgba: rgba.buffer, width, height, diameter: 8, k: 3, threshold: 0.01 },
        [rgba.buffer],
      );
    });
  });
  expect(centers).toEqual([20, 20, 60, 60]);
});

test("comparison applies one real-image setting to a subsequent batch CSV", async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  const crop = await realImageCrop(page);
  await page.getByLabel("Choose images").setInputFiles(crop);
  await expect(page.getByRole("status")).toHaveText("1 image selected.");

  await page.getByRole("button", { name: "Compare settings" }).click();
  const comparisonRows = page.locator("#comparison-rows tr");
  await expect(comparisonRows).toHaveCount(27, { timeout: 80_000 });
  const appliedRow = comparisonRows
    .filter({ has: page.getByRole("button", { name: "Apply" }) })
    .first();
  const values = await appliedRow
    .locator("td")
    .evaluateAll((cells) => cells.slice(0, 3).map((cell) => cell.textContent ?? ""));
  expect(values).toHaveLength(3);
  await appliedRow.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByLabel("Cell diameter (px)")).toHaveValue(values[0] ?? "");
  await expect(page.getByLabel("DoG k")).toHaveValue(values[1] ?? "");
  await expect(page.getByLabel("Response threshold")).toHaveValue(values[2] ?? "");

  await page.getByLabel("Choose images").setInputFiles([
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
    expect(line).toContain(`,"${values[0]}","${values[1]}","${values[2]}","dog-picker-1"`);
  }
});

test("auto-tune compares a real crop before analyzing its batch", async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  const crop = await realImageCrop(page);
  await page.getByLabel("Choose images").setInputFiles([
    { ...crop, name: "auto-one.png" },
    { ...crop, name: "auto-two.png" },
  ]);
  await page.getByRole("button", { name: "Auto-tune and analyze batch" }).click();
  await expect(page.getByRole("status")).toHaveText("Analysis complete.", { timeout: 80_000 });
  await expect(page.locator("#comparison-rows tr")).toHaveCount(27);
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
  await page.goto("/");
  await page
    .getByLabel("Choose images")
    .setInputFiles(names.map((name) => path.join(process.cwd(), "IMAGES", name)));
  await expect(page.getByRole("status")).toHaveText(`${names.length} images selected.`);
  const started = Date.now();
  await page.getByRole("button", { name: "Analyze images" }).click();
  await expect(page.getByRole("status")).toHaveText("Analysis complete.", { timeout: 230_000 });
  await expect(page.locator("#rows tr")).toHaveCount(names.length);
  for (const name of names) {
    const row = page.locator("#rows tr").filter({ hasText: name });
    await expect(row).toContainText("Done");
    await expect(row.locator("td").nth(1)).toHaveText(/^\d+$/);
  }
  await test.info().attach("eight-real-images-timing.txt", {
    body: `${Date.now() - started} ms\n`,
    contentType: "text/plain",
  });
  await page.screenshot({ path: "/private/tmp/red-cell-experiment/browser.png", fullPage: true });
});

test("96-image batch produces one completed row per image and a CSV", async ({ page }) => {
  test.setTimeout(240_000);
  const files = Array.from({ length: 96 }, () => a501);
  await open(page);
  await page.getByLabel("Choose images").setInputFiles(files);
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
  await open(page);
  await page.getByLabel("Choose images").setInputFiles([
    { ...source, name: "first.jpg" },
    { ...source, name: "second.jpg" },
  ]);
  await page.getByRole("button", { name: "Analyze images" }).click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeEnabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("status")).toHaveText("Batch cancelled.", { timeout: 80_000 });
});
