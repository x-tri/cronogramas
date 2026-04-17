/**
 * Tipos de simulados do aluno (Fase 4).
 *
 * Espelham o payload das RPCs `get_student_simulados_pendentes` e
 * `get_student_simulado_resultado` (migration 017) e a resposta da
 * Edge Function `submit-simulado` (supabase/functions/submit-simulado).
 */

export type AreaKey = "LC" | "CH" | "CN" | "MT";

export interface SimuladoPendenteRow {
  readonly id: string;
  readonly title: string;
  readonly school_id: string;
  readonly turmas: readonly string[];
  readonly published_at: string | null;
  readonly ja_respondeu: boolean;
  readonly submitted_at: string | null;
}

export interface SimuladoResultadoItem {
  readonly numero: number;
  readonly area: AreaKey;
  readonly gabarito: string;
  readonly dificuldade: number;
  readonly topico: string | null;
  readonly habilidade: string | null;
  readonly resposta_aluno: string | null;
  readonly correto: boolean;
  readonly branco: boolean;
}

export interface SimuladoResultado {
  readonly simulado: {
    readonly id: string;
    readonly title: string;
    readonly school_id: string;
    readonly turmas: readonly string[];
    readonly status: "draft" | "published" | "closed";
    readonly published_at: string | null;
    readonly closed_at: string | null;
  } | null;
  readonly resposta: {
    readonly id: string;
    readonly simulado_id: string;
    readonly student_id: string;
    readonly answers: Record<string, string>;
    readonly tri_lc: number | null;
    readonly tri_ch: number | null;
    readonly tri_cn: number | null;
    readonly tri_mt: number | null;
    readonly acertos_lc: number;
    readonly erros_lc: number;
    readonly branco_lc: number;
    readonly acertos_ch: number;
    readonly erros_ch: number;
    readonly branco_ch: number;
    readonly acertos_cn: number;
    readonly erros_cn: number;
    readonly branco_cn: number;
    readonly acertos_mt: number;
    readonly erros_mt: number;
    readonly branco_mt: number;
    readonly erros_por_topico: Record<string, number>;
    readonly erros_por_habilidade: Record<string, number>;
    readonly submitted_at: string;
  } | null;
  readonly itens: readonly SimuladoResultadoItem[] | null;
  readonly submitted: boolean;
}

export interface SubmitSimuladoResponse {
  readonly resposta_id: string;
  readonly tri: Record<AreaKey, number | null>;
  readonly totais: {
    readonly acertos: number;
    readonly erros: number;
    readonly branco: number;
    readonly respondidas: number;
  };
  readonly por_area: Record<
    AreaKey,
    { readonly acertos: number; readonly erros: number; readonly branco: number }
  >;
  readonly erros_por_topico: Record<string, number>;
  readonly erros_por_habilidade: Record<string, number>;
  readonly submitted_at: string;
}

export const AREA_LABELS: Readonly<Record<AreaKey, string>> = {
  LC: "Linguagens",
  CH: "Humanas",
  CN: "Natureza",
  MT: "Matemática",
};

export const AREA_RANGES: Readonly<
  Record<AreaKey, { readonly start: number; readonly end: number }>
> = {
  LC: { start: 1, end: 45 },
  CH: { start: 46, end: 90 },
  CN: { start: 91, end: 135 },
  MT: { start: 136, end: 180 },
};

export function areaOfNumero(n: number): AreaKey | null {
  if (n >= 1 && n <= 45) return "LC";
  if (n >= 46 && n <= 90) return "CH";
  if (n >= 91 && n <= 135) return "CN";
  if (n >= 136 && n <= 180) return "MT";
  return null;
}
