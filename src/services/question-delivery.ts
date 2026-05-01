import type { SupabaseClient } from '@supabase/supabase-js'
import { getQuestionBankSupabaseClient } from '../lib/question-bank-supabase'
import type { AreaSigla, QuestaoRecomendada } from '../types/report'
import {
  fetchQuestionByYearIndex,
  mapApiToOptions,
  mapApiToQuestionCandidate,
} from './api-questoes-xtri'

export interface QuestionCandidateRow {
  readonly id: string
  readonly source_year: number | null
  readonly source_question: number | null
  readonly source_exam: string | null
  readonly created_at?: string | null
  readonly stem: string | null
  readonly support_text: string | null
  readonly image_url: string | null
  readonly image_alt?: string | null
  readonly difficulty?: string | null
}

export interface QuestionOptionRow {
  readonly letter: string
  readonly text: string
  readonly is_correct: boolean
}

export type ItemValidationFailure =
  | 'broken_image_host'
  | 'missing_visual_context'
  | 'text_image_mismatch'
  | 'duplicate_conflict'
  | 'invalid_options'

export interface ResolvedQuestionPayload {
  readonly candidate: QuestionCandidateRow
  readonly options: ReadonlyArray<QuestionOptionRow>
  readonly resolvedImageUrl: string | null
  readonly requiresVisualContext: boolean
}

export interface ItemResolutionResult {
  readonly status: 'resolved' | 'invalid' | 'not_found'
  readonly resolvedQuestion: ResolvedQuestionPayload | null
  readonly failureReason: ItemValidationFailure | null
  readonly sourceExamUsed: string | null
  readonly wasSubstituted: boolean
}

interface ResolveItemOptions {
  readonly client?: SupabaseClient
  readonly candidateRows?: ReadonlyArray<QuestionCandidateRow>
  readonly optionsByQuestionId?: ReadonlyMap<string, ReadonlyArray<QuestionOptionRow>>
}

const LETTER_ORDER = ['A', 'B', 'C', 'D', 'E'] as const

const VISUAL_KEYWORDS = [
  'figura',
  'gráfico',
  'grafico',
  'tabela',
  'imagem',
  'matriz',
  'mapa',
  'charge',
  'cartaz',
  'esquema',
  'diagrama',
  'infográfico',
  'infografico',
  'representados na figura',
  'representada na figura',
  'apresentada a seguir',
  'observe a figura',
  'observe o gráfico',
  'observe o grafico',
  'observe a tabela',
]

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function sortQuestionOptions(
  options: ReadonlyArray<QuestionOptionRow>,
): QuestionOptionRow[] {
  const indexByLetter = new Map<string, number>(
    LETTER_ORDER.map((letter, index) => [letter, index]),
  )
  return [...options].sort((left, right) => {
    const leftIndex = indexByLetter.get(left.letter.toUpperCase()) ?? 99
    const rightIndex = indexByLetter.get(right.letter.toUpperCase()) ?? 99
    if (leftIndex !== rightIndex) return leftIndex - rightIndex
    return left.letter.localeCompare(right.letter)
  })
}

export function questionRequiresVisualContext(
  candidate: Pick<QuestionCandidateRow, 'stem' | 'support_text' | 'image_alt'>,
): boolean {
  const text = normalizeText(
    [candidate.support_text, candidate.stem, candidate.image_alt].filter(Boolean).join(' '),
  )
  return VISUAL_KEYWORDS.some((keyword) => text.includes(normalizeText(keyword)))
}

