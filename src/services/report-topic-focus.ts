import type { WrongQuestion } from '../types/supabase'
import type {
  ErroHabilidade,
  PedagogicalLabelSource,
} from '../types/report'

const TOPIC_LABEL_PREFIX_PATTERN = /^q\d+\s+-\s+/i

const STOPWORDS = new Set([
  'a',
  'ao',
  'aos',
  'as',
  'com',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'entre',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'ou',
  'para',
  'por',
  'sem',
  'sob',
  'sobre',
  'um',
  'uma',
])

const GENERIC_TERMS = new Set([
  'analise',
  'analises',
  'ciencia',
  'ciencias',
  'conteudo',
  'conteudos',
  'estudo',
  'estudos',
  'leitura',
  'matematica',
  'numeros',
  'problema',
  'problemas',
  'questao',
  'questoes',
  'texto',
  'textos',
])

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeTopicLabel(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : null
}

export function isSyntheticTopicLabel(
  label: string | null | undefined,
): boolean {
  const normalized = normalizeTopicLabel(label)
  if (!normalized) return true
  return TOPIC_LABEL_PREFIX_PATTERN.test(normalized)
}

export function extractTopicSearchTerms(label: string | null | undefined): string[] {
  const normalized = normalizeTopicLabel(label)
  if (!normalized || isSyntheticTopicLabel(normalized)) {
    return []
  }

  return [...new Set(
    normalizeText(normalized)
      .replace(/[^a-z0-9% ]+/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4)
      .filter((token) => !STOPWORDS.has(token))
      .filter((token) => !GENERIC_TERMS.has(token)),
  )]
}

export function scoreTopicTextRelevance(
  label: string | null | undefined,
  params: {
    readonly stem?: string | null
    readonly supportText?: string | null
    readonly imageAlt?: string | null
  },
): number {
  const normalizedLabel = normalizeTopicLabel(label)
  if (!normalizedLabel || isSyntheticTopicLabel(normalizedLabel)) {
    return 0
  }

  const normalizedCorpus = normalizeText(
    [
      params.stem ?? '',
      params.supportText ?? '',
      params.imageAlt ?? '',
    ].join(' '),
  )

  if (!normalizedCorpus) {
    return 0
  }

  const normalizedFullLabel = normalizeText(normalizedLabel)
  let score = normalizedCorpus.includes(normalizedFullLabel) ? 6 : 0

  for (const term of extractTopicSearchTerms(normalizedLabel)) {
    if (normalizedCorpus.includes(term)) {
      score += 2
    }
  }

  return score
}

export function derivePedagogicalFocusForSkill(params: {
  readonly erro: ErroHabilidade
  readonly wrongQuestions: ReadonlyArray<WrongQuestion>
  readonly fallbackLabel: string
}): {
  readonly label: string
  readonly source: PedagogicalLabelSource
} {
  const wrongQuestionMap = new Map(
    params.wrongQuestions.map((question) => [question.questionNumber, question.topic]),
  )

  const counts = new Map<string, number>()

  for (const questionNumber of params.erro.questoesErradas) {
    const label = normalizeTopicLabel(wrongQuestionMap.get(questionNumber))
    if (!label || isSyntheticTopicLabel(label)) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const dominant = [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1]
      return right[0].length - left[0].length
    })[0]?.[0]

  if (dominant) {
    return {
      label: dominant,
      source: 'question_topic',
    }
  }

  return {
    label: params.fallbackLabel,
    source: 'skill_map',
  }
}
