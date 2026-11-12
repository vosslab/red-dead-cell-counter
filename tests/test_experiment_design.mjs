import assert from "node:assert/strict";
import test from "node:test";
import { comparisonDesign, roundSettings } from "../src/experiment_design.ts";
import { chooseRepresentative } from "../src/choose_representative.ts";

const center = { diameter: 10, k: 4, threshold: 0.1 };

function settingKeys(points) {
  return new Set(points.map((point) => JSON.stringify([point.diameter, point.k, point.threshold])));
}

test("15-run CCD preserves its unique core and orthogonal coded main effects", () => {
  const points = comparisonDesign(center, 15);
  assert.equal(points.length, 15);
  assert.equal(settingKeys(points).size, 15);
  assert.equal(points.filter((point) => point.kind === "Factorial").length, 8);
  assert.equal(points.filter((point) => point.kind === "Axial").length, 6);
  for (let axis = 0; axis < 3; axis += 1) {
    assert.equal(new Set(points.map((point) => point.coded[axis])).size, 5);
    assert.ok(Math.abs(points.reduce((sum, point) => sum + point.coded[axis], 0)) < 1e-12);
    for (let other = axis + 1; other < 3; other += 1)
      assert.ok(
        Math.abs(points.reduce((sum, point) => sum + point.coded[axis] * point.coded[other], 0)) <
          1e-12,
      );
  }
});

test("default design adds six inner-axis supplemental points", () => {
  const points = comparisonDesign(center);
  assert.equal(points.length, 21);
  assert.equal(settingKeys(points).size, 21);
  assert.equal(points.filter((point) => point.kind === "Supplemental").length, 6);
  assert.ok(
    points.slice(15).every((point) => point.coded.filter((value) => value !== 0).length === 1),
  );
});

test("every requested budget produces deterministic unique rounded settings", () => {
  for (let runCount = 15; runCount <= 100; runCount += 1) {
    const points = comparisonDesign(center, runCount);
    assert.equal(points.length, runCount);
    assert.equal(settingKeys(points).size, runCount);
    assert.deepEqual(points, comparisonDesign(center, runCount));
    for (const point of points)
      assert.deepEqual(point, { ...roundSettings(point), kind: point.kind, coded: point.coded });
  }
  const lowestThreshold = comparisonDesign({ diameter: 2, k: 1.1, threshold: 0.00002 }, 100);
  assert.equal(settingKeys(lowestThreshold).size, 100);
});

test("bounded windows and threshold rounding retain valid settings", () => {
  const points = comparisonDesign({ ...center, k: 7.9, diameter: 2.1, threshold: 0.0001 }, 15);
  assert.ok(
    points.every(
      (point) =>
        point.diameter >= 2 &&
        point.diameter <= 200 &&
        point.k >= 1.1 &&
        point.k <= 8 &&
        point.threshold >= 0.00002 &&
        point.threshold < 0.001,
    ),
  );
  assert.equal(Math.min(...points.map((point) => point.threshold)), 0.00003);
  assert.deepEqual(roundSettings({ diameter: 10.126, k: 4.126, threshold: 0.123456 }), {
    diameter: 10.13,
    k: 4.13,
    threshold: 0.12346,
  });
});

test("invalid run budgets and thresholds fail before producing a design", () => {
  assert.throws(() => comparisonDesign(center, 14));
  assert.throws(() => comparisonDesign(center, 101));
  assert.throws(() => comparisonDesign(center, 21.5));
  assert.throws(() => comparisonDesign({ ...center, threshold: 0.00001 }));
  assert.throws(() => comparisonDesign({ ...center, threshold: 0.000014 }));
});

test("median representative is an actual run, with center tie-break and valid blank images", () => {
  const points = comparisonDesign(center, 15);
  const runs = points.map((point) => ({ ...point, count: 300 }));
  assert.equal(chooseRepresentative(runs), 0);
  const counts = [0, 10, 12, 14, 100];
  assert.equal(
    chooseRepresentative(
      runs.slice(0, 5).map((point, index) => ({ ...point, count: counts[index] })),
    ),
    2,
  );
  assert.equal(chooseRepresentative(runs.map((p) => ({ ...p, count: 0 }))), 0);
  assert.throws(() => chooseRepresentative([]));
});
