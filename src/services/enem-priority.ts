import { ENEM_HISTORICAL_TOPIC_WEIGHTS, type EnemPlanArea } from '../data/enem/base-historica-enem-2009-2025'
import type { SimuladoResult, WrongQuestion } from '../types/supabase'

export type PrioritizedTopic = {
  area: EnemPlanArea
  areaLabel: string
  displayLabel: string
  matchedHistoricalTopic: string | null
  historicalWeight: number
  errorCount: number
  triScore: number | null
  score: number
  questionNumbers: number[]
}

export type AreaPerformance = {
  area: EnemPlanArea
  label: string
  triScore: number | null
  wrongCount: number
  weakScore: number
}

export type SimuladoPriorityContext = {
  prioritizedTopics: PrioritizedTopic[]
  weakestAreas: AreaPerformance[]
  strongestAreas: AreaPerformance[]
}

const AREA_LABELS: Record<EnemPlanArea, string> = {
  lc: 'Linguagens',
  ch: 'Humanas',
  cn: 'Natureza',
  mt: 'Matemática',
}

const QUESTION_AREA_RANGES: Array<{ area: EnemPlanArea; start: number; end: number }> = [
  { area: 'lc', start: 1, end: 45 },
  { area: 'ch', start: 46, end: 90 },
  { area: 'cn', start: 91, end: 135 },
  { area: 'mt', start: 136, end: 180 },
]

const LOW_SIGNAL_TOKENS = new Set([
  'analise',
  'contexto',
  'conteudo',
  'conteudos',
  'compreensao',
  'expressao',
  'expressoes',
  'informacoes',
  'mecanismo',
  'movimento',
  'movimentos',
  'orientacao',
  'terra',
  'texto',
  'textual',
])

const TOP_TOPIC_BY_AREA = new Map<EnemPlanArea, (typeof ENEM_HISTORICAL_TOPIC_WEIGHTS)[number]>(
  (['lc', 'ch', 'cn', 'mt'] as EnemPlanArea[]).map((area) => {
    const top = ENEM_HISTORICAL_TOPIC_WEIGHTS
      .filter((entry) => entry.area === area)
      .sort((left, right) => right.percentage - left.percentage)[0]

    return [area, top]
  }),
)

export function getTopHistoricalTopicByArea(area: EnemPlanArea): { label: string; percentage: number } | null {
  const topic = TOP_TOPIC_BY_AREA.get(area)
  if (!topic) {
    return null
  }

  return {
    label: topic.label,
    percentage: topic.percentage,
  }
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueTokens(value: string): string[] {
  return [...new Set(normalizeText(value).split(' ').filter((token) => token.length > 2))]
}

function meaningfulTokens(value: string): string[] {
  return uniqueTokens(value).filter((token) => !LOW_SIGNAL_TOKENS.has(token))
}

function overlapCount(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0
  }

  const rightSet = new Set(right)
  return left.filter((token) => rightSet.has(token)).length
}

export function inferAreaFromQuestionNumber(questionNumber: number): EnemPlanArea {
  return QUESTION_AREA_RANGES.find(({ start, end }) => questionNumber >= start && questionNumber <= end)?.area ?? 'lc'
}

export function getAreaLabel(area: EnemPlanArea): string {
  return AREA_LABELS[area]
}

function getTriScoreByArea(result: SimuladoResult, area: EnemPlanArea): number | null {
  const { studentAnswer } = result

  switch (area) {
    case 'lc':
      return studentAnswer.tri_lc
    case 'ch':
      return studentAnswer.tri_ch
    case 'cn':
      return studentAnswer.tri_cn
    case 'mt':
      return studentAnswer.tri_mt
    default:
      return null
  }
}

function scoreAreaWeakness(triScore: number | null): number {
  if (triScore == null) {
    return 8
  }

  return Math.max(0, (650 - triScore) / 10)
}

function resolveHistoricalTopic(topic: string, area: EnemPlanArea) {
  const normalizedTopic = normalizeText(topic)
  const topicTokens = meaningfulTokens(topic)
  const candidates = ENEM_HISTORICAL_TOPIC_WEIGHTS.filter((entry) => entry.area === area)

  const exactMatch = candidates.find((entry) =>
    entry.aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias)
      return (
        normalizedTopic === normalizedAlias
        || normalizedTopic.includes(normalizedAlias)
        || normalizedAlias.includes(normalizedTopic)
      )
    }),
  )

  if (exactMatch) {
    return exactMatch
  }

  let bestMatch: (typeof candidates)[number] | null = null
  let bestScore = 0

  for (const candidate of candidates) {
    for (const alias of candidate.aliases) {
      const aliasTokens = meaningfulTokens(alias)
      const overlap = overlapCount(topicTokens, aliasTokens)
      if (overlap === 0) {
        continue
      }

      const aliasCoverage = aliasTokens.length > 0 ? overlap / aliasTokens.length : 0
      const topicCoverage = topicTokens.length > 0 ? overlap / topicTokens.length : 0
      const strongEnough = overlap >= 2 || aliasCoverage >= 0.5 || topicCoverage >= 0.6
      if (!strongEnough) {
        continue
      }

      const score = overlap * 12 + aliasCoverage * 20 + topicCoverage * 10 + candidate.percentage
      if (score > bestScore) {
        bestScore = score
        bestMatch = candidate
      }
    }
  }

  return bestMatch
}

