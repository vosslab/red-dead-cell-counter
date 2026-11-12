import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { REPO_ROOT } from "./repo_root.mjs";

const exec = promisify(execFile);
const root = REPO_ROOT;
const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:4188/").toString();
const temporary = "/private/tmp/red_dead_cell_counter_readme";
const screenshots = path.join(root, "docs", "screenshots");
const evidencePath = path.join(root, "generated", "readme_screenshot_capture.json");
const images = {
  a501: path.join(root, "IMAGES", "A501.jpg"),
  h501: path.join(root, "IMAGES", "H501.jpg"),
};
const evidence = { captureTime: new Date().toISOString(), baseUrl, views: {}, live: {} };
const processingCrop = { x: 1900, y: 1900, width: 300, height: 300 };

function fail(message) {
  throw new Error(message);
}

async function expectText(locator, expected, timeout = 90_000) {
  await locator.waitFor({ state: "visible", timeout });
  const deadline = Date.now() + timeout;
  while (!(await locator.textContent())?.includes(expected)) {
    if (Date.now() > deadline) fail(`Timed out waiting for ${JSON.stringify(expected)}.`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function enter(page, workflow = "single") {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(await page.title(), "Red Dead Cell Counter");
  await page.getByRole("button", { name: "Enter saloon" }).click();
  if (workflow === "batch") await page.getByRole("radio", { name: "Batch", exact: true }).check();
}

async function choose(page, files) {
  await page.getByLabel(/^Choose images?$/).setInputFiles(files);
}

async function completeComparison(page) {
  await page.getByRole("button", { name: "Compare settings", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#comparison-progress")?.getAttribute("value") === "21",
    undefined,
    { timeout: 180_000 },
  );
  await page
    .getByRole("button", { name: "Compare settings", exact: true })
    .waitFor({ state: "visible" });
  assert.equal(await page.locator("#comparison-rows tr").count(), 21);
}

async function centerOriginalPoint(page, x, y) {
  await page.locator("#canvas-wrap").evaluate(
    (wrap, point) => {
      const canvas = wrap.querySelector("canvas");
      if (!canvas) throw new Error("The inspection canvas is unavailable.");
      const scale = canvas.getBoundingClientRect().width / canvas.width;
      wrap.scrollLeft = point.x * scale - wrap.clientWidth / 2;
      wrap.scrollTop = point.y * scale - wrap.clientHeight / 2;
    },
    { x, y },
  );
}

async function pageFrame(page, slug, label, clip) {
  const png = path.join(temporary, `${slug}.png`);
  await page.screenshot({ path: png, ...(clip ? { clip } : {}) });
  const webp = path.join(temporary, `${slug}.webp`);
  await exec("cwebp", ["-q", "90", png, "-o", webp]);
  const target = path.join(screenshots, `${slug}.webp`);
  await copyFile(webp, target);
  const [geometry, size] = await Promise.all([
    exec("magick", ["identify", "-format", "%w x %h", webp]).then(({ stdout }) => stdout.trim()),
    stat(target),
  ]);
  const [width, height] = geometry.split(" x ").map(Number);
  assert.ok(Math.max(width, height) <= 1920, `${slug} exceeds the 1920 px edge limit.`);
  assert.ok(size.size < 1_000_000, `${slug} is larger than the 1 MB documentation budget.`);
  evidence.views[slug] = { label, pixels: { width, height }, bytes: size.size };
}

async function imagePanelFrame(page, slug, label) {
  const panel = page.locator(".image-panel");
  await panel.evaluate((element) => window.scrollTo({ top: element.offsetTop - 12 }));
  const box = await panel.boundingBox();
  if (!box) fail("Image panel has no bounding box.");
  const viewport = page.viewportSize();
  if (!viewport) fail("Capture viewport is unavailable.");
  await pageFrame(page, slug, label, {
    x: 0,
    y: Math.max(0, Math.floor(box.y - 12)),
    width: viewport.width,
    height: Math.min(1050, viewport.height, Math.ceil(viewport.height - Math.max(0, box.y - 12))),
  });
}

async function sectionFrame(page, selector, slug, label) {
  const section = page.locator(selector);
  await section.evaluate((element) => window.scrollTo({ top: element.offsetTop - 12 }));
  const box = await section.boundingBox();
  if (!box) fail(`${selector} has no bounding box.`);
  const viewport = page.viewportSize();
  if (!viewport) fail("Capture viewport is unavailable.");
  await pageFrame(page, slug, label, {
    x: 0,
    y: Math.max(0, Math.floor(box.y - 12)),
    width: viewport.width,
    height: Math.min(850, viewport.height, Math.ceil(viewport.height - Math.max(0, box.y - 12))),
  });
}

async function viewerTile(page, view, detections = false) {
  await page.getByLabel("Show detections").setChecked(detections);
  await page.getByRole("tab", { name: view, exact: true }).click();
  const status =
    view === "DoG"
      ? "DoG response, contrast-stretched for display"
      : view === "Threshold"
        ? "Binary threshold: raw DoG response at or above cutoff"
        : "Raw original RGB image.";
  await page.waitForFunction(
    (expected) => document.querySelector("#image-view-status")?.textContent?.includes(expected),
    status,
  );
  const rendered = await page.waitForFunction(
    ({ crop, detections }) => {
      const canvas = document.querySelector("#image");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      const region = context.getImageData(crop.x, crop.y, crop.width, crop.height);
      let colored = 0;
      let intermediate = 0;
      let green = 0;
      let white = 0;
      for (let index = 0; index < region.data.length; index += 4) {
        const [r, g, b] = region.data.slice(index, index + 3);
        if (r !== g || g !== b) colored++;
        if (r !== 0 && r !== 255) intermediate++;
        if (g > r + 30 && g > b + 30) green++;
        if (r === 255) white++;
      }
      // Raw redraws asynchronously after the overlay checkbox changes.
      if (green > 0 !== detections) return false;
      const output = document.createElement("canvas");
      output.width = crop.width;
      output.height = crop.height;
      output.getContext("2d").putImageData(region, 0, 0);
      return { image: output.toDataURL(), colored, intermediate, green, white };
    },
    { crop: processingCrop, detections },
  );
  const tile = await rendered.jsonValue();
  if (view === "Raw") assert.ok(tile.colored > 0, "Raw crop lost its color image.");
  else {
    assert.equal(tile.colored, 0, `${view} crop is not grayscale.`);
    if (view === "Threshold") {
      assert.equal(tile.intermediate, 0, "Threshold crop is not binary.");
      assert.ok(tile.white > 0 && tile.white < processingCrop.width * processingCrop.height);
    } else assert.ok(tile.intermediate > 0, "DoG crop has no grayscale response.");
  }
  if (detections) assert.ok(tile.green > 0, "Counted-center crop has no detection rings.");
  else assert.equal(tile.green, 0, "An intermediate crop includes detection rings.");
  return tile.image;
}

async function verifyLive(browser) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const liveUrl = "https://vosslab.github.io/red-dead-cell-counter/";
  try {
    const response = await page.goto(liveUrl, { waitUntil: "networkidle", timeout: 60_000 });
    assert.equal(response?.ok(), true, "GitHub Pages did not return a successful response.");
    assert.equal(await page.title(), "Red Dead Cell Counter");
    await page.getByRole("button", { name: "Enter saloon" }).click();
    await choose(page, images.a501);
    const selected = await page.locator("#image-selection-summary").textContent();
    assert.match(selected ?? "", /A501\.jpg/);
    await page.getByRole("button", { name: "Analyze selected image", exact: true }).click();
    await page.waitForFunction(
      () => {
        const count = document.querySelector("#selected-image-count")?.textContent?.trim();
        return Boolean(count && count !== "--");
      },
      undefined,
      { timeout: 120_000 },
    );
    evidence.live = {
      url: liveUrl,
      httpStatus: response?.status(),
      title: await page.title(),
      selected,
      a501Count: await page.locator("#selected-image-count").textContent(),
    };
  } catch (error) {
    evidence.live = { url: liveUrl, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await page.close();
  }
}

async function main() {
  await Promise.all([
    mkdir(temporary, { recursive: true }),
    mkdir(screenshots, { recursive: true }),
    mkdir(path.dirname(evidencePath), { recursive: true }),
  ]);
  const browser = await chromium.launch({ headless: true });
  try {
    const saloon = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await saloon.goto(baseUrl, { waitUntil: "networkidle" });
    assert.equal(await saloon.title(), "Red Dead Cell Counter");
    await pageFrame(saloon, "saloon", "Western entry screen before image selection");
    await saloon.close();

    const counter = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
      deviceScaleFactor: 1,
    });
    await enter(counter);
    await choose(counter, images.h501);
    await completeComparison(counter);
    await expectText(counter.locator("#selected-image-count"), "3,021");
    await counter.locator("#zoom").fill("350");
    await centerOriginalPoint(counter, 2100, 2100);
    await imagePanelFrame(counter, "counter", "H501 counted with the comparison-selected settings");
    evidence.views.counter.count = await counter.locator("#selected-image-count").textContent();

    await sectionFrame(
      counter,
      "#comparison",
      "comparison",
      "H501 setting comparison with count statistics and design rows",
    );
    evidence.views.comparison.rows = await counter.locator("#comparison-rows tr").count();
    evidence.views.comparison.statistics = await counter
      .locator("#comparison-highlights")
      .innerText();
    await counter.close();

    const batch = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await enter(batch, "batch");
    await choose(batch, [images.h501, images.a501]);
    await batch.getByRole("button", { name: "Analyze images", exact: true }).click();
    await expectText(batch.locator("#status"), "Analysis complete.", 120_000);
    const batchRows = await batch.locator("#rows tr").allTextContents();
    assert.ok(
      batchRows.some((row) => /H501\.jpg.*3,?021.*Done/s.test(row)),
      `H501 did not count as 3,021: ${batchRows.join(" | ")}`,
    );
    assert.ok(
      batchRows.some((row) => /A501\.jpg.*339.*Done/s.test(row)),
      `A501 did not count as 339: ${batchRows.join(" | ")}`,
    );
    const download = batch.waitForEvent("download");
    await batch.getByRole("button", { name: "Download CSV", exact: true }).click();
    const csv = await download;
    assert.equal(csv.suggestedFilename(), "dead-cell-counts.csv");
    const downloaded = await csv.path();
    if (!downloaded) fail("Batch CSV download has no local path.");
    const csvContent = await readFile(downloaded, "utf8");
    assert.match(csvContent, /"H501\.jpg"[^\n]*,"3021",/);
    assert.match(csvContent, /"A501\.jpg"[^\n]*,"339",/);
    await batch.locator(".results-panel").scrollIntoViewIfNeeded();
    await pageFrame(batch, "batch", "Batch ledger with completed H501 and A501 image counts");
    evidence.views.batch.rows = batchRows;
    await batch.close();

    const viewer = await browser.newPage({
      viewport: { width: 640, height: 1050 },
      deviceScaleFactor: 1,
    });
    await enter(viewer);
    await choose(viewer, images.h501);
    await viewer.getByRole("button", { name: "Analyze selected image", exact: true }).click();
    await expectText(viewer.locator("#status"), "Selected image analysis complete.", 120_000);
    const tiles = [
      ["1. Raw fluorescence", "Original red signal, including faint spots.", "Raw", false],
      ["2. DoG response", "Cell-scale contrast: brighter means a stronger response.", "DoG", false],
      [
        "3. Threshold mask",
        "White = response >= 0.10000. These are candidate pixels.",
        "Threshold",
        false,
      ],
      [
        "4. Counted centers",
        "Green rings = peaks passing the cutoff and spacing rule.",
        "Raw",
        true,
      ],
    ];
    const panels = [];
    for (const [title, caption, view, detections] of tiles) {
      const image = await viewerTile(viewer, view, detections);
      panels.push(
        `<section><h2>${title}</h2><p>${caption}</p><img src="${image}" alt="${title}"></section>`,
      );
    }
    const guide = await browser.newPage({ viewport: { width: 1280, height: 1280 } });
    await guide.setContent(`<style>
      * { box-sizing: border-box; } body { margin: 0; padding: 24px; background: #211007;
        color: #f3ddb0; font: 18px Arial, sans-serif; } h1 { margin: 0 0 10px; font-size: 34px; }
      header p { margin: 0 0 22px; } main { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      section { padding: 16px; border: 2px solid #84502c; background: #150c07; }
      h2 { margin: 0 0 8px; font-size: 27px; } section p { margin: 0 0 14px; font-size: 17px; }
      img { display: block; width: 100%; height: 410px; object-fit: contain; background: #000;
        image-rendering: pixelated; } footer { margin-top: 18px; font-size: 18px; }
    </style><header><h1>From red fluorescence to counted centers</h1>
      <p>Same H501 field in every panel: 300 x 300 pixels. Diameter 10 px, k 4, cutoff 0.10000.</p>
    </header><main>${panels.join("")}</main><footer>
      White regions are not the count. Compare the joined objects with the green picked centers.<br>
      Labeled crops from actual app outputs; the headings explain each processing step.
    </footer>`);
    await guide
      .locator("img")
      .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
    await pageFrame(
      guide,
      "viewer_views",
      "Same H501 field: raw fluorescence, DoG response, threshold mask, and counted centers",
    );
    evidence.views.viewer_views.crop = processingCrop;
    evidence.views.viewer_views.panels = tiles.map(([title]) => title);
    await guide.close();
    await viewer.close();

    await verifyLive(browser);
  } finally {
    await browser.close();
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
}

await main();
