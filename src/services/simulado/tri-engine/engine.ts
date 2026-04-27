/**
 * Motor TRI Reference-Anchored — XTRI EdTech
 *
 * Algoritmo (Gabaritai Reference-Anchored, 2PL heuristico):
 *   1. Corrige gabarito -> N acertos por area (45 itens/area).
 *   2. Consulta tabela oficial consolidada INEP -> faixa [Min(N), Max(N)].
 *   3. Calcula posicao na faixa via peso quadratico:
 *        - Acertos: peso = dificuldade^2 (Angoff 1-5 atribuida pelo coordenador).
 *        - Compara score real vs melhor/pior cenario possivel para N acertos.
 *   4. Score = Min + posicao * (Max - Min), na escala ENEM 200-1000.
 *
 * Port direto de /Users/home/Desktop/MENTORIA XANDAO 2027/aluno/src/services/tri-reference-engine.ts
 * com ajustes:
 *   - imports locais (./reference-tables)
 *   - tipos readonly onde aplicavel (imutabilidade)
 *   - docstrings explicando origem
 */

import {
  AREAS,
  REF_TABLES,
  type AreaConfig,
  type AreaKey,
  type RefEntry,
} from './reference-tables.ts'

/**
 * Resultado TRI para UMA area.
 */
export type TriResult = {
  /** Score final na escala ENEM 200-1000 (1 casa decimal). */
  readonly score: number
  /** Entrada da tabela de referencia usada para interpolar. */
  readonly ref: RefEntry
  /** Quantos itens o aluno acertou na area. */
  readonly nCorrect: number
  /** Quantos itens o aluno respondeu (nao deixou em branco). */
  readonly nAnswered: number
  /** Total de itens na area (45 no ENEM). */
  readonly total: number
  /** Posicao dentro da faixa [mn, mx], 0-1. */
  readonly position: number
  /** mx - mn da faixa usada. */
  readonly amplitude: number
}

export type TriResults = Partial<Record<AreaKey, TriResult>>

export type ExamConfig = {
  /** 180 letras corretas (A-E), 1 por item em ordem ENEM. */
  readonly gabarito: readonly string[]
  /** 180 dificuldades Angoff (1-5), 1 por item em ordem ENEM. */
  readonly difficulties: readonly number[]
}

const TOTAL_ITEMS = 180
const TOTAL_ITEMS_PER_AREA = 45
const DEFAULT_DIFFICULTY = 3

/**
 * Valida precondicao de tamanho de arrays. Lanca se qualquer array tiver menos
 * que 180 itens — evita miscount silencioso (branco inflado) quando o caller
 * passa uma area isolada por engano.
 */
function assertFullExam(
  arrays: readonly { name: string; value: readonly unknown[] }[],
): void {
  for (const a of arrays) {
    if (a.value.length < TOTAL_ITEMS) {
      throw new Error(
        `[tri-engine] ${a.name} tem ${a.value.length} itens, esperado >= ${TOTAL_ITEMS}. ` +
          'Um simulado completo (ENEM) tem 180 itens.',
      )
    }
  }
}

/**
 * Normaliza uma letra de resposta: uppercase + trim.
 * Retorna string vazia se o valor representar "em branco".
 */
function normalizeAnswer(raw: string | undefined | null): string {
  if (raw == null) return ''
  const v = raw.toUpperCase().trim()
  if (v === '' || v === '-' || v === ' ') return ''
  return v
}

/**
 * Calcula o score TRI Reference-Anchored para UMA area.
 *
 * Retorna null se o aluno nao respondeu nenhum item da area.
 */
function calcAreaTRI(
  answers: readonly string[],
  gabarito: readonly string[],
  difficulties: readonly number[],
  area: AreaConfig,
): TriResult | null {
  const ref = REF_TABLES[area.key]
  if (!ref) return null

  const start = area.range[0] - 1
  const end = area.range[1] // inclusivo nas tabelas originais; iteramos ate <=

  const correctItems: { idx: number; diff: number }[] = []
  const wrongItems: { idx: number; diff: number }[] = []
  let nAnswered = 0

  for (let i = start; i < end; i++) {
    const ans = normalizeAnswer(answers[i])
    const correct = normalizeAnswer(gabarito[i])
    if (!ans) continue

    nAnswered++
    const diff = difficulties[i] ?? DEFAULT_DIFFICULTY

    if (ans === correct) {
      correctItems.push({ idx: i, diff })
    } else {
      wrongItems.push({ idx: i, diff })
    }
  }

  if (nAnswered === 0) return null

  const nCorrect = correctItems.length
  const entry = ref[Math.min(nCorrect, ref.length - 1)]
  if (!entry) return null

  // Casos extremos: 0 acertos -> piso; todos os itens acertados -> teto.
  if (nCorrect === 0) {
    return {
      score: entry.mn,
      ref: entry,
      nCorrect,
      nAnswered,
      total: TOTAL_ITEMS_PER_AREA,
      position: 0,
      amplitude: 0,
    }
  }
  if (nCorrect >= ref.length - 1) {
    return {
      score: entry.mx,
      ref: entry,
      nCorrect,
      nAnswered,
      total: TOTAL_ITEMS_PER_AREA,
      position: 1,
      amplitude: 0,
    }
  }

  // Peso quadratico dos acertos.
  let scoreUp = 0
  for (const it of correctItems) scoreUp += it.diff * it.diff

  // Melhor cenario: se os N acertos fossem nos itens mais dificeis da area.
  const allDiffsDesc = [...correctItems, ...wrongItems]
    .map((i) => i.diff)
    .sort((a, b) => b - a)
  let bestUp = 0
  for (let i = 0; i < nCorrect && i < allDiffsDesc.length; i++) {
    bestUp += allDiffsDesc[i] * allDiffsDesc[i]
  }

  // Pior cenario: se os N acertos fossem nos itens mais faceis.
  const diffsAsc = [...allDiffsDesc].sort((a, b) => a - b)
  let worstUp = 0
  for (let i = 0; i < nCorrect && i < diffsAsc.length; i++) {
    worstUp += diffsAsc[i] * diffsAsc[i]
  }

  const position = bestUp === worstUp ? 0.5 : (scoreUp - worstUp) / (bestUp - worstUp)

  const amplitude = entry.mx - entry.mn
  const score = Math.round((entry.mn + position * amplitude) * 10) / 10

  return {
    score,
    ref: entry,
    nCorrect,
    nAnswered,
    total: TOTAL_ITEMS_PER_AREA,
    position,
    amplitude,
  }
}

