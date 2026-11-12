export interface DetectorSettings {
  diameter: number;
  k: number;
  threshold: number;
}

export interface DesignPoint extends DetectorSettings {
  kind: "Center" | "Factorial" | "Axial";
  coded: readonly [number, number, number];
}

// NIST central composite design: alpha = factorial-run count ** (1/4).
const alpha = 8 ** 0.25;
const axes = ["diameter", "k", "threshold"] as const;

/** Balanced in log space; keep continuous diameters to preserve the design. */
export function comparisonDesign(center: DetectorSettings): DesignPoint[] {
  const widths = [Math.log(2), Math.log(2), Math.log(4)];
  const bounds = [
    [2, 200],
    [1.1, 8],
    [0, Infinity],
  ] as const;
  const spans = axes.map((axis, index) => {
    const value = center[axis];
    const [lower, upper] = bounds[index]!;
    if (!Number.isFinite(value) || value <= lower || value >= upper) {
      throw new Error(
        `For a balanced comparison, choose ${axis} strictly between ${lower} and ${upper === Infinity ? "a finite upper value" : upper}.`,
      );
    }
    const span = Math.min(widths[index]!, Math.log(value / lower), Math.log(upper / value));
    if (span < 1e-6)
      throw new Error(`Move ${axis} farther from its limit for a balanced comparison.`);
    return span / alpha;
  });
  const coded: Array<{ kind: DesignPoint["kind"]; value: [number, number, number] }> = [
    { kind: "Center", value: [0, 0, 0] },
  ];
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        coded.push({ kind: "Factorial", value: [x, y, z] });
      }
  for (let axis = 0; axis < 3; axis += 1)
    for (const sign of [-1, 1]) {
      const value: [number, number, number] = [0, 0, 0];
      value[axis] = sign * alpha;
      coded.push({ kind: "Axial", value });
    }
  return coded.map(({ kind, value }) => ({
    kind,
    coded: value,
    diameter: center.diameter * Math.exp(value[0] * spans[0]!),
    k: center.k * Math.exp(value[1] * spans[1]!),
    threshold: center.threshold * Math.exp(value[2] * spans[2]!),
  }));
}
