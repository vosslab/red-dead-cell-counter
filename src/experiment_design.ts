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
  const factors = [2, 2, 4];
  const bounds = [
    [2, 200],
    [1.1, 8],
    [0, Infinity],
  ] as const;
  const windows = axes.map((axis, index) => {
    const value = center[axis];
    const [lower, upper] = bounds[index]!;
    if (!Number.isFinite(value) || value <= 0 || value < lower || value > upper) {
      throw new Error(`Choose a valid positive ${axis} for the experimental design.`);
    }
    const requestedLow = value / factors[index]!;
    const requestedHigh = value * factors[index]!;
    const low = Math.max(lower, requestedLow);
    const high = Math.min(upper, requestedHigh);
    if (low <= 0 || !Number.isFinite(high) || high <= low) {
      throw new Error(`Choose a finite positive range for ${axis}.`);
    }
    const actualCenter =
      low === requestedLow && high === requestedHigh
        ? value
        : Math.exp((Math.log(low) + Math.log(high)) / 2);
    return {
      low,
      high,
      center: actualCenter,
      span: (Math.log(high) - Math.log(low)) / (2 * alpha),
    };
  });
  function parameter(index: number, code: number): number {
    const window = windows[index]!;
    // Exact axial endpoints avoid floating-point overshoot of validation limits.
    if (code === -alpha) return window.low;
    if (code === alpha) return window.high;
    return window.center * Math.exp(code * window.span);
  }
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
    diameter: parameter(0, value[0]),
    k: parameter(1, value[1]),
    threshold: parameter(2, value[2]),
  }));
}