function buildAreaPerformance(result: SimuladoResult): AreaPerformance[] {
  return QUESTION_AREA_RANGES.map(({ area, start, end }) => {
    const triScore = getTriScoreByArea(result, area)
    const wrongCount = result.wrongQuestions.filter(
      (question) => question.questionNumber >= start && question.questionNumber <= end,
    ).length

    return {
      area,
      label: AREA_LABELS[area],
      triScore,
      wrongCount,
      weakScore: scoreAreaWeakness(triScore) + wrongCount * 0.4,
    }
  })
}

function groupQuestionsByTopic(wrongQuestions: WrongQuestion[]): PrioritizedTopic[] {
  const grouped = new Map<string, PrioritizedTopic>()

  for (const question of wrongQuestions) {
    const area = inferAreaFromQuestionNumber(question.questionNumber)
    const displayLabel = question.topic?.trim() || `Questões da área de ${AREA_LABELS[area]}`
    const key = `${area}:${normalizeText(displayLabel)}`
    const current = grouped.get(key)

    if (current) {
      current.errorCount += 1
      current.questionNumbers.push(question.questionNumber)
      continue
    }

    grouped.set(key, {
      area,
      areaLabel: AREA_LABELS[area],
      displayLabel,
      matchedHistoricalTopic: null,
      historicalWeight: 0,
      errorCount: 1,
      triScore: null,
      score: 0,
      questionNumbers: [question.questionNumber],
    })
  }

  return [...grouped.values()]
}

export function buildSimuladoPriorityContext(result: SimuladoResult): SimuladoPriorityContext {
  const areaPerformance = buildAreaPerformance(result)

  const prioritizedTopics = groupQuestionsByTopic(result.wrongQuestions)
    .map((topic) => {
      const historicalTopic = resolveHistoricalTopic(topic.displayLabel, topic.area)
      const triScore = getTriScoreByArea(result, topic.area)
      const areaWeaknessScore = scoreAreaWeakness(triScore)
      const score = topic.errorCount * 12 + (historicalTopic?.percentage ?? 0) + areaWeaknessScore

      return {
        ...topic,
        matchedHistoricalTopic: historicalTopic?.label ?? null,
        historicalWeight: historicalTopic?.percentage ?? 0,
        triScore,
        score,
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (right.historicalWeight !== left.historicalWeight) {
        return right.historicalWeight - left.historicalWeight
      }

      return right.errorCount - left.errorCount
    })

  const cappedTopics: PrioritizedTopic[] = []
  const countByArea = new Map<EnemPlanArea, number>()

  for (const topic of prioritizedTopics) {
    const areaCount = countByArea.get(topic.area) ?? 0
    if (areaCount >= 2) {
      continue
    }

    cappedTopics.push(topic)
    countByArea.set(topic.area, areaCount + 1)

    if (cappedTopics.length === 4) {
      break
    }
  }

  if (cappedTopics.length < 4) {
    for (const topic of prioritizedTopics) {
      if (cappedTopics.some((item) => item.area === topic.area && item.displayLabel === topic.displayLabel)) {
        continue
      }
      cappedTopics.push(topic)
      if (cappedTopics.length === 4) {
        break
      }
    }
  }

  return {
    prioritizedTopics: cappedTopics,
    weakestAreas: [...areaPerformance].sort((left, right) => right.weakScore - left.weakScore),
    strongestAreas: [...areaPerformance].sort((left, right) => (right.triScore ?? 0) - (left.triScore ?? 0)),
  }
}

export function describeHistoricalBase(topic: PrioritizedTopic): string {
  if (topic.matchedHistoricalTopic && topic.historicalWeight > 0) {
    return `${topic.matchedHistoricalTopic} (${topic.historicalWeight.toFixed(2)}%)`
  }

  const fallback = TOP_TOPIC_BY_AREA.get(topic.area)
  if (fallback) {
    return `referência geral da área: ${fallback.label} (${fallback.percentage.toFixed(2)}%)`
  }

  return 'sem incidência histórica mapeada'
}