export function isTrustedQuestionImageUrl(
  imageUrl: string | null | undefined,
): boolean {
  if (!imageUrl) return false

  try {
    const url = new URL(imageUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

    return (
      url.hostname === 'uhqdkaftqjxenobdfqkd.supabase.co' &&
      url.pathname.includes('/storage/v1/object/public/enem-images/')
    )
  } catch {
    return false
  }
}

function isPlaceholderOptionText(text: string): boolean {
  return /^[A-E]$/.test(text.trim().toUpperCase())
}

export function hasUsableOptions(
  options: ReadonlyArray<QuestionOptionRow>,
): boolean {
  if (options.length !== 5) return false

  const sorted = sortQuestionOptions(options)
  const letters = sorted.map((option) => option.letter.toUpperCase())
  if (letters.join(',') !== LETTER_ORDER.join(',')) return false

  return sorted.every((option) => !isPlaceholderOptionText(option.text))
}

function scoreQuestionCandidate(
  candidate: QuestionCandidateRow,
  options: ReadonlyArray<QuestionOptionRow>,
): number {
  const expectedSourceExam =
    candidate.source_year != null ? `ENEM ${candidate.source_year}` : null
  const normalizedSourceExam = (candidate.source_exam ?? '').trim().toUpperCase()
  const requiresVisual = questionRequiresVisualContext(candidate)
  const hasTrustedImage = isTrustedQuestionImageUrl(candidate.image_url)
  const textLength =
    (candidate.stem?.trim().length ?? 0) + (candidate.support_text?.trim().length ?? 0)

  let score = 0

  if (expectedSourceExam && normalizedSourceExam === expectedSourceExam) {
    score += 200
  }

  if (normalizedSourceExam.includes('PPL')) {
    score -= 200
  }

  if (hasUsableOptions(options)) {
    score += 60
  } else {
    score -= 120
  }

  if (requiresVisual) {
    score += hasTrustedImage ? 80 : -200
  } else if (hasTrustedImage) {
    score += 10
  }

  score += Math.min(textLength, 400) / 10

  return score
}

export function buildQuestionCandidateMap(
  candidates: ReadonlyArray<QuestionCandidateRow>,
): Map<string, QuestionCandidateRow[]> {
  const grouped = new Map<string, QuestionCandidateRow[]>()

  for (const candidate of candidates) {
    const key = `${candidate.source_year ?? 0}:${candidate.source_question ?? 0}`
    const existing = grouped.get(key)
    if (existing) {
      existing.push(candidate)
    } else {
      grouped.set(key, [candidate])
    }
  }

  return grouped
}

function buildCandidateSignature(candidate: QuestionCandidateRow): string {
  return `${normalizeText(candidate.stem)}|${normalizeText(candidate.support_text)}`
}

export function resolveQuestionImageUrl(
  candidates: ReadonlyArray<QuestionCandidateRow>,
  chosenCandidate: QuestionCandidateRow,
): string | null {
  if (!questionRequiresVisualContext(chosenCandidate)) {
    return chosenCandidate.image_url
  }

  const chosenSignature = buildCandidateSignature(chosenCandidate)
  const sameSignatureWithTrustedImage = candidates
    .filter(
      (candidate) =>
        buildCandidateSignature(candidate) === chosenSignature &&
        isTrustedQuestionImageUrl(candidate.image_url),
    )
    .sort((left, right) => {
      const leftTime = Date.parse(left.created_at ?? '') || 0
      const rightTime = Date.parse(right.created_at ?? '') || 0
      return rightTime - leftTime
    })

  return sameSignatureWithTrustedImage[0]?.image_url ?? chosenCandidate.image_url
}

function validateQuestionCandidate(params: {
  candidate: QuestionCandidateRow
  options: ReadonlyArray<QuestionOptionRow>
  resolvedImageUrl: string | null
  candidates: ReadonlyArray<QuestionCandidateRow>
}): ItemValidationFailure | null {
  if (!hasUsableOptions(params.options)) {
    return 'invalid_options'
  }

  const requiresVisual = questionRequiresVisualContext(params.candidate)
  if (requiresVisual && !isTrustedQuestionImageUrl(params.resolvedImageUrl)) {
    return 'missing_visual_context'
  }

  if (params.candidate.image_url && !isTrustedQuestionImageUrl(params.candidate.image_url)) {
    return 'broken_image_host'
  }

  if (!requiresVisual && params.resolvedImageUrl && isTrustedQuestionImageUrl(params.resolvedImageUrl)) {
    return 'text_image_mismatch'
  }

  const hasConflictingVariant = params.candidates.some((candidate) => {
    const currentExam = normalizeText(params.candidate.source_exam)
    const siblingExam = normalizeText(candidate.source_exam)
    return (
      candidate.id !== params.candidate.id &&
      candidate.source_year === params.candidate.source_year &&
      candidate.source_question === params.candidate.source_question &&
      currentExam !== siblingExam &&
      siblingExam.includes('ppl')
    )
  })

  if (
    hasConflictingVariant &&
    normalizeText(params.candidate.source_exam).includes('ppl') &&
    normalizeText(params.candidate.source_exam) !== `enem ${params.candidate.source_year ?? ''}`
  ) {
    return 'duplicate_conflict'
  }

  return null
}

function resolveBestQuestionCandidate(
  candidates: ReadonlyArray<QuestionCandidateRow>,
  optionsByQuestionId: ReadonlyMap<string, ReadonlyArray<QuestionOptionRow>>,
): ItemResolutionResult {
  if (candidates.length === 0) {
    return {
      status: 'not_found',
      resolvedQuestion: null,
      failureReason: null,
      sourceExamUsed: null,
      wasSubstituted: false,
    }
  }

  const scored = candidates
    .map((candidate) => ({
      candidate,
      options: optionsByQuestionId.get(candidate.id) ?? [],
      score: scoreQuestionCandidate(candidate, optionsByQuestionId.get(candidate.id) ?? []),
    }))
    .sort((left, right) => right.score - left.score)

  let failureReason: ItemValidationFailure | null = null

  for (let index = 0; index < scored.length; index += 1) {
    const entry = scored[index]
    const resolvedImageUrl = resolveQuestionImageUrl(candidates, entry.candidate)
    const validationFailure = validateQuestionCandidate({
      candidate: entry.candidate,
      options: entry.options,
      resolvedImageUrl,
      candidates,
    })

    if (!validationFailure) {
      return {
        status: 'resolved',
        resolvedQuestion: {
          candidate: entry.candidate,
          options: sortQuestionOptions(entry.options),
          resolvedImageUrl,
          requiresVisualContext: questionRequiresVisualContext(entry.candidate),
        },
        failureReason: null,
        sourceExamUsed: entry.candidate.source_exam ?? null,
        wasSubstituted: index > 0,
      }
    }

    failureReason = validationFailure
  }

  return {
    status: 'invalid',
    resolvedQuestion: null,
    failureReason,
    sourceExamUsed: null,
    wasSubstituted: false,
  }
}

export function pickBestQuestionCandidate(
  candidates: ReadonlyArray<QuestionCandidateRow>,
  optionsByQuestionId: ReadonlyMap<string, ReadonlyArray<QuestionOptionRow>>,
): QuestionCandidateRow | null {
  return resolveBestQuestionCandidate(candidates, optionsByQuestionId).resolvedQuestion?.candidate ?? null
}

function buildOptionsByQuestionId(
  rows: ReadonlyArray<{
    question_id: string
    letter: string
    text: string
    is_correct: boolean
  }>,
): Map<string, QuestionOptionRow[]> {
  const optionsByQuestionId = new Map<string, QuestionOptionRow[]>()

  for (const row of rows) {
    const option: QuestionOptionRow = {
      letter: row.letter,
      text: row.text,
      is_correct: row.is_correct,
    }
    const existing = optionsByQuestionId.get(row.question_id)
    if (existing) {
      existing.push(option)
    } else {
      optionsByQuestionId.set(row.question_id, [option])
    }
  }

  for (const [questionId, options] of optionsByQuestionId.entries()) {
    optionsByQuestionId.set(questionId, sortQuestionOptions(options))
  }

  return optionsByQuestionId
}

/**
 * Busca uma questao especifica do ENEM por (ano, posicao).
 *
 * Migracao 2026-05-01: usa api.questoes.xtri.online em vez do banco antigo.
 * O parametro `client` e mantido por backward-compat na assinatura mas nao
 * eh mais utilizado. Sem fallback (PO confirmou que API nao falha).
 */
async function fetchCandidatesForItem(params: {
  sourceYear: number
  sourceQuestion: number
  client?: SupabaseClient
}): Promise<QuestionCandidateRow[]> {
  // Tenta sem language primeiro (cobre 96% das questoes).
  // Se for posicao 1-5 LC, a API retorna 1 das 2 (Ingles ou Espanhol) — para
  // cobertura total de ambas, o caller pode chamar 2x com language explicito.
  const apiQ = await fetchQuestionByYearIndex(params.sourceYear, params.sourceQuestion)
  if (!apiQ) return []
  return [mapApiToQuestionCandidate(apiQ)]
}

/**
 * Como cada ApiQuestion ja vem com `alternatives` no detalhe, refazemos o
 * fetch via id da nova API e mapeamos. Cache poderia ser adicionado se virar
 * gargalo (hoje cada caderno PDF gera ~40 questoes, ~10s pelo total das 2 idas
 * por questao).
 *
 * Migracao 2026-05-01: usa api.questoes.xtri.online.
 */
async function fetchOptionsForCandidates(params: {
  candidates: ReadonlyArray<QuestionCandidateRow>
  client?: SupabaseClient
}): Promise<Map<string, QuestionOptionRow[]>> {
  if (params.candidates.length === 0) {
    return new Map()
  }
  const result = new Map<string, QuestionOptionRow[]>()
  // Para cada candidate, refetch detail. Sequencial pra nao saturar a API
  // (Promise.all dispara N concorrentes; ja temos paralelismo no caller).
  for (const c of params.candidates) {
    if (c.source_year == null || c.source_question == null) continue
    const apiQ = await fetchQuestionByYearIndex(c.source_year, c.source_question)
    if (apiQ) {
      result.set(c.id, mapApiToOptions(apiQ))
    }
  }
  return result
}

export async function resolveItem(
  sourceYear: number,
  sourceQuestion: number,
  _area: AreaSigla,
  _faixa: string,
  options?: ResolveItemOptions,
): Promise<ItemResolutionResult> {
  const client = options?.client ?? getQuestionBankSupabaseClient()
  const candidateRows =
    options?.candidateRows ??
    await fetchCandidatesForItem({
      sourceYear,
      sourceQuestion,
      client,
    })

  const optionsByQuestionId =
    options?.optionsByQuestionId ??
    await fetchOptionsForCandidates({
      candidates: candidateRows,
      client,
    })

  return resolveBestQuestionCandidate(candidateRows, optionsByQuestionId)
}

export function shouldRenderQuestionImage(
  question: Pick<QuestaoRecomendada, 'imagemUrl' | 'requiresVisualContext'>,
): boolean {
  return Boolean(question.requiresVisualContext && isTrustedQuestionImageUrl(question.imagemUrl))
}
