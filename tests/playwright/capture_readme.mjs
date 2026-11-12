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
  await page.getByRole("button", { name: "Refine and count", exact: true }).waitFor();
}

async function count(page) {
  await page.getByRole("button", { name: "Refine and count", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#status")?.textContent?.includes("Automatic refinement finished"),
    undefined,
    { timeout: 230_000 },
  );
  assert.match(await page.locator("#selected-image-details").innerText(), /Refined count/);
  assert.match(await page.locator("#analysis-notice").innerText(), /experimental|provisional/i);
}

async function responsiveControls(page) {
  evidence.responsive = [];
  for (const width of [320, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1200 });
    const receipt = await page.evaluate(() => ({
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      controls: ["diameter", "k", "threshold", "comparison-runs", "analyze"].map((id) => {
        const rect = document.getElementById(id).getBoundingClientRect();
        return { id, x: rect.x, right: rect.right, width: rect.width };
      }),
    }));
    assert.ok(receipt.documentWidth <= width, `Page overflows at ${width}px.`);
    assert.ok(
      receipt.controls.every(
        (control) => control.x >= 0 && control.right <= width && control.width > 0,
      ),
    );
    evidence.responsive.push(receipt);
  }
}

async function frame(page, slug, label, options = {}) {
  const png = path.join(temporary, `${slug}.png`);
  const webp = path.join(temporary, `${slug}.webp`);
  await page.screenshot({ path: png, ...options });
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
  evidence.views[slug] = {
    label,
    pixels: { width, height },
    bytes: size.size,
    viewport: page.viewportSize(),
    ...(options.clip ? { clip: options.clip } : {}),
  };
}

