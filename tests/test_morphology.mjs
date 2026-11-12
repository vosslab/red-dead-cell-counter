import assert from "node:assert/strict";
import test from "node:test";

import { challengeExamples, summarizeMorphology } from "../src/morphology_statistics.ts";
import { unpackMorphology } from "../src/morphology_types.ts";

function object(firstX, firstY, overrides = {}) {
  return {
    firstX,
    firstY,
    areaPx: 10,
    centroidX: firstX + 1,
    centroidY: firstY + 1,
    equivalentDiameterPx: 4,
    roundness: 0.8,
    inertiaRatio: 0.5,
    meanSquaredRadiusPx2: 2,
    bounds: [firstX, firstY, firstX + 3, firstY + 3],
    touchesEdge: false,
    centerIndices: [0],
    ...overrides,
  };
}

test("summaries measure single-center interior objects and retain finite metric sample sizes", () => {
  const summary = summarizeMorphology({
    objects: [
      object(1, 1),
      object(5, 1, { areaPx: 30, inertiaRatio: NaN }),
      object(9, 1, { areaPx: 1000, centerIndices: [2, 3] }),
      object(13, 1, { areaPx: 2000, touchesEdge: true }),
      object(17, 1, { areaPx: 3000, centerIndices: [], touchesEdge: true }),
    ],
  });
  assert.deepEqual(
    [
      summary.objectCount,
      summary.singleCenterCount,
      summary.multiCenterCount,
      summary.noCenterCount,
      summary.edgeCount,
      summary.eligibleCount,
    ],
    [5, 3, 1, 1, 2, 2],
  );
  assert.deepEqual(summary.metrics.areaPx, {
    mean: 20,
    median: 20,
    standardDeviation: 10,
    count: 2,
  });
  assert.deepEqual(summary.metrics.inertiaRatio, {
    mean: 0.5,
    median: 0.5,
    standardDeviation: 0,
    count: 1,
  });
  assert.equal(summary.metrics.roundness.count, 2);
  assert.equal(summarizeMorphology({ objects: [] }).metrics.areaPx, undefined);
  assert.equal(
    summarizeMorphology({ objects: [object(1, 1, { touchesEdge: true })] }).metrics.inertiaRatio,
    undefined,
  );
});

test("native records decode aligned features, exclusive bounds, and all center memberships", () => {
  const measurements = unpackMorphology(
    new Float64Array([
      1,
      2,
      12,
      2.5,
      3.5,
      3.9,
      0.8,
      0.4,
      2.1,
      1,
      2,
      5,
      6,
      0,
      7,
      8,
      1,
      7,
      8,
      1.1,
      1,
      NaN,
      0,
      7,
      8,
      8,
      9,
      1,
      10,
      11,
      20,
      12,
      13,
      5,
      0.6,
      0.2,
      4,
      10,
      11,
      15,
      16,
      0,
    ]),
    new Uint32Array([2, 0, 2]),
  );
  assert.deepEqual(measurements.objects, [
    object(1, 2, {
      areaPx: 12,
      centroidX: 2.5,
      centroidY: 3.5,
      equivalentDiameterPx: 3.9,
      inertiaRatio: 0.4,
      meanSquaredRadiusPx2: 2.1,
      bounds: [1, 2, 5, 6],
      centerIndices: [1],
    }),
    object(7, 8, {
      areaPx: 1,
      centroidX: 7,
      centroidY: 8,
      equivalentDiameterPx: 1.1,
      roundness: 1,
      inertiaRatio: NaN,
      meanSquaredRadiusPx2: 0,
      bounds: [7, 8, 8, 9],
      touchesEdge: true,
      centerIndices: [],
    }),
    object(10, 11, {
      areaPx: 20,
      centroidX: 12,
      centroidY: 13,
      equivalentDiameterPx: 5,
      roundness: 0.6,
      inertiaRatio: 0.2,
      meanSquaredRadiusPx2: 4,
      bounds: [10, 11, 15, 16],
      centerIndices: [0, 2],
    }),
  ]);
  assert.throws(() => unpackMorphology(new Float64Array(13), new Uint32Array()), /14/);
  assert.throws(() => unpackMorphology(new Float64Array(14), new Uint32Array([1])), /outside/);
});

test("challenge examples rank deterministically, exclude edge cells, and never repeat anchors", () => {
  const cluster = object(2, 1, { areaPx: 20, centerIndices: [0, 1, 2] });
  const largest = object(3, 3, { areaPx: 30, roundness: 0.1 });
  const leastRound = object(2, 5, { roundness: 0.2 });
  const objects = [
    object(1, 1, { areaPx: 100, centerIndices: [0, 1] }),
    object(5, 1, { areaPx: 20, centerIndices: [0, 1, 2] }),
    cluster,
    object(1, 4, { areaPx: 30 }),
    largest,
    object(4, 5, { roundness: 0.2 }),
    leastRound,
    object(0, 0, { areaPx: 1000, roundness: 0, touchesEdge: true }),
  ];
  const expected = [
    { title: "Multiple centers in one object", object: cluster },
    { title: "Largest single-center object", object: largest },
    { title: "Least round single-center object", object: leastRound },
  ];
  assert.deepEqual(challengeExamples({ objects }), expected);
  assert.deepEqual(challengeExamples({ objects: [...objects].reverse() }), expected);
  const noCenter = object(10, 10, { centerIndices: [], areaPx: 50 });
  assert.deepEqual(challengeExamples({ objects: [largest, largest, noCenter] }), [
    { title: "Largest single-center object", object: largest },
    { title: "Object without a retained center", object: noCenter },
  ]);
  assert.deepEqual(challengeExamples({ objects: [] }), []);
});
