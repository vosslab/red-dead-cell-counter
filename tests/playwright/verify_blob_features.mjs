#!/usr/bin/env node
/** Compare every generated real-image mask through the deployed worker protocol. */
import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { REPO_ROOT } from "./repo_root.mjs";

const BASE_URL = process.argv[2] ?? "http://127.0.0.1:4188";
const OUTPUT = path.join(REPO_ROOT, "generated", "blob_feature_parity");
const STRIDE = 8;

function assertFeatures(expected, actual, image) {
  assert.equal(actual.length, expected.length, `${image}: feature length`);
  for (let index = 0; index < expected.length; index += 1) {
    const field = index % STRIDE;
    const wanted = expected[index];
    const received = actual[index];
    if (wanted === null) {
      assert.equal(received, "NaN", `${image}: feature ${index} should be NaN`);
    } else if (field <= 2) {
      assert.equal(received, wanted, `${image}: exact feature ${index}`);
    } else if (field <= 4) {
      assert.ok(Math.abs(received - wanted) <= 1e-7, `${image}: centroid feature ${index}`);
    } else if (field <= 6) {
      assert.ok(
        Math.abs(received - wanted) <= Math.max(1e-10, Math.abs(wanted) * 1e-8),
        `${image}: shape feature ${index}`,
      );
    } else {
      assert.ok(
        Math.abs(received - wanted) <= Math.max(1e-10, Math.abs(wanted) * 1e-6),
        `${image}: inertia feature ${index}`,
      );
    }
  }
}

async function main() {
  const expected = JSON.parse(await readFile(path.join(OUTPUT, "expected.json"), "utf8"));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/dist/`);
    const observed = await page.evaluate(
      async ({ expected }) => {
        const worker = new Worker("worker.js", { type: "module" });
        let nextId = 1;
        const request = (mask, width, height) =>
          new Promise((resolve, reject) => {
            const id = nextId++;
            const receive = (event) => {
              if (event.data.id !== id) return;
              worker.removeEventListener("message", receive);
              if (event.data.error) reject(new Error(event.data.error));
              else
                resolve(
                  Array.from(event.data.blobFeatures, (value) =>
                    Number.isNaN(value) ? "NaN" : value,
                  ),
                );
            };
            worker.addEventListener("message", receive);
            worker.postMessage({ id, kind: "blobs", mask: mask.buffer, width, height }, [
              mask.buffer,
            ]);
          });
        const frames = [];
        let previous = performance.now();
        let observing = true;
        const frame = (now) => {
          frames.push(now - previous);
          previous = now;
          if (observing) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        const results = {};
        try {
          for (const [image, entry] of Object.entries(expected)) {
            const mask = new Uint8Array(await (await fetch(`/${entry.mask}`)).arrayBuffer());
            const started = performance.now();
            results[image] = {
              features: await request(mask, entry.width, entry.height),
              worker_blob_ms: performance.now() - started,
            };
          }
        } finally {
          observing = false;
          worker.terminate();
        }
        return { results, frames };
      },
      { expected },
    );
    for (const [image, entry] of Object.entries(expected))
      assertFeatures(entry.features, observed.results[image].features, image);
    const frameSamples = observed.frames.slice(1);
    const orderedFrames = [...frameSamples].sort((left, right) => left - right);
    const metrics = Object.fromEntries(
      Object.entries(expected).map(([image, entry]) => [
        image,
        {
          native_blob_ms: entry.native_blob_ms,
          worker_blob_ms: observed.results[image].worker_blob_ms,
          feature_values: entry.features.length,
        },
      ]),
    );
    await writeFile(
      path.join(OUTPUT, "browser_metrics.json"),
      `${JSON.stringify(
        {
          images: metrics,
          rAF_interval_ms: frameSamples.length
            ? {
                median: orderedFrames[Math.floor(orderedFrames.length / 2)],
                max: Math.max(...frameSamples),
              }
            : null,
        },
        null,
        2,
      )}\n`,
    );
    console.log(
      `Chromium worker/Python parity passed for ${Object.keys(expected).length} real-image masks.`,
    );
  } finally {
    await browser.close();
    await Promise.all(
      Object.values(expected).map(async (entry) => {
        if (
          typeof entry.mask !== "string" ||
          !entry.mask.startsWith("generated/blob_feature_parity/") ||
          !entry.mask.endsWith(".mask")
        )
          throw new Error("unexpected temporary mask path");
        await rm(path.join(REPO_ROOT, entry.mask), { force: true });
        delete entry.mask;
      }),
    );
    await writeFile(path.join(OUTPUT, "expected.json"), `${JSON.stringify(expected, null, 2)}\n`);
  }
}

await main();