async function centerOriginalPoint(page, x, y, visibleHeight) {
  await page.locator("#canvas-wrap").evaluate(
    (wrap, point) => {
      const canvas = wrap.querySelector("canvas");
      if (!canvas) throw new Error("The inspection canvas is unavailable.");
      const scale = canvas.getBoundingClientRect().width / canvas.width;
      wrap.scrollLeft = point.x * scale - wrap.clientWidth / 2;
      wrap.scrollTop = point.y * scale - (point.visibleHeight ?? wrap.clientHeight) / 2;
    },
    { x, y, visibleHeight },
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
  const settings = details.match(/diameter (\d+\.\d+) px, k (\d+\.\d+), threshold (\d+\.\d+)/);
  assert.ok(settings, "The actual applied settings must be visible.");
  const [, diameter, k, cutoff] = settings;
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
    Applied refinement trial: diameter ${diameter} px, k ${k}, threshold ${cutoff}.</p></header>
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
  Object.assign(evidence.views.viewer_views, {
    crop: processingCrop,
    diameter,
    k,
    cutoff,
    pixelChecks,
  });
  await guide.close();
}


async function captureMorphology(page, label, panel) {
  await page.waitForFunction(() => document.querySelectorAll("#challenge-cards article").length === 3 && document.querySelector("#challenge-status")?.textContent?.includes("Raw image crops"));
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download object measurements CSV", exact: true }).click();
  const downloaded = await pending;
  assert.equal(downloaded.suggestedFilename(), "object-measurements.csv");
  const csv = await readFile(await downloaded.path(), "utf8");
  const csvLines = csv.trim().split(/\r?\n/);
  const headers = csvLines.shift().split(",");
  const lines = csvLines.map(line => [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(match => match[1].replaceAll('""', '"')));
  // The shared exporter quotes every data field.
  const records = lines.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
  assert.ok(records.length > 0, "Object CSV must contain real measured objects.");
  const count = Number((await page.locator("#selected-image-count").innerText()).replaceAll(",", "").match(/\d+/)[0]);
  assert.equal(records.reduce((sum, row) => sum + Number(row.accepted_center_count), 0), count);
  const before = await page.locator("#morphology-panel").innerText();
  const threshold = await page.locator("#threshold").inputValue();
  await page.locator("#threshold").fill("0.12345");
  assert.equal(await page.locator("#morphology-panel").innerText(), before);
  await page.locator("#threshold").fill(threshold);
  const cards = await page.locator("#challenge-cards article").evaluateAll(elements => elements.map(card => ({ text: card.innerText, canvas: { width: card.querySelector("canvas").width, height: card.querySelector("canvas").height }, label: card.querySelector("canvas").getAttribute("aria-label") })));
  for (const card of cards) {
    const area = card.text.match(/Area ([\d,.]+) px/)[1].replaceAll(",", "");
    const centers = card.text.match(/(\d+) accepted center/)[1];
    const object = records.find(row => Number(row.area_px2) === Number(area) && row.accepted_center_count === centers);
    card.object = object;
  }
  const zoomBefore = await page.locator("#zoom").inputValue();
  await page.getByRole("button", { name: "Inspect this region", exact: true }).first().click();
  const zoomAfter = await page.locator("#zoom").inputValue();
  assert.notEqual(zoomBefore, zoomAfter);
  assert.equal(Number((await page.locator("#selected-image-count").innerText()).replaceAll(",", "").match(/\d+/)[0]), count);
  const receipt = { label, count, details: await page.locator("#selected-image-details").innerText(), panel: before, objects: records.length, acceptedCenterSum: count, cards, inspect: {zoomBefore, zoomAfter, countUnchanged: true}, records };
  evidence.morphology ??= [];
  evidence.morphology.push(receipt);
  await page.setViewportSize({ width: panel ? 600 : 760, height: 1400 });
  const target = page.locator(panel ? "#morphology-panel" : "#challenge-regions");
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  assert.ok(box);
  if (!panel) {
    const firstCard = await page.locator("#challenge-cards article").first().boundingBox();
    box.height = firstCard.y + firstCard.height - box.y;
  }
  await frame(page, panel ? "object_measurements" : "challenge_clusters", label, { clip: {x: Math.max(0, box.x - 3), y: Math.max(0, box.y - 8), width: box.width + 6, height: box.height + 16} });
  if (panel) Object.assign(evidence.views.object_measurements, { count, population: await page.locator("#morphology-population").innerText() });
}

async function responsiveMorphology(page) {
  evidence.morphologyResponsive = [];
  for (const width of [320, 768, 1440, 1920]) {
    await page.setViewportSize({width, height: 1200});
    const receipt = await page.evaluate(() => ({width: innerWidth, documentWidth: document.documentElement.scrollWidth, elements: [...document.querySelectorAll("#morphology-panel, #morphology-rows th, #morphology-rows td, #download-morphology, #challenge-regions, .challenge-card, .challenge-card canvas, .challenge-card button")].map(element => { const rect = element.getBoundingClientRect(); return {tag: element.tagName, text: element.textContent, left: rect.left, right: rect.right, width: rect.width}; })}));
    assert.ok(receipt.documentWidth <= width, `Morphology overflow at ${width}px`);
    assert.ok(receipt.elements.every(element => element.left >= 0 && element.right <= width && element.width > 0));
    evidence.morphologyResponsive.push(receipt);
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
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1600 },
      deviceScaleFactor: 1,
    });
    await page.setViewportSize({ width: 1920, height: 1200 });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    assert.ok((await page.request.get(new URL("morphology.css", baseUrl).toString())).ok());
    assert.equal(await page.title(), "Red Dead Cell Counter");
    await page.getByRole("button", { name: "Choose images", exact: true }).waitFor();
    await frame(
      page,
      "saloon",
      "Western saloon with direct Choose images and Try an example actions",
    );

    await page.setViewportSize({ width: 760, height: 1000 });
    const arrival = await page.locator(".saloon-intro").boundingBox();
    const title = await page.locator("#saloon-title").boundingBox();
    const privacy = await page.locator(".arrival-privacy").boundingBox();
    assert.ok(arrival && title && privacy);
    await frame(page, "workflow_choose", "Arrival actions: Choose images or Try an example", {
      clip: {
        x: arrival.x - 8,
        y: title.y - 16,
        width: arrival.width + 16,
        height: privacy.y + privacy.height - title.y + 24,
      },
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Try an example", exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("#status")?.textContent?.includes("Automatic refinement finished"),
      undefined,
      { timeout: 230_000 },
    );
    assert.match(await page.locator("#selected-image-name").innerText(), /A501/);
    assert.match(await page.locator("#selected-image-details").innerText(), /Refined count/);
    await page.setViewportSize({ width: 850, height: 1000 });
    await page.locator("#zoom").fill("450");
    await centerOriginalPoint(page, 2000, 2100, 280);
    await page.locator("#image-inspection").scrollIntoViewIfNeeded();
    const inspection = await page.locator("#image-inspection").boundingBox();
    assert.ok(inspection);
    await frame(page, "workflow_inspect", "A501 automatic count and actual green detection rings", {
      clip: {
        x: inspection.x,
        y: inspection.y,
        width: inspection.width,
        height: 600,
      },
    });
    Object.assign(evidence.views.workflow_inspect, {
      count: await page.locator("#selected-image-count").innerText(),
      details: await page.locator("#selected-image-details").innerText(),
      notice: await page.locator("#analysis-notice").innerText(),
    });
    await page.setViewportSize({ width: 1440, height: 1600 });
    await page.locator("#zoom").fill("450");
    await centerOriginalPoint(page, 2000, 2100);
    await page
      .locator(".controls")
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
      layout: await page.evaluate(() =>
        [
          ".controls",
          "#comparison",
          "#comparison-highlights",
          "#image-inspection",
          "#canvas-wrap",
        ].map((selector) => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }),
      ),
    });
    await processingGuide(browser, page);
    await captureMorphology(page, "A501 refined", true);
    await page.setViewportSize({ width: 1440, height: 1600 });

    // The example already performed the default 21 trials; capture that saved refinement.
    await page.locator(".trial-details").evaluate((details) => {
      details.open = true;
    });
    await page.waitForFunction(
      () =>
        document.querySelector("#comparison-progress")?.getAttribute("value") === "21" &&
        !document.querySelector("#compare")?.disabled,
      undefined,
      { timeout: 230_000 },
    );
    assert.equal(await page.locator("#comparison-rows tr").count(), 21);
    assert.match(await page.locator("#comparison-status").innerText(), /21 successful, 0 failed/);
    assert.equal(await page.locator("#comparison-highlights").isVisible(), true);
    await page
      .locator("#comparison")
      .evaluate((element) => window.scrollTo({ top: element.offsetTop - 12 }));
    await frame(
      page,
      "comparison",
      "A501 automatic refinement with sensitivity statistics and 21 actual trial rows",
    );
    evidence.views.comparison.statistics = await page.locator("#comparison-highlights").innerText();
    evidence.views.comparison.trialRows = await page.locator("#comparison-rows tr").count();
    evidence.views.comparison.status = await page.locator("#comparison-status").innerText();
    await page.close();

    const batch = await browser.newPage({
      viewport: { width: 1440, height: 1600 },
      deviceScaleFactor: 1,
    });
    await batch.goto(baseUrl, { waitUntil: "networkidle" });
    await choose(batch, [image("A501"), image("H501")]);
    await responsiveControls(batch);
    await batch.setViewportSize({ width: 760, height: 1000 });
    await batch.locator(".controls").scrollIntoViewIfNeeded();
    const controls = await batch.locator(".controls").boundingBox();
    assert.ok(controls);
    assert.equal(
      await batch.getByRole("button", { name: "Refine and count", exact: true }).isEnabled(),
      true,
    );
    assert.equal(
      await batch.getByRole("button", { name: "Download CSV", exact: true }).isEnabled(),
      false,
    );
    await frame(
      batch,
      "workflow_count",
      "Two images selected, visible starting settings, ready to Refine and count",
      {
        clip: controls,
      },
    );
    assert.equal(await batch.locator("#comparison-runs").inputValue(), "21");
    evidence.views.workflow_count.files = ["A501.jpg", "H501.jpg"];
    evidence.views.workflow_count.selection = await batch
      .locator("#image-selection-summary")
      .innerText();
    await batch.setViewportSize({ width: 1440, height: 1600 });
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
    assert.match(
      csv,
      /algorithm_version,method,mode,review_reasons,no_signal,refinement_runs_requested,refinement_runs_successful,refinement_runs_failed,seed_method,seed_threshold,count_mean,count_median,count_sd,count_min,count_max/,
    );
    assert.equal(csv.split(/\r?\n/)[0].split(",").length, 35);
    assert.equal((csv.match(/"dog-refinement-1"/g) ?? []).length, 2);
    assert.equal(
      (csv.match(/"dog_ccd_median","automatic","provisional_refinement/g) ?? []).length,
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
    await batch.locator("#rows button").filter({ hasText: "H501.jpg" }).click();
    await batch.locator("#diameter").fill("10");
    await batch.locator("#k").fill("4");
    await batch.locator("#threshold").fill("0.1");
    await batch.getByRole("button", { name: "Count once with these settings", exact: true }).click();
    await batch.waitForFunction(() => !document.querySelector("#analyze")?.disabled && document.querySelector("#selected-image-details")?.textContent?.includes("0.10000"), undefined, { timeout: 230_000 });
    await captureMorphology(batch, "H501 manual d10 k4 t0.10000", false);
    await responsiveMorphology(batch);
    await batch.close();
  } finally {
    await browser.close();
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
}

await main();
