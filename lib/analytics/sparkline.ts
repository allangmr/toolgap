export const SPARKLINE_POINTS = 12;

export function sparklineValues(
  points: Array<{ at: number; value: number }>,
  n = SPARKLINE_POINTS,
): number[] | undefined {
  if (points.length < 2) return undefined;
  return [...points]
    .sort((a, b) => a.at - b.at)
    .map((p) => p.value)
    .slice(-n);
}
