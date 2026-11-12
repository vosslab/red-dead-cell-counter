import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { REPO_ROOT } from "./repo_root.mjs";

const exec = promisify(execFile);
const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:4188/").toString();
const temporary = "/private/tmp/red_dead_cell_counter_readme";
const screenshots = path.join(REPO_ROOT, "docs", "screenshots");
const evidencePath = path.join(REPO_ROOT, "generated", "readme_screenshot_capture.json");
const image = (name) => path.join(REPO_ROOT, "IMAGES", `${name}.jpg`);
const evidence = { captureTime: new Date().toISOString(), baseUrl, views: {} };
const processingCrop = { x: 1600, y: 1800, width: 800, height: 600 };

async function choose(page, files) {
  await page.getByLabel("Choose microscopy images", { exact: true }).setInputFiles(files);
  await page.locator("#image-inspection").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Count cells", exact: true }).waitFor();
}

async function count(page) {
  await page.getByRole("button", { name: "Count cells", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#status")?.textContent?.includes("Automatic counting finished"),
    undefined,
    { timeout: 230_000 },
  );
  assert.match(await page.locator("#selected-image-details").innerText(), /binary_otsu/);
  assert.match(await page.locator("#analysis-notice").innerText(), /Provisional/);
}

async function frame(page, slug, label) {
  const png = path.join(temporary, `${slug}.png`);
  const webp = path.join(temporary, `${slug}.webp`);
  await page.screenshot({ path: png });
  await exec("cwebp", ["-q", "90", png, "-o", webp]);
  const target = path.join(screenshots, `${slug}.webp`);
  const [{ stdout }, size] = await Promise.all([
    exec("magick", ["identify", "-format", "%w %h", webp]),
    stat(webp),
  ]);
  const [width, height] = stdout.trim().split(" ").map(Number);
  assert.ok(Math.max(width, height) <= 1920, `${slug} exceeds the 1920 px edge limit.`);
  assert.ok(size.size < 1_000_000, `${slug} exceeds the 1 MB screenshot budget.`);
  await copyFile(webp, target);
  await unlink(png);
  evidence.views[slug] = { label, pixels: { width, height }, bytes: size.size };
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

async function viewerTile(page, view, detections) {
  await page.getByLabel("Show detections").setChecked(detections);
  await page.getByRole("tab", { name: view, exact: true }).click();
  const status =
    view === "Raw"
      ? "Raw original RGB image"
      : view === "DoG"
        ? "DoG response"
        : "Binary threshold";
  await page.waitForFunction(
    (text) => document.querySelector("#image-view-status")?.textContent?.includes(text),
    status,
  );
  const ready = await page.waitForFunction(
    ({ crop, view, detections }) => {
      const canvas = document.querySelector("#image");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      const region = context.getImageData(crop.x, crop.y, crop.width, crop.height);
      let colored = 0;
      let intermediate = 0;
      let green = 0;
      let white = 0;
      for (let i = 0; i < region.data.length; i += 4) {
        const r = region.data[i],
          g = region.data[i + 1],
          b = region.data[i + 2];
        if (r !== g || g !== b) colored++;
        if (r !== 0 && r !== 255) intermediate++;
        if (g > r + 30 && g > b + 30) green++;
        if (r === 255) white++;
      }
      if (green > 0 !== detections) return false;
      if (view === "Raw" ? colored === 0 : colored > 0) return false;
      if (view === "DoG" && intermediate === 0) return false;
      if (
        view === "Threshold" &&
        (intermediate > 0 || white === 0 || white === crop.width * crop.height)
      )
        return false;
      const output = document.createElement("canvas");
      output.width = crop.width;
      output.height = crop.height;
      output.getContext("2d").putImageData(region, 0, 0);
      return { image: output.toDataURL(), colored, intermediate, green, white };
    },
    { crop: processingCrop, view, detections },
  );
  return ready.jsonValue();
}

async function processingGuide(browser, page) {
  const details = await page.locator("#selected-image-details").innerText();
  const cutoff = details.match(/threshold (\d+\.\d+)/)?.[1];
  assert.ok(cutoff, "The actual automatic cutoff must be visible.");
  const tiles = [
    ["1. Raw fluorescence", "Original red signal: compare bright and faint spots.", "Raw", false],
    ["2. DoG response", "Cell-sized contrast; display brightness is stretched.", "DoG", false],
    [
      "3. Threshold mask",
      `White = DoG response at or above ${cutoff}. Candidate pixels, not counts.`,
      "Threshold",
      false,
    ],
    [
      "4. Counted centers",
      "Green rings mark peaks retained by the cutoff and spacing rule.",
      "Raw",
      true,
    ],
  ];
  const panels = [];
  const pixelChecks = [];
  for (const [title, caption, view, detections] of tiles) {
    const { image, ...checks } = await viewerTile(page, view, detections);
    pixelChecks.push({ view, detections, ...checks });
    panels.push(
      `<section><h2>${title}</h2><p>${caption}</p><img src="${image}" alt="${title}"></section>`,
    );
  }
  const guide = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await guide.setContent(`<style>
    * { box-sizing: border-box; } body { margin: 0; padding: 22px; background: #211007;
      color: #f3ddb0; font: 20px Arial, sans-serif; } h1 { margin: 0 0 8px; font-size: 34px; }
    header p { margin: 0 0 16px; } main { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    section { padding: 12px; border: 2px solid #84502c; background: #150c07; }
    h2 { margin: 0 0 6px; font-size: 26px; } section p { margin: 0 0 8px; font-size: 17px; }
    img { display: block; width: 100%; height: 310px; object-fit: contain; background: #000;
      image-rendering: pixelated; } footer { margin-top: 12px; font-size: 18px; }
  </style><header><h1>From red fluorescence to counted centers</h1>
    <p>The same A501 field in every panel: ${processingCrop.width} x ${processingCrop.height} original pixels.
    Automatic binary Otsu cutoff ${cutoff}; diameter 10 px, k 4.</p></header>
    <main>${panels.join("")}</main><footer>Labeled crops from actual app outputs.
    White regions can contain several centers; inspect the raw image before using the count.</footer>`);
  await guide
    .locator("img")
    .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  await frame(
    guide,
    "viewer_views",
    "Same A501 field: raw fluorescence, DoG response, threshold mask, and counted centers",
  );
  Object.assign(evidence.views.viewer_views, { crop: processingCrop, cutoff, pixelChecks });
  await guide.close();
}

async function main() {
  await Promise.all([
    mkdir(temporary, { recursive: true }),
    mkdir(screenshots, { recursive: true }),
    mkdir(path.dirname(evidencePath), { recursive: true }),
  ]);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
    });
    await page.setViewportSize({ width: 1920, height: 1200 });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    assert.equal(await page.title(), "Red Dead Cell Counter");
    await page.getByRole("button", { name: "Choose images", exact: true }).waitFor();
    await frame(
      page,
      "saloon",
      "Western saloon with direct Choose images and Try an example actions",
    );

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Try an example", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#status")?.textContent?.includes("Automatic counting finished"),
      undefined,
      { timeout: 230_000 },
    );
    assert.match(await page.locator("#selected-image-name").innerText(), /A501/);
    assert.match(await page.locator("#selected-image-details").innerText(), /binary_otsu/);
    await page.locator("#zoom").fill("450");
    await centerOriginalPoint(page, 2000, 2100);
    await page
      .locator(".image-panel")
      .evaluate((element) => window.scrollTo({ top: element.offsetTop - 12 }));
    await frame(
      page,
      "counter",
      "A501 automatic count with actual cutoff, provisional notice, and green detection markers",
    );
    Object.assign(evidence.views.counter, {
      count: await page.locator("#selected-image-count").innerText(),
      details: await page.locator("#selected-image-details").innerText(),
      notice: await page.locator("#analysis-notice").innerText(),
    });
    await processingGuide(browser, page);

    await page.locator("#advanced-settings > summary").click();
    await page
      .getByRole("button", { name: "Compare settings on selected image", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector("#comparison-progress")?.getAttribute("value") === "21" &&
        !document.querySelector("#compare")?.disabled,
      undefined,
      { timeout: 230_000 },
    );
    assert.equal(await page.locator("#comparison-rows tr").count(), 21);
    assert.match(
      await page.locator("#comparison-status").innerText(),
      /21 successful and 0 failed/,
    );
    assert.equal(await page.locator("#comparison-highlights").isVisible(), true);
    await page
      .locator("#comparison")
      .evaluate((element) => window.scrollTo({ top: element.offsetTop - 12 }));
    await frame(
      page,
      "comparison",
      "Advanced A501 manual comparison with sensitivity statistics and 21 actual trial rows",
    );
    evidence.views.comparison.statistics = await page.locator("#comparison-highlights").innerText();
    await page.close();

    const batch = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
    });
    await batch.goto(baseUrl, { waitUntil: "networkidle" });
    await choose(batch, [image("A501"), image("H501")]);
    await count(batch);
    await batch.locator("#rows button").filter({ hasText: "A501.jpg" }).click();
    await batch.waitForFunction(() => !document.querySelector("#analyze")?.disabled);
    await batch.locator("#zoom").fill("300");
    await centerOriginalPoint(batch, 2000, 2100);
    await batch.evaluate(() => window.scrollTo(0, 0));
    const pending = batch.waitForEvent("download");
    await batch.getByRole("button", { name: "Download CSV", exact: true }).click();
    const download = await pending;
    assert.equal(download.suggestedFilename(), "dead-cell-counts.csv");
    const downloaded = await download.path();
    assert.ok(downloaded);
    const csv = await readFile(downloaded, "utf8");
    assert.match(csv, /algorithm_version,method,mode,review_reasons,no_signal/);
    assert.equal(
      (csv.match(/"binary_otsu","automatic","provisional_calibration"/g) ?? []).length,
      2,
    );
    await frame(
      batch,
      "batch",
      "Two-image automatic ledger with independent saved cutoffs and CSV export",
    );
    Object.assign(evidence.views.batch, {
      rows: await batch.locator("#rows tr").allTextContents(),
      csv,
    });
    await batch.close();
  } finally {
    await browser.close();
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
}

await main();
