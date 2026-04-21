/**
 * Pure helpers for TRI performance data (Phase 4).
 *
 * Extracted from HistoricoSimulados so they can be unit-tested without React.
 * Mirrors the logic of buildTriContext on the backend (mentor-tri-context.ts).
 */

import type { AreaSigla, SimuladoPerformance } from "./performance";

/**
 * Compute current + previous + delta for one area, ignoring estimated scores.
 * Sort assumption: `performances` is sorted desc by `data` (newest first).
 */
export function computeAreaTrend(
  performances: ReadonlyArray<SimuladoPerformance>,
  area: AreaSigla,
): { current: number | null; previous: number | null; delta: number | null } {
  const valid = performances.filter(
    (p) => !p.tri_estimado[area] && p.tri[area] > 0,
  );
  const current = valid[0]?.tri[area] ?? null;
  const previous = valid[1]?.tri[area] ?? null;
  const delta =
    current !== null && previous !== null ? current - previous : null;
  return { current, previous, delta };
}

/**
 * Returns chronologically-ordered (old→new) valid scores for an area.
 * Used by legacy sparkline code. Prefer `collectAreaSeriesWithFlags` for new UI.
 */
export function collectAreaTimeSeries(
  performances: ReadonlyArray<SimuladoPerformance>,
  area: AreaSigla,
): number[] {
  return [...performances]
    .filter((p) => !p.tri_estimado[area] && p.tri[area] > 0)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .map((p) => p.tri[area]);
}

/**
 * Returns chronologically-ordered (old→new) scores for an area WITH a flag
 * indicating whether each score is estimated (floor value / missed dia1-dia2).
 *
 * Use this for sparklines that want to show ALL data points but style
 * estimated ones distinctly (dashed circle) while connecting the trend line
 * only through real scores.
 *
 * Filters out only zero/null scores; estimated scores remain in the series.
 */
export function collectAreaSeriesWithFlags(
  performances: ReadonlyArray<SimuladoPerformance>,
  area: AreaSigla,
): Array<{ readonly value: number; readonly estimated: boolean }> {
  return [...performances]
    .filter((p) => p.tri[area] > 0)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .map((p) => ({
      value: p.tri[area],
      estimated: p.tri_estimado[area],
    }));
}

/** True if any of the 4 areas of a performance has an estimated score. */
export function hasAnyEstimated(p: SimuladoPerformance): boolean {
  return (
    p.tri_estimado.lc ||
    p.tri_estimado.ch ||
    p.tri_estimado.cn ||
    p.tri_estimado.mt
  );
}
