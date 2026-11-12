import assert from "node:assert/strict";
import test from "node:test";
import { refineImage } from "../src/refine_image.ts";
import { comparisonDesign } from "../src/experiment_design.ts";
import { chooseRepresentative } from "../src/choose_representative.ts";

const starting = { diameter: 10, k: 4, threshold: Math.fround(0.1) };
const image = { rgba: new Uint8ClampedArray(16), width: 2, height: 2 };
const seedAnalysis = {
  settings: starting,
  mode: "automatic",
  method: "dog_otsu",
  version: "seed",
  reviewReasons: ["provisional_calibration"],
  noSignal: false,
};
const hooks = { stopped: () => false, onStart: () => {}, onRun: () => {} };

test("refinement records failed and zero-count trials, then freshly reruns an actual median trial", async () => {
  const candidates = comparisonDesign(starting, 21);
  const calls = [];
  let seeded = false;
  const client = {
    async processAutomatic(id, rgba, width, height, initial) {
      assert.equal(rgba, image.rgba);
      assert.deepEqual([width, height, initial], [2, 2, { diameter: 10, k: 4 }]);
      seeded = true;
      return {
        id,
        kind: "automatic",
        ok: true,
        centers: new Float32Array([99, 99]),
        analysis: seedAnalysis,
      };
    },
    async process(id, rgba, width, height, settings) {
      assert.ok(seeded);
      assert.equal(rgba, undefined, "only the seed transfers fresh RGBA");
      assert.deepEqual([width, height], [2, 2]);
      const index = calls.length;
      calls.push({ id, settings });
      if (index === 2) return { id, kind: "detect", ok: false, error: "bad trial" };
      const count = index === 21 ? 3 : index % 5;
      return { id, kind: "detect", ok: true, centers: new Float32Array(count * 2).fill(index) };
    },
  };
  const updates = [];
  const result = await refineImage(client, 100, image, { diameter: 10, k: 4 }, 21, {
    ...hooks,
    onStart(points, seed) {
      assert.deepEqual(points, candidates);
      assert.deepEqual(seed, starting);
    },
    onRun(runs, completed, total) {
      updates.push([runs.length, completed, total]);
    },
  });
  assert.equal(calls.length, 22);
  assert.deepEqual(
    calls.map((call) => call.id),
    Array.from({ length: 22 }, (_, index) => 101 + index),
  );
  const refinement = result.analysis.refinement;
  assert.equal(refinement.runs.length, 21);
  assert.equal(refinement.runs[0].count, 0, "zero is a successful count");
  assert.equal(refinement.runs[2].error, "bad trial");
  assert.equal(refinement.runs[2].count, undefined);
  const successful = refinement.runs.flatMap((run, index) =>
    run.count === undefined ? [] : [{ ...run.settings, count: run.count, index }],
  );
  const selected = successful[chooseRepresentative(successful)];
  assert.equal(refinement.representativeIndex, selected.index);
  assert.equal(refinement.selectedIndex, selected.index);
  for (const key of ["diameter", "k", "threshold"])
    assert.equal(calls[21].settings[key], candidates[selected.index][key]);
  assert.deepEqual(
    result.centers,
    new Float32Array(6).fill(21),
    "return fresh final centers, never seed or trial centers",
  );
  assert.deepEqual(result.analysis.settings, {
    diameter: selected.diameter,
    k: selected.k,
    threshold: Math.fround(selected.threshold),
  });
  assert.equal(result.analysis.method, "dog_ccd_median");
  assert.equal(result.analysis.version, "dog-refinement-1");
  assert.ok(result.analysis.reviewReasons.includes("provisional_refinement"));
  assert.equal(refinement.seedMethod, "dog_otsu");
  assert.equal(refinement.requestedRuns, 21);
  assert.ok(refinement.runs.every((run) => !("centers" in run)));
  assert.deepEqual(updates.at(-1), [21, 21, 21]);
});

test("no signal skips the design, and cancellation stops before trials or saving a final result", async () => {
  const centers = new Float32Array();
  const analysis = { ...seedAnalysis, noSignal: true };
  const client = {
    async processAutomatic() {
      return { kind: "automatic", ok: true, centers, analysis };
    },
    async process() {
      assert.fail("no-signal images must not sweep");
    },
  };
  const result = await refineImage(client, 1, image, starting, 21, {
    ...hooks,
    onStart() {
      assert.fail("no-signal images must not start a design");
    },
  });
  assert.equal(result.centers, centers);
  assert.equal(result.analysis, analysis);
  let stopped = false;
  let calls = 0;
  client.processAutomatic = async () => ({
    kind: "automatic",
    ok: true,
    centers,
    analysis: seedAnalysis,
  });
  client.process = async () => {
    calls += 1;
    stopped = true;
    throw new Error("worker cancelled");
  };
  await assert.rejects(
    refineImage(client, 1, image, starting, 21, { ...hooks, stopped: () => stopped }),
    /cancelled/i,
  );
  assert.equal(calls, 1);
});
