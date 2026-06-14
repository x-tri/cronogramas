/**
 * Importador gabaritos → portal — funções puras.
 *
 * Mapeia e valida exames escaneados do gabaritos para o portal do aluno
 * (simulado + itens + respostas), reaproveitando as funções puras que já
 * geram os simulados digitados. TRI é importado do gabaritos (não recalculado).
 */

import type { AreaKey } from './tri-engine/reference-tables.ts'

export interface GabaritosExam {
  readonly id: string
  readonly title: string
  readonly answer_key: readonly string[]
  readonly question_contents:
    | readonly { answer: string; content: string; questionNumber: number }[]
    | null
}

const TOTAL = 180
const LETTERS = new Set(['A', 'B', 'C', 'D', 'E'])

export function areaForNumero(numero: number): AreaKey {
  if (numero <= 45) return 'LC'
  if (numero <= 90) return 'CH'
  if (numero <= 135) return 'CN'
  return 'MT'
}

export function validateExam(exam: GabaritosExam): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (!Array.isArray(exam.answer_key) || exam.answer_key.length !== TOTAL) {
    reasons.push(`answer_key deve ter 180 itens (tem ${exam.answer_key?.length ?? 0})`)
  } else {
    const bad = exam.answer_key.findIndex((k) => !LETTERS.has(String(k).toUpperCase().trim()))
    if (bad >= 0) reasons.push(`letra inválida no item ${bad + 1}: "${exam.answer_key[bad]}"`)
  }
  return { ok: reasons.length === 0, reasons }
}

export interface SimuladoItemInsert {
  readonly numero: number
  readonly area: AreaKey
  readonly gabarito: string
  readonly dificuldade: number
  readonly topico: string | null
  readonly habilidade: null
}

const DEFAULT_DIFICULDADE = 3 // placeholder NOT NULL (1-5); não afeta nota (TRI importado)

export function buildItens(exam: GabaritosExam): SimuladoItemInsert[] {
  const topicos = new Map<number, string>()
  for (const q of exam.question_contents ?? []) {
    if (typeof q?.content === 'string') topicos.set(q.questionNumber, q.content)
  }
  return Array.from({ length: TOTAL }, (_, i) => {
    const numero = i + 1
    return {
      numero,
      area: areaForNumero(numero),
      gabarito: String(exam.answer_key[i]).toUpperCase().trim(),
      dificuldade: DEFAULT_DIFICULDADE,
      topico: topicos.get(numero) ?? null,
      habilidade: null,
    }
  })
}
