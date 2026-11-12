import assert from "node:assert/strict";
import test from "node:test";
import { chooseStable } from "../src/choose_stable.ts";

test("stable grid chooses its center rather than an arbitrary corner", () => {
  const runs = [10, 14, 18].flatMap((diameter) =>
    [3, 4, 6].flatMap((k) =>
      [0.02, 0.04, 0.08].map((threshold) => ({ diameter, k, threshold, count: 300 })),
    ),
  );
  assert.equal(chooseStable(runs), 13);
});
test("zero detections cannot beat a nonzero plateau; blank images remain valid", () => {
  const runs = [
    { diameter: 10, k: 4, threshold: 0.02, count: 0 },
    { diameter: 10, k: 4, threshold: 0.04, count: 12 },
  ];
  assert.equal(chooseStable(runs), 1);
  assert.equal(chooseStable(runs.map((run) => ({ ...run, count: 0 }))), 0);
  assert.throws(() => chooseStable([]));
});
