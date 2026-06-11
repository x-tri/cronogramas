// Memória de questões entregues em cadernos (tabela caderno_questoes).
//
// A seleção do caderno é determinística: sem memória, cadernos sucessivos
// repetem as mesmas questões e o aluno "acerta" por reconhecimento. Este
// serviço registra cada entrega e fornece as chaves já entregues para a
// seleção despriorizar (ver pickRecommendationsForStudent).
//
// Falhas aqui NUNCA quebram a geração do caderno (fail-open): sem memória o
// caderno sai como antes; com memória ele sai melhor.

import { supabase } from '../lib/supabase'
import { buildRecommendationKey } from './report-recommendations'

export interface QuestaoEntregue {
  readonly ano: number
  readonly posicaoCaderno: number | null
  readonly coItem: number
  readonly area: string
  readonly habilidade?: number | null
}

export interface CadernoQuestaoRow {
  readonly pdf_history_id: string | null
  readonly school_id: string | null
  readonly aluno_id: string
  readonly matricula: string | null
  readonly area: string
  readonly habilidade: number | null
  readonly ano: number
  readonly posicao: number | null
  readonly co_item: number
  readonly question_key: string
}

export function buildCadernoQuestaoRows(params: {
  readonly pdfHistoryId: string | null
  readonly schoolId: string | null
  readonly alunoId: string
  readonly matricula: string | null
  readonly questoes: ReadonlyArray<QuestaoEntregue>
}): CadernoQuestaoRow[] {
  const seen = new Set<string>()
  const rows: CadernoQuestaoRow[] = []

  for (const questao of params.questoes) {
    const key = buildRecommendationKey(questao)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      pdf_history_id: params.pdfHistoryId,
      school_id: params.schoolId,
      aluno_id: params.alunoId,
      matricula: params.matricula,
      area: questao.area,
      habilidade: questao.habilidade ?? null,
      ano: questao.ano,
      posicao: questao.posicaoCaderno,
      co_item: questao.coItem,
      question_key: key,
    })
  }

  return rows
}

// Matrículas reais: "001-008626", "202400028835". O guard evita interpolar
// caracteres do DSL do PostgREST (ex.: ',' ou ')') no filtro.
const MATRICULA_SEGURA = /^[A-Za-z0-9_-]{1,64}$/

/**
 * Chaves (`${ano}:${posicao ?? co_item}`) de todas as questões já entregues
 * ao aluno em cadernos anteriores. Erro → conjunto vazio (fail-open).
 */
export async function fetchDeliveredQuestionKeys(
  matricula: string | null | undefined,
): Promise<ReadonlySet<string>> {
  const trimmed = matricula?.trim()
  if (!trimmed || !MATRICULA_SEGURA.test(trimmed)) return new Set()

  try {
    // Duas queries .eq em vez de .or(): evita injetar valor no DSL de filtro
    const [byMatricula, byAlunoId] = await Promise.all([
      supabase.from('caderno_questoes').select('question_key').eq('matricula', trimmed),
      supabase.from('caderno_questoes').select('question_key').eq('aluno_id', trimmed),
    ])

    const keys = new Set<string>()
    for (const result of [byMatricula, byAlunoId]) {
      if (result.error || !result.data) continue
      for (const row of result.data) keys.add(row.question_key as string)
    }
    return keys
  } catch {
    return new Set()
  }
}

/** Registra as questões de um caderno gerado. Erro → false (fail-open). */
export async function registerCadernoEntregue(params: {
  readonly pdfHistoryId: string | null
  readonly schoolId: string | null
  readonly alunoId: string
  readonly matricula: string | null
  readonly questoes: ReadonlyArray<QuestaoEntregue>
}): Promise<boolean> {
  const rows = buildCadernoQuestaoRows(params)
  if (rows.length === 0) return true

  try {
    const { error } = await supabase.from('caderno_questoes').insert(rows)
    if (error) {
      console.warn('[caderno-entregas] Falha ao registrar entrega:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[caderno-entregas] Falha ao registrar entrega:', err)
    return false
  }
}