/**
 * Calcula TRI para as 4 areas (LC / CH / CN / MT).
 *
 * Areas sem nenhuma resposta nao aparecem no resultado.
 */
export function calcAllTRI(
  answers: readonly string[],
  exam: ExamConfig,
): TriResults {
  assertFullExam([
    { name: 'answers', value: answers },
    { name: 'gabarito', value: exam.gabarito },
    { name: 'difficulties', value: exam.difficulties },
  ])

  const results: TriResults = {}
  for (const area of AREAS) {
    const result = calcAreaTRI(answers, exam.gabarito, exam.difficulties, area)
    if (result) {
      results[area.key] = result
    }
  }
  return results
}

/**
 * Media simples (estilo SISU sem pesos). Considera redacao se fornecida.
 */
export function calcMediaGeral(
  results: TriResults,
  redacao: number | null,
): number | null {
  const scores = AREAS.map((a) => results[a.key]?.score).filter(
    (s): s is number => s != null,
  )
  if (scores.length === 0) return null

  const sum = scores.reduce((a, b) => a + b, 0) + (redacao ?? 0)
  const count = scores.length + (redacao != null ? 1 : 0)
  return Math.round((sum / count) * 10) / 10
}

/**
 * Totais gerais (acertos, erros, branco, respondidas) considerando os 180 itens.
 */
export function calcTotals(
  answers: readonly string[],
  gabarito: readonly string[],
): { acertos: number; erros: number; branco: number; respondidas: number } {
  assertFullExam([
    { name: 'answers', value: answers },
    { name: 'gabarito', value: gabarito },
  ])

  let acertos = 0
  let erros = 0
  let branco = 0

  for (let i = 0; i < TOTAL_ITEMS; i++) {
    const ans = normalizeAnswer(answers[i])
    if (!ans) {
      branco++
      continue
    }
    const correct = normalizeAnswer(gabarito[i])
    if (ans === correct) acertos++
    else erros++
  }

  return { acertos, erros, branco, respondidas: acertos + erros }
}

/**
 * Agrupa erros do aluno por chave (topico ou habilidade), usando um mapeamento
 * item-a-item fornecido pelo caller. Util para montar o "mapa de erros".
 *
 * Exemplo: `groupErrorsBy(answers, gabarito, itemTopico)` -> { "Funcoes": 3, "Geometria": 2 }.
 *
 * Items com valor null/undefined no mapa sao ignorados.
 */
export function groupErrorsBy(
  answers: readonly string[],
  gabarito: readonly string[],
  itemLabels: readonly (string | null | undefined)[],
): Record<string, number> {
  assertFullExam([
    { name: 'answers', value: answers },
    { name: 'gabarito', value: gabarito },
    { name: 'itemLabels', value: itemLabels },
  ])

  const out: Record<string, number> = {}
  for (let i = 0; i < TOTAL_ITEMS; i++) {
    const ans = normalizeAnswer(answers[i])
    if (!ans) continue
    const correct = normalizeAnswer(gabarito[i])
    if (ans === correct) continue
    const label = itemLabels[i]
    if (!label) continue
    out[label] = (out[label] ?? 0) + 1
  }
  return out
}

/**
 * Versao do groupErrorsBy que tambem registra a `area` autoritativa de cada
 * item (vinda de simulado_itens.area). Resolve bug em que topicos sem prefixo
 * "Materia - " caiam num "buraco" do classificador heuristico.
 *
 * Retorna: { [topico]: { area: AreaKey, n: number } }
 *
 * Se um mesmo topico aparece em areas diferentes (caso patologico — coord
 * cadastrou tudo errado), a primeira area vista vence. Isso e raro e a
 * incoerencia indica problema de cadastro a ser tratado a parte.
 */
export interface ErrosPorTopicoComArea {
  readonly area: AreaKey
  readonly n: number
}

export function groupErrorsByWithArea(
  answers: readonly string[],
  gabarito: readonly string[],
  itemTopicos: readonly (string | null | undefined)[],
  itemAreas: readonly (AreaKey | null | undefined)[],
): Record<string, ErrosPorTopicoComArea> {
  assertFullExam([
    { name: 'answers', value: answers },
    { name: 'gabarito', value: gabarito },
    { name: 'itemTopicos', value: itemTopicos },
    { name: 'itemAreas', value: itemAreas },
  ])

  const out: Record<string, ErrosPorTopicoComArea> = {}
  for (let i = 0; i < TOTAL_ITEMS; i++) {
    const ans = normalizeAnswer(answers[i])
    if (!ans) continue
    const correct = normalizeAnswer(gabarito[i])
    if (ans === correct) continue
    const topico = itemTopicos[i]
    const area = itemAreas[i]
    if (!topico || !area) continue
    const prev = out[topico]
    out[topico] = prev
      ? { area: prev.area, n: prev.n + 1 }
      : { area, n: 1 }
  }
  return out
}
