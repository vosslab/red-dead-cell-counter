export interface CountRun {
  diameter: number;
  k: number;
  threshold: number;
  count: number;
}

const axes = ["diameter", "k", "threshold"] as const;

/** Select a plateau across all three parameter axes; stability is not accuracy. */
export function chooseStable(runs: readonly CountRun[]): number {
  if (runs.length === 0) throw new Error("No comparison results are available.");
  const values = axes.map((axis) =>
    [...new Set(runs.map((run) => run[axis]))].sort((a, b) => a - b),
  );
  const hasPositive = runs.some((run) => run.count > 0);
  let best = 0;
  let bestScore = Infinity;
  let bestDistance = Infinity;
  runs.forEach((run, index) => {
    if (hasPositive && run.count === 0) return;
    let score = 0;
    let distance = 0;
    axes.forEach((axis, axisIndex) => {
      const counts = runs
        .filter((other) => axes.every((key) => key === axis || other[key] === run[key]))
        .map((other) => other.count)
        .sort((a, b) => a - b);
      const median = counts[Math.floor(counts.length / 2)] ?? 0;
      score += ((counts[counts.length - 1] ?? 0) - (counts[0] ?? 0)) / Math.max(1, median);
      const positions = values[axisIndex] ?? [];
      distance += Math.abs(positions.indexOf(run[axis]) - (positions.length - 1) / 2);
    });
    if (
      score < bestScore - 1e-9 ||
      (Math.abs(score - bestScore) <= 1e-9 && distance < bestDistance)
    ) {
      best = index;
      bestScore = score;
      bestDistance = distance;
    }
  });
  return best;
}
