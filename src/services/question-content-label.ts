import type { QuestaoRecomendada } from '../types/report'
import {
  extractTopicSearchTerms,
  isSyntheticTopicLabel,
  normalizeTopicLabel,
} from './report-topic-focus'

const BROAD_DISCIPLINE_TERMS = new Set([
  'arte',
  'biologia',
  'ciencia',
  'ciencias',
  'fisica',
  'filosofia',
  'geografia',
  'gramatica',
  'historia',
  'humanas',
  'ingles',
  'linguagens',
  'literatura',
  'matematica',
  'natureza',
  'portugues',
  'quimica',
  'sociologia',
])

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resolve o rótulo pedagógico exibido no PDF por questão.
 *
 * Regra conservadora:
 * - só mostra conteúdo quando a questão foi selecionada por `same_topic`
 * - `same_skill` e `area_fallback` continuam sendo critérios válidos de
 *   recomendação, mas não têm granularidade suficiente para nomear um conteúdo
 *   específico no PDF sem risco de rotulagem errada
 */
export function resolveQuestionContentLabel(
  question: QuestaoRecomendada,
): string | null {
  if (question.selectionSource !== 'same_topic') {
    return null
  }

  const label = normalizeTopicLabel(question.matchedTopicLabel)
  if (!label || isSyntheticTopicLabel(label)) {
    return null
  }

  const specificTerms = extractTopicSearchTerms(label)
    .filter((term) => !BROAD_DISCIPLINE_TERMS.has(term))

  if (specificTerms.length === 0) {
    return null
  }

  const corpus = normalizeText(
    [
      question.textoApoio ?? '',
      question.enunciado ?? '',
    ].join(' '),
  )

  if (!corpus) {
    return null
  }

  if (!specificTerms.some((term) => corpus.includes(term))) {
    return null
  }

  return label
}

export function summarizeAreaFocus(
  questions: ReadonlyArray<QuestaoRecomendada>,
): {
  readonly label: string | null
  readonly validatedCount: number
  readonly totalCount: number
} {
  const totalCount = questions.length
  const counts = new Map<string, number>()

  for (const question of questions) {
    const label = resolveQuestionContentLabel(question)
    if (!label) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const dominant = [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1]
      return right[0].length - left[0].length
    })[0]

  const validatedCount = [...counts.values()].reduce((sum, value) => sum + value, 0)
  const dominantLabel = dominant?.[0] ?? null
  const dominantCount = dominant?.[1] ?? 0

  const hasConfirmedFocus =
    dominantLabel !== null &&
    dominantCount >= 4 &&
    totalCount > 0 &&
    dominantCount / totalCount >= 0.7

  return {
    label: hasConfirmedFocus ? dominantLabel : null,
    validatedCount,
    totalCount,
  }
}
