/**
 * Shared types for simulado performance data unified across
 * legacy (axtmozyrnsrhqrnktshz.projetos) and cronogramas (comwcnmvnuzqqbypjtqn.simulado_respostas).
 *
 * See audit findings in the repo: /Volumes/KINGSTON/apps/horario de estudos 2.0 (session 2026-04-21).
 *
 * Guardrails baked in:
 *   1. tri_estimado per-area flag for students who didn't do dia2 (CN/MT get floor ~308-340)
 *   2. formato tag to separate TIPO 2 (45 questões) from ENEM padrão (180)
 *   3. fonte always set so caller can trace origin
 */

export type AreaSigla = 'lc' | 'ch' | 'cn' | 'mt'

export interface TriScores {
  readonly lc: number
  readonly ch: number
  readonly cn: number
  readonly mt: number
}

export interface TriEstimadoFlags {
  readonly lc: boolean
  readonly ch: boolean
  readonly cn: boolean
  readonly mt: boolean
}

export interface Acertos {
  readonly lc: number
  readonly ch: number
  readonly cn: number
  readonly mt: number
}

export type SimuladoFonte = 'legacy' | 'cronogramas'
export type SimuladoFormato = 'enem_180' | 'tipo2_45'

export interface SimuladoPerformance {
  readonly fonte: SimuladoFonte
  readonly simulado_id: string
  readonly simulado_nome: string
  /** ISO timestamp */
  readonly data: string
  readonly formato: SimuladoFormato
  readonly fez_dia1: boolean
  readonly fez_dia2: boolean
  readonly tri: TriScores
  /** True => score for that area is a floor/estimated value (no real day 2 submission). */
  readonly tri_estimado: TriEstimadoFlags
  readonly acertos: Acertos
  /** A-E answers in question order. Empty array for answers not parsed. */
  readonly answers: readonly string[]
  readonly tri_total: number
}

export interface StudentPerformanceResponse {
  readonly student_id: string
  readonly matricula: string
  readonly school_id: string
  readonly performances: readonly SimuladoPerformance[]
  readonly fontes_utilizadas: readonly SimuladoFonte[]
  readonly legacy_status: 'ok' | 'fallback' | 'disabled'
  readonly cronogramas_status: 'ok' | 'fallback'
  readonly fetched_at: string
}

/**
 * TRI floor values observed in audit — below these, score is treated as estimated.
 *
 * Audit raw data:
 *   - CN/MT floor: 308.5 (MT) to 339.9 (CN) — range 308–340
 *   - CH/LC floor: 299.6 (LC) to 329.8 (CH) — range 299–330
 *
 * Use strict `<` comparison so legitimate borderline scores are not flagged.
 */
export const TRI_FLOOR_CN_MT = 340
export const TRI_FLOOR_CH_LC = 330

/** Extract matricula from a legacy tri_scores / tri_scores_by_area key. */
export function extractMatriculaFromKey(key: string): string | null {
  // Keys observed: "merged-101051-1772462339484", "manual-101327-1772737493498"
  const match = key.match(/^(?:merged|manual)-([^-]+)-\d+$/)
  return match ? match[1] : null
}

/** Find the tri_scores key for a given matricula in a projeto. */
export function findKeyForMatricula(
  triScoresByArea: Record<string, unknown> | null | undefined,
  matricula: string,
): string | null {
  if (!triScoresByArea) return null
  const prefixes = [`merged-${matricula}-`, `manual-${matricula}-`]
  for (const key of Object.keys(triScoresByArea)) {
    if (prefixes.some((p) => key.startsWith(p))) return key
  }
  return null
}
