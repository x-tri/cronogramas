/**
 * Importador gabaritos → portal — funções puras.
 *
 * Mapeia e valida exames escaneados do gabaritos para o portal do aluno
 * (simulado + itens + respostas), reaproveitando as funções puras que já
 * geram os simulados digitados. TRI é importado do gabaritos (não recalculado).
 */

import type { AreaKey } from './tri-engine/reference-tables.ts'
import { answersMapToArray, computeAreaBreakdown } from './submit-simulado.ts'
import { groupErrorsByWithArea } from './tri-engine/engine.ts'
import { areasRealizadasFromBreakdown, confidenceFromAreas } from './item-audit.ts'

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

export interface GabaritosStudentAnswer {
  readonly student_number: string
  readonly student_name: string
  readonly turma: string | null
  readonly answers: readonly string[]
  readonly tri_lc: number | null
  readonly tri_ch: number | null
  readonly tri_cn: number | null
  readonly tri_mt: number | null
}

export interface SimuladoRespostaInsert {
  readonly student_id: string
  readonly answers: Record<string, string>
  readonly tri_lc: number | null
  readonly tri_ch: number | null
  readonly tri_cn: number | null
  readonly tri_mt: number | null
  readonly acertos_lc: number; readonly erros_lc: number; readonly branco_lc: number
  readonly acertos_ch: number; readonly erros_ch: number; readonly branco_ch: number
  readonly acertos_cn: number; readonly erros_cn: number; readonly branco_cn: number
  readonly acertos_mt: number; readonly erros_mt: number; readonly branco_mt: number
  readonly erros_por_topico: Record<string, { area: AreaKey; n: number }>
  readonly erros_por_habilidade: Record<string, number>
  readonly areas_realizadas: AreaKey[]
  readonly confidence_level: 'high' | 'medium' | 'low' | 'invalid'
  readonly correction_status: 'computed'
  readonly tri_method: 'gabaritos_import'
  readonly tri_version: '1'
}

function triNaEscala(v: number | null): number | null {
  if (v == null || !Number.isFinite(v) || v < 200 || v > 1000) return null
  return v
}

export function buildResposta(
  sa: GabaritosStudentAnswer,
  itens: readonly SimuladoItemInsert[],
  studentId: string,
): SimuladoRespostaInsert {
  // arrays na ordem 1..180
  const gabarito = itens.map((it) => it.gabarito)
  const topicos = itens.map((it) => it.topico)
  const areas = itens.map((it) => it.area)

  // mapa { "1": "A", ... } só com respostas válidas A-E
  const answersMap: Record<string, string> = {}
  for (let i = 0; i < TOTAL; i++) {
    const v = String(sa.answers[i] ?? '').toUpperCase().trim()
    if (LETTERS.has(v)) answersMap[String(i + 1)] = v
  }
  const answersArray = answersMapToArray(answersMap)

  const porArea = computeAreaBreakdown(answersArray, gabarito)
  const errosPorTopico = groupErrorsByWithArea(answersArray, gabarito, topicos, areas)

  return {
    student_id: studentId,
    answers: answersMap,
    tri_lc: triNaEscala(sa.tri_lc),
    tri_ch: triNaEscala(sa.tri_ch),
    tri_cn: triNaEscala(sa.tri_cn),
    tri_mt: triNaEscala(sa.tri_mt),
    acertos_lc: porArea.LC.acertos, erros_lc: porArea.LC.erros, branco_lc: porArea.LC.branco,
    acertos_ch: porArea.CH.acertos, erros_ch: porArea.CH.erros, branco_ch: porArea.CH.branco,
    acertos_cn: porArea.CN.acertos, erros_cn: porArea.CN.erros, branco_cn: porArea.CN.branco,
    acertos_mt: porArea.MT.acertos, erros_mt: porArea.MT.erros, branco_mt: porArea.MT.branco,
    erros_por_topico: errosPorTopico,
    erros_por_habilidade: {},
    areas_realizadas: areasRealizadasFromBreakdown(porArea),
    confidence_level: confidenceFromAreas(porArea),
    correction_status: 'computed',
    tri_method: 'gabaritos_import',
    tri_version: '1',
  }
}

export function matchByMatricula(
  studentNumber: string,
  byMatricula: ReadonlyMap<string, string>,
): string | null {
  const raw = String(studentNumber ?? '').trim()
  if (byMatricula.has(raw)) return byMatricula.get(raw)!
  const norm = raw.replace(/^0+/, '') || '0'
  return byMatricula.get(norm) ?? null
}
