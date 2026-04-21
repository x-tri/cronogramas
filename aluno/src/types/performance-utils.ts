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
 * Used by the sparkline chart.
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

/** True if any of the 4 areas of a performance has an estimated score. */
export function hasAnyEstimated(p: SimuladoPerformance): boolean {
  return (
    p.tri_estimado.lc ||
    p.tri_estimado.ch ||
    p.tri_estimado.cn ||
    p.tri_estimado.mt
  );
}
