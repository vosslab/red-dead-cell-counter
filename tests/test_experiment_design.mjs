import assert from "node:assert/strict";
import test from "node:test";
import { comparisonDesign } from "../src/experiment_design.ts";
import { chooseRepresentative } from "../src/choose_representative.ts";

const center = { diameter: 10, k: 4, threshold: 0.1 };

test("CCD uses 15 unique points, five levels, and orthogonal coded main effects", () => {
  const points = comparisonDesign(center);
  assert.equal(points.length, 15);
  assert.equal(new Set(points.map((p) => JSON.stringify([p.diameter, p.k, p.threshold]))).size, 15);
  assert.equal(points.filter((p) => p.kind === "Factorial").length, 8);
  assert.equal(points.filter((p) => p.kind === "Axial").length, 6);
  for (let axis = 0; axis < 3; axis++) {
    assert.equal(new Set(points.map((p) => p.coded[axis])).size, 5);
    assert.ok(Math.abs(points.reduce((sum, p) => sum + p.coded[axis], 0)) < 1e-12);
    for (let other = axis + 1; other < 3; other++)
      assert.ok(
        Math.abs(points.reduce((sum, p) => sum + p.coded[axis] * p.coded[other], 0)) < 1e-12,
      );
  }
  for (const [axis, low, high] of [
    ["diameter", 5, 20],
    ["k", 2, 8],
    ["threshold", 0.025, 0.4],
  ]) {
    assert.ok(Math.abs(Math.min(...points.map((p) => p[axis])) - low) < 1e-10);
    assert.ok(Math.abs(Math.max(...points.map((p) => p[axis])) - high) < 1e-10);
  }
});

test("design contracts symmetrically near limits and rejects impossible centers", () => {
  const points = comparisonDesign({ ...center, k: 7.9, diameter: 2.1 });
  assert.ok(
    points.every(
      (p) => p.diameter >= 2 - 1e-10 && p.diameter <= 200 && p.k >= 1.1 && p.k <= 8 + 1e-10,
    ),
  );
  assert.equal(points.length, 15);
  assert.throws(() => comparisonDesign({ ...center, k: 8 }), /balanced comparison/);
  assert.throws(() => comparisonDesign({ ...center, diameter: NaN }));
});

test("median representative is an actual run, with center tie-break and valid blank images", () => {
  const points = comparisonDesign(center);
  const runs = points.map((p) => ({ ...p, count: 300 }));
  assert.equal(chooseRepresentative(runs), 0);
  const counts = [0, 10, 12, 14, 100];
  assert.equal(
    chooseRepresentative(runs.slice(0, 5).map((p, i) => ({ ...p, count: counts[i] }))),
    2,
  );
  assert.equal(chooseRepresentative(runs.map((p) => ({ ...p, count: 0 }))), 0);
  assert.throws(() => chooseRepresentative([]));
});

test("small positive thresholds remain log-spaced below 0.001", () => {
  const points = comparisonDesign({ ...center, threshold: 0.0001 });
  assert.ok(points.every((point) => point.threshold > 0 && point.threshold < 0.001));
  assert.ok(Math.abs(Math.min(...points.map((point) => point.threshold)) - 0.000025) < 1e-12);
  assert.ok(Math.abs(Math.max(...points.map((point) => point.threshold)) - 0.0004) < 1e-12);
});
