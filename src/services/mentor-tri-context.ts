/**
 * Phase 3 helper: transforms SimuladoPerformance[] (from get-student-performance)
 * into a compact TriContextSummary used by mentor-gap-analysis.
 *
 * Pure function — no Deno or Supabase client dependencies so it's testable
 * by vitest AND importable by the edge function runtime.
 */

export type SimuladoPerformance = {
  readonly fonte: 'legacy' | 'cronogramas'
  readonly simulado_id: string
  readonly simulado_nome: string
  readonly data: string
  readonly formato: 'enem_180' | 'tipo2_45'
  readonly fez_dia1: boolean
  readonly fez_dia2: boolean
  readonly tri: { lc: number; ch: number; cn: number; mt: number }
  readonly tri_estimado: { lc: boolean; ch: boolean; cn: boolean; mt: boolean }
  readonly acertos: { lc: number; ch: number; cn: number; mt: number }
  readonly answers: readonly string[]
  readonly tri_total: number
}

export type TriContextSummary = {
  readonly area_trends: {
    readonly lc: AreaTrend
    readonly ch: AreaTrend
    readonly cn: AreaTrend
    readonly mt: AreaTrend
  }
  readonly last_simulados: ReadonlyArray<{
    simulado_id: string
    simulado_nome: string
    data: string
    fonte: 'legacy' | 'cronogramas'
    tri_total: number
    has_estimated: boolean
  }>
  readonly estimated_count: number
  readonly total_count: number
  readonly fontes_utilizadas: ReadonlyArray<'legacy' | 'cronogramas'>
}

export type AreaTrend = {
  readonly current: number | null
  readonly previous: number | null
  readonly delta: number | null
}

const AREAS = ['lc', 'ch', 'cn', 'mt'] as const
type Area = (typeof AREAS)[number]

/**
 * Build a compact TRI context.
 *
 * Rules:
 *   - Trend per area uses only NON-estimated scores (filters out floor/fake values)
 *   - Last simulados: 3 most recent, sorted by `data` desc
 *   - `has_estimated` flag per simulado = true if ANY of the 4 areas was estimated
 */
export function buildTriContext(
  performances: ReadonlyArray<SimuladoPerformance>,
  fontesUtilizadas: ReadonlyArray<'legacy' | 'cronogramas'>,
): TriContextSummary {
  const sorted = [...performances].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
  )

  function areaTrend(area: Area): AreaTrend {
    const validScores = sorted.filter((p) => !p.tri_estimado[area] && p.tri[area] > 0)
    const current = validScores[0]?.tri[area] ?? null
    const previous = validScores[1]?.tri[area] ?? null
    const delta = current !== null && previous !== null ? current - previous : null
    return { current, previous, delta }
  }

  const last_simulados = sorted.slice(0, 3).map((p) => ({
    simulado_id: p.simulado_id,
    simulado_nome: p.simulado_nome,
    data: p.data,
    fonte: p.fonte,
    tri_total: p.tri_total,
    has_estimated: Object.values(p.tri_estimado).some(Boolean),
  }))

  const estimated_count = performances.filter((p) =>
    Object.values(p.tri_estimado).some(Boolean),
  ).length

  return {
    area_trends: {
      lc: areaTrend('lc'),
      ch: areaTrend('ch'),
      cn: areaTrend('cn'),
      mt: areaTrend('mt'),
    },
    last_simulados,
    estimated_count,
    total_count: performances.length,
    fontes_utilizadas: fontesUtilizadas,
  }
}
