/**
 * Types returned by the `get-student-performance` edge function.
 * Mirrors the schema in cronogramas/supabase/functions/get-student-performance/index.ts.
 *
 * See `cronogramas/src/services/mentor-tri-context.ts` for the backend equivalent.
 */

export type SimuladoFonte = "legacy" | "cronogramas";
export type SimuladoFormato = "enem_180" | "tipo2_45";

export interface TriScores {
  readonly lc: number;
  readonly ch: number;
  readonly cn: number;
  readonly mt: number;
}

export interface TriEstimadoFlags {
  readonly lc: boolean;
  readonly ch: boolean;
  readonly cn: boolean;
  readonly mt: boolean;
}

export interface Acertos {
  readonly lc: number;
  readonly ch: number;
  readonly cn: number;
  readonly mt: number;
}

export interface SimuladoPerformance {
  readonly fonte: SimuladoFonte;
  readonly simulado_id: string;
  readonly simulado_nome: string;
  readonly data: string;
  readonly formato: SimuladoFormato;
  readonly fez_dia1: boolean;
  readonly fez_dia2: boolean;
  readonly tri: TriScores;
  readonly tri_estimado: TriEstimadoFlags;
  readonly acertos: Acertos;
  readonly answers: readonly string[];
  readonly tri_total: number;
}

export interface StudentPerformanceResponse {
  readonly student_id: string;
  readonly matricula: string;
  readonly school_id: string;
  readonly performances: readonly SimuladoPerformance[];
  readonly fontes_utilizadas: ReadonlyArray<SimuladoFonte>;
  readonly legacy_status: "ok" | "fallback" | "disabled";
  readonly cronogramas_status: "ok" | "fallback";
  readonly fetched_at: string;
}

/** Area siglas used in UI. */
export const AREA_LABELS = {
  lc: "Linguagens",
  ch: "Humanas",
  cn: "Natureza",
  mt: "Matemática",
} as const;

export const AREA_SHORT = {
  lc: "LC",
  ch: "CH",
  cn: "CN",
  mt: "MT",
} as const;

export type AreaSigla = keyof typeof AREA_LABELS;
