export interface DetectorSettings {
  diameter: number;
  k: number;
  threshold: number;
}

export interface DesignPoint extends DetectorSettings {
  kind: "Center" | "Factorial" | "Axial" | "Supplemental";
  coded: readonly [number, number, number];
}

// NIST central composite design: alpha = factorial-run count ** (1/4).
const alpha = 8 ** 0.25;
const minimumThreshold = 0.00002;
const axes = ["diameter", "k", "threshold"] as const;

export function roundSettings(settings: DetectorSettings): DetectorSettings {
  return {
    diameter: Number(settings.diameter.toFixed(2)),
    k: Number(settings.k.toFixed(2)),
    threshold: Number(settings.threshold.toFixed(5)),
  };
}

function halton(index: number, base: number): number {
  let fraction = 1;
  let value = 0;
  let remaining = index;
  while (remaining > 0) {
    fraction /= base;
    value += fraction * (remaining % base);
    remaining = Math.floor(remaining / base);
  }
  return value;
}

function settingsKey(point: DetectorSettings): string {
  return `${point.diameter},${point.k},${point.threshold}`;
}

/** Returns a rounded 15-run CCD core plus deterministic supplemental settings up to 100 runs. */
export function comparisonDesign(center: DetectorSettings, runCount = 21): DesignPoint[] {
  if (!Number.isInteger(runCount) || runCount < 15 || runCount > 100) {
    throw new Error("Choose an integer comparison run count from 15 through 100.");
  }
  if (!Number.isFinite(center.threshold) || center.threshold <= 0.00001) {
    throw new Error("Choose a threshold greater than 0.00001 for the experimental design.");
  }
  const roundedCenter = roundSettings(center);
  const factors = [2, 2, 4];
  const bounds = [
    [2, 200],
    [1.1, 8],
    [minimumThreshold, Infinity],
  ] as const;
  const windows = axes.map((axis, index) => {
    const value = roundedCenter[axis];
    const [lower, upper] = bounds[index]!;
    if (!Number.isFinite(value) || value < lower || value > upper) {
      throw new Error(`Choose a valid ${axis} for the experimental design.`);
    }
    const requestedLow = value / factors[index]!;
    const requestedHigh = value * factors[index]!;
    const low = Math.max(lower, requestedLow);
    const high = Math.min(upper, requestedHigh);
    if (!Number.isFinite(high) || high <= low) {
      throw new Error(`Choose a finite valid range for ${axis}.`);
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
    const value =
      code === -alpha
        ? window.low
        : code === alpha
          ? window.high
          : window.center * Math.exp(code * window.span);
    return roundSettings({ diameter: value, k: value, threshold: value })[axes[index]!];
  }
  function makePoint(kind: DesignPoint["kind"], coded: [number, number, number]): DesignPoint {
    return {
      kind,
      coded,
      diameter: parameter(0, coded[0]),
      k: parameter(1, coded[1]),
      threshold: parameter(2, coded[2]),
    };
  }

  const points: DesignPoint[] = [makePoint("Center", [0, 0, 0])];
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        points.push(makePoint("Factorial", [x, y, z]));
      }
  for (let axis = 0; axis < 3; axis += 1)
    for (const sign of [-1, 1]) {
      const coded: [number, number, number] = [0, 0, 0];
      coded[axis] = sign * alpha;
      points.push(makePoint("Axial", coded));
    }
  for (let axis = 0; axis < 3; axis += 1)
    for (const sign of [-1, 1]) {
      const coded: [number, number, number] = [0, 0, 0];
      coded[axis] = sign;
      points.push(makePoint("Supplemental", coded));
    }
  if (runCount <= points.length) return points.slice(0, runCount);

  const keys = new Set(points.map(settingsKey));
  for (let index = 1; points.length < runCount; index += 1) {
    const base: [number, number, number] = [halton(index, 2), halton(index, 3), halton(index, 5)];
    for (const direction of [1, -1]) {
      const coded: [number, number, number] = [
        direction * (2 * base[0] - 1) * alpha,
        direction * (2 * base[1] - 1) * alpha,
        direction * (2 * base[2] - 1) * alpha,
      ];
      const point = makePoint("Supplemental", coded);
      if (!keys.has(settingsKey(point))) {
        points.push(point);
        keys.add(settingsKey(point));
      }
      if (points.length === runCount) return points;
    }
  }
  return points;
}
