export interface CountRun {
  diameter: number;
  k: number;
  threshold: number;
  count: number;
}

/** Select an evaluated median-count run; ties favor the log-space design center. */
export function chooseRepresentative(runs: readonly CountRun[]): number {
  if (runs.length === 0) throw new Error("No comparison results are available.");
  const counts = runs.map((run) => run.count).sort((a, b) => a - b);
  const middle = Math.floor(counts.length / 2);
  const median = ((counts[Math.floor((counts.length - 1) / 2)] ?? 0) + (counts[middle] ?? 0)) / 2;
  const axes = ["diameter", "k", "threshold"] as const;
  const bounds = axes.map((axis) => {
    const values = runs.map((run) => Math.log(run[axis]));
    return [Math.min(...values), Math.max(...values)] as const;
  });
  let best = 0;
  let bestError = Infinity;
  let bestDistance = Infinity;
  runs.forEach((run, index) => {
    const error = Math.abs(run.count - median);
    const distance = axes.reduce((total, axis, axisIndex) => {
      const [low, high] = bounds[axisIndex]!;
      if (high === low) return total;
      return total + ((Math.log(run[axis]) - (low + high) / 2) / (high - low)) ** 2;
    }, 0);
    if (error < bestError || (error === bestError && distance < bestDistance - 1e-12)) {
      best = index;
      bestError = error;
      bestDistance = distance;
    }
  });
  return best;
}
