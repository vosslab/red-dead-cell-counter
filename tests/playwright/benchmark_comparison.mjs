import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { chromium } from "playwright";

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function assetBytes(path) {
  const bytes = await readFile(path);
  return { raw: bytes.length, gzip: gzipSync(bytes).length };
}

function outcomes(rows) {
  return rows.map(([diameter, k, threshold, count, _elapsed, kind]) => [
    diameter,
    k,
    threshold,
    count,
    kind,
  ]);
}

async function main() {
  const label = process.argv[2];
  if (label !== "baseline" && label !== "optimized")
    throw new Error("Use: node tests/playwright/benchmark_comparison.mjs baseline|optimized");
  const baseUrl = "http://127.0.0.1:4184/dist/";
  const imageNames = ["A501.jpg", "H501.jpg"];
  const browser = await chromium.launch({ headless: true });
  try {
    const report = {
      label,
      baseUrl,
      node: process.version,
      machine: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model },
      chromium: browser.version(),
      images: [],
      assets: {
        wasm: await assetBytes("dist/wasm/cell_detector_bg.wasm"),
        worker: await assetBytes("dist/worker.js"),
      },
    };

    for (const imageName of imageNames) {
      for (let repeat = 1; repeat <= 2; repeat += 1) {
        const page = await browser.newPage();
        page.on("pageerror", (error) => {
          throw error;
        });
        await page.addInitScript(() => {
          const OriginalWorker = window.Worker;
          window.__comparisonBenchmark = {
            workerMessages: 0,
            rgbaBytes: 0,
            raf: [],
            longTasks: [],
          };
          window.Worker = class extends OriginalWorker {
            constructor(...args) {
              super(...args);
              const post = this.postMessage.bind(this);
              this.postMessage = (message, transfer) => {
                if (message && "rgba" in message && message.rgba instanceof ArrayBuffer) {
                  window.__comparisonBenchmark.workerMessages += 1;
                  window.__comparisonBenchmark.rgbaBytes += message.rgba.byteLength;
                }
                return post(message, transfer);
              };
            }
          };
          new PerformanceObserver((entries) => {
            window.__comparisonBenchmark.longTasks.push(
              ...entries.getEntries().map((entry) => entry.duration),
            );
          }).observe({ type: "longtask", buffered: true });
          let previous;
          const tick = (now) => {
            if (previous !== undefined) window.__comparisonBenchmark.raf.push(now - previous);
            previous = now;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        await page.goto(baseUrl);
        await page.getByRole("button", { name: "Enter saloon" }).click();
        await page.getByLabel(/^Choose image$/).setInputFiles(`IMAGES/${imageName}`);
        const started = performance.now();
        await page.getByRole("button", { name: "Compare settings", exact: true }).click();
        await page.locator("#comparison-progress").waitFor({ state: "visible" });
        await page.waitForFunction(
          () => document.querySelector("#comparison-progress")?.getAttribute("value") === "21",
          undefined,
          { timeout: 180_000 },
        );
        await page.getByRole("button", { name: "Compare settings", exact: true }).waitFor({
          state: "visible",
        });
        await page.waitForFunction(
          () => !document.querySelector("#compare")?.hasAttribute("disabled"),
          undefined,
          { timeout: 30_000 },
        );
        const elapsed = performance.now() - started;
        const rows = await page
          .locator("#comparison-rows tr")
          .evaluateAll((elements) =>
            elements.map((row) =>
              Array.from(row.querySelectorAll("td"), (cell) => cell.textContent?.trim()),
            ),
          );
        const metrics = await page.evaluate(() => window.__comparisonBenchmark);
        assert.equal(rows.length, 21, "comparison must complete all 21 runs");
        report.images.push({
          imageName,
          repeat,
          elapsed,
          rows,
          metrics: {
            ...metrics,
            rafMedian: median(metrics.raf),
            rafWorst: Math.max(0, ...metrics.raf),
            longTaskMax: Math.max(0, ...metrics.longTasks),
          },
          perRunMedian: median(
            rows.map((row) => Number.parseFloat(row[4]?.replace(" ms", "") ?? "NaN")),
          ),
        });
        await page.close();
      }
    }
    report.wholeComparisonMedian = median(report.images.map(({ elapsed }) => elapsed));
    if (label === "optimized") {
      const baseline = JSON.parse(
        await readFile("generated/comparison_benchmark_baseline.json", "utf8"),
      );
      for (const optimized of report.images) {
        const baselineRun = baseline.images.find(
          (candidate) =>
            candidate.imageName === optimized.imageName && candidate.repeat === optimized.repeat,
        );
        assert(
          baselineRun,
          `missing baseline for ${optimized.imageName} repeat ${optimized.repeat}`,
        );
        assert.deepEqual(
          outcomes(optimized.rows),
          outcomes(baselineRun.rows),
          `comparison settings, counts, or design kinds changed for ${optimized.imageName}`,
        );
      }
    }
    const output = `generated/comparison_benchmark_${label}.json`;
    await mkdir("generated", { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      JSON.stringify(
        {
          output,
          images: report.images.map(({ imageName, repeat, elapsed, metrics }) => ({
            imageName,
            repeat,
            elapsed: Math.round(elapsed),
            workerMessages: metrics.workerMessages,
            rgbaBytes: metrics.rgbaBytes,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

await main();
