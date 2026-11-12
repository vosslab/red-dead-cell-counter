export type CountStatistics = {
  mean: number;
  median: number;
  standardDeviation: number;
  count: number;
};

export function countStatistics(counts: number[]): CountStatistics | undefined {
  if (counts.length === 0) return undefined;
  const sorted = [...counts].sort(function ascending(first: number, second: number): number {
    return first - second;
  });
  const mean =
    sorted.reduce(function sum(total: number, count: number): number {
      return total + count;
    }, 0) / sorted.length;
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);
  const standardDeviation = Math.sqrt(
    sorted.reduce(function squaredDifference(total: number, count: number): number {
      return total + (count - mean) ** 2;
    }, 0) / sorted.length,
  );
  return { mean, median, standardDeviation, count: sorted.length };
}

export function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

export function formatStatistic(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function countStatisticsText(statistics: CountStatistics): string {
  return `Across ${formatCount(statistics.count)} successful settings: mean ${formatStatistic(statistics.mean)}, median ${formatStatistic(statistics.median)}, standard deviation ${formatStatistic(statistics.standardDeviation)} cells.`;
}
