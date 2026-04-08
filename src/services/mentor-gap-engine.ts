import type {
  MentorAlert,
  MentorAlertSeverity,
  MentorAlertType,
  MentorAttentionStatus,
  MentorBriefing,
  StudentPerformanceAudit,
  TopicMastery,
} from '../types/mentor-intelligence'

export interface TopicPerformanceRecord {
  readonly topicId: string
  readonly canonicalLabel: string
  readonly areaSigla: string
  readonly examId: string
  readonly assessedAt: string
  readonly questionNumber: number
  readonly correct: boolean
  readonly difficulty: number | null
}

export interface PlanTopicRef {
  readonly topicId: string
  readonly canonicalLabel: string
  readonly areaSigla: string
  readonly plannedOrder: number
}

export interface BuildAuditInput {
  readonly mentorPlanId: string
  readonly schoolId: string
  readonly studentKey: string
  readonly planTopics: ReadonlyArray<PlanTopicRef>
  readonly previousPlanTopicIds?: ReadonlyArray<ReadonlyArray<string>>
  readonly records: ReadonlyArray<TopicPerformanceRecord>
  readonly mappedQuestionsCount: number
  readonly unmappedQuestionsCount: number
  readonly analyzedAt?: string
}

type AggregatedTopicStats = {
  readonly topicId: string
  readonly canonicalLabel: string
  readonly areaSigla: string
  readonly records: ReadonlyArray<TopicPerformanceRecord>
  readonly weightedAccuracy: number
  readonly recentAccuracy: number
  readonly recurrencePenalty: number
  readonly consecutiveAssessmentsWithError: number
  readonly sampleSize: number
  readonly confidence: 'low' | 'medium' | 'high'
  readonly lastSeenAt: string | null
  readonly masteryScore: number
  readonly olderMasteryScore: number | null
  readonly trendDelta: number | null
}

type AlertDraft = Omit<MentorAlert, 'id' | 'analysisRunId' | 'createdAt' | 'updatedAt'>

const MS_PER_DAY = 1000 * 60 * 60 * 24

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function average(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function weightQuestionByDifficulty(
  difficulty: number | null | undefined,
): number {
  if (difficulty == null || Number.isNaN(difficulty)) {
    return 1
  }

  return clamp(1 + difficulty * 0.2, 0.5, 1.5)
}

function calculateWeightedAccuracy(
  records: ReadonlyArray<TopicPerformanceRecord>,
): number {
  if (records.length === 0) return 0

  const weighted = records.reduce(
    (acc, record) => {
      const weight = weightQuestionByDifficulty(record.difficulty)
      return {
        total: acc.total + weight,
        correct: acc.correct + (record.correct ? weight : 0),
      }
    },
    { total: 0, correct: 0 },
  )

  if (weighted.total === 0) return 0
  return weighted.correct / weighted.total
}

function groupAssessmentErrors(
  records: ReadonlyArray<TopicPerformanceRecord>,
): Array<{ examId: string; assessedAt: string; hasError: boolean }> {
  const grouped = new Map<string, { examId: string; assessedAt: string; hasError: boolean }>()

  for (const record of records) {
    const existing = grouped.get(record.examId)
    if (!existing) {
      grouped.set(record.examId, {
        examId: record.examId,
        assessedAt: record.assessedAt,
        hasError: !record.correct,
      })
      continue
    }

    grouped.set(record.examId, {
      examId: record.examId,
      assessedAt:
        new Date(existing.assessedAt).getTime() > new Date(record.assessedAt).getTime()
          ? existing.assessedAt
          : record.assessedAt,
      hasError: existing.hasError || !record.correct,
    })
  }

  return [...grouped.values()].sort(
    (left, right) =>
      new Date(left.assessedAt).getTime() - new Date(right.assessedAt).getTime(),
  )
}

function calculateConsecutiveAssessmentsWithError(
  records: ReadonlyArray<TopicPerformanceRecord>,
): number {
  const grouped = groupAssessmentErrors(records)
  let consecutive = 0

  for (let index = grouped.length - 1; index >= 0; index -= 1) {
    if (!grouped[index]?.hasError) break
    consecutive += 1
  }

  return consecutive
}

function confidenceFromSampleSize(sampleSize: number): 'low' | 'medium' | 'high' {
  if (sampleSize < 3) return 'low'
  if (sampleSize < 6) return 'medium'
  return 'high'
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function calculateOlderMasteryScore(
  records: ReadonlyArray<TopicPerformanceRecord>,
  latestTimestamp: number | null,
): number | null {
  if (latestTimestamp == null) return null

  const threshold = latestTimestamp - 30 * MS_PER_DAY
  const olderRecords = records.filter(
    (record) => new Date(record.assessedAt).getTime() < threshold,
  )

  if (olderRecords.length === 0) return null

  const weightedAccuracy = calculateWeightedAccuracy(olderRecords)
  const recurrencePenalty = Math.min(
    calculateConsecutiveAssessmentsWithError(olderRecords) / 3,
    1,
  )

  return round(100 * (0.7 * weightedAccuracy + 0.3 * (1 - recurrencePenalty)))
}

function buildTopicStats(
  records: ReadonlyArray<TopicPerformanceRecord>,
): AggregatedTopicStats[] {
  const grouped = new Map<string, TopicPerformanceRecord[]>()

  for (const record of records) {
    const existing = grouped.get(record.topicId)
    if (existing) {
      existing.push(record)
    } else {
      grouped.set(record.topicId, [record])
    }
  }

  return [...grouped.entries()].map(([topicId, topicRecords]) => {
    const sorted = [...topicRecords].sort(
      (left, right) =>
        new Date(left.assessedAt).getTime() - new Date(right.assessedAt).getTime(),
    )
    const latestTimestamp =
      sorted.length > 0
        ? new Date(sorted[sorted.length - 1]!.assessedAt).getTime()
        : null
    const weightedAccuracy = calculateWeightedAccuracy(sorted)
    const recentThreshold =
      latestTimestamp == null ? null : latestTimestamp - 30 * MS_PER_DAY
    const recentRecords =
      recentThreshold == null
        ? sorted
        : sorted.filter(
            (record) => new Date(record.assessedAt).getTime() >= recentThreshold,
          )
    const recentAccuracy =
      recentRecords.length > 0
        ? calculateWeightedAccuracy(recentRecords)
        : weightedAccuracy
    const consecutiveAssessmentsWithError =
      calculateConsecutiveAssessmentsWithError(sorted)
    const recurrencePenalty = Math.min(consecutiveAssessmentsWithError / 3, 1)
    const masteryScore = round(
      100 * (0.7 * weightedAccuracy + 0.3 * (1 - recurrencePenalty)),
    )
    const olderMasteryScore = calculateOlderMasteryScore(sorted, latestTimestamp)

    return {
      topicId,
      canonicalLabel: sorted[0]?.canonicalLabel ?? topicId,
      areaSigla: sorted[0]?.areaSigla ?? 'OUT',
      records: sorted,
      weightedAccuracy: round(weightedAccuracy),
      recentAccuracy: round(recentAccuracy),
      recurrencePenalty: round(recurrencePenalty),
      consecutiveAssessmentsWithError,
      sampleSize: sorted.length,
      confidence: confidenceFromSampleSize(sorted.length),
      lastSeenAt: sorted[sorted.length - 1]?.assessedAt ?? null,
      masteryScore,
      olderMasteryScore,
      trendDelta:
        olderMasteryScore == null ? null : round(masteryScore - olderMasteryScore),
    }
  })
}

function toTopicMastery(
  stats: AggregatedTopicStats,
  plannedTopicIds: ReadonlySet<string>,
): TopicMastery {
  return {
    topicId: stats.topicId,
    canonicalLabel: stats.canonicalLabel,
    areaSigla: stats.areaSigla,
    masteryScore: stats.masteryScore,
    weightedAccuracy: stats.weightedAccuracy,
    recurrencePenalty: stats.recurrencePenalty,
    sampleSize: stats.sampleSize,
    confidence: stats.confidence,
    lastSeenAt: stats.lastSeenAt,
    recentAccuracy: stats.recentAccuracy,
    consecutiveAssessmentsWithError: stats.consecutiveAssessmentsWithError,
    planned: plannedTopicIds.has(stats.topicId),
  }
}

function buildAlertId(
  alertType: MentorAlertType,
  topicId: string | null,
): string {
  return `${alertType}:${topicId ?? 'global'}`
}

function buildAlerts(
  input: BuildAuditInput,
  stats: ReadonlyArray<AggregatedTopicStats>,
  masteryByTopic: ReadonlyArray<TopicMastery>,
): AlertDraft[] {
  const planTopicIds = new Set(input.planTopics.map((topic) => topic.topicId))
  const previousTopics = new Set(
    (input.previousPlanTopicIds ?? []).flatMap((topicIds) => [...topicIds]),
  )
  const statsByTopicId = new Map(stats.map((topic) => [topic.topicId, topic]))
  const planned = masteryByTopic.filter((topic) => planTopicIds.has(topic.topicId))
  const outsidePlanCritical = masteryByTopic.filter(
    (topic) => !planTopicIds.has(topic.topicId) && topic.masteryScore < 45,
  )
  const strongPlannedTopics = planned.filter((topic) => topic.masteryScore >= 70)

  const alerts: AlertDraft[] = []

  if (
    outsidePlanCritical.length >= 2 &&
    planned.length > 0 &&
    strongPlannedTopics.length / planned.length > 0.5
  ) {
    alerts.push({
      schoolId: input.schoolId,
      studentKey: input.studentKey,
      topicId: null,
      topicLabel: null,
      alertType: 'misaligned_plan',
      severity: 'critical',
      message: `O plano atual cobre majoritariamente tópicos já estabilizados, enquanto ${outsidePlanCritical
        .slice(0, 2)
        .map((topic) => topic.canonicalLabel)
        .join(' e ')} seguem críticos fora da trilha.`,
      evidence: {
        ignored_topic_ids: outsidePlanCritical.slice(0, 3).map((topic) => topic.topicId),
        strong_planned_topic_ids: strongPlannedTopics.map((topic) => topic.topicId),
      },
      status: 'active',
    })
  }

  for (const topic of planned) {
    const topicStats = statsByTopicId.get(topic.topicId)

    if (
      previousTopics.has(topic.topicId) &&
      (
        topic.masteryScore < 45 ||
        (topicStats?.trendDelta != null && topicStats.trendDelta < 10)
      )
    ) {
      alerts.push({
        schoolId: input.schoolId,
        studentKey: input.studentKey,
        topicId: topic.topicId,
        topicLabel: topic.canonicalLabel,
        alertType: 'not_absorbed',
        severity: 'warning',
        message: `${topic.canonicalLabel} reapareceu no plano recente, mas o domínio continua insuficiente.`,
        evidence: {
          mastery_score: topic.masteryScore,
          recent_accuracy: topic.recentAccuracy,
          trend_delta: topicStats?.trendDelta ?? null,
          sample_size: topic.sampleSize,
        },
        status: 'active',
      })
    }

    if (
      topic.masteryScore >= 85 &&
      topic.recentAccuracy >= 0.9
    ) {
      alerts.push({
        schoolId: input.schoolId,
        studentKey: input.studentKey,
        topicId: topic.topicId,
        topicLabel: topic.canonicalLabel,
        alertType: 'can_advance',
        severity: 'info',
        message: `${topic.canonicalLabel} já apresenta domínio alto; o mentor pode avançar a trilha.`,
        evidence: {
          mastery_score: topic.masteryScore,
          recent_accuracy: topic.recentAccuracy,
        },
        status: 'active',
      })
    }
  }

  for (const topic of masteryByTopic) {
    const topicStats = statsByTopicId.get(topic.topicId)
    if (
      topic.masteryScore < 45 &&
      topic.consecutiveAssessmentsWithError >= 3 &&
      (topicStats?.trendDelta == null || topicStats.trendDelta < 5)
    ) {
      alerts.push({
        schoolId: input.schoolId,
        studentKey: input.studentKey,
        topicId: topic.topicId,
        topicLabel: topic.canonicalLabel,
        alertType: 'persistent_gap',
        severity: 'critical',
        message: `${topic.canonicalLabel} persiste como lacuna em múltiplos simulados consecutivos.`,
        evidence: {
          mastery_score: topic.masteryScore,
          consecutive_assessments_with_error:
            topic.consecutiveAssessmentsWithError,
          trend_delta: topicStats?.trendDelta ?? null,
        },
        status: 'active',
      })
    }
  }

  const uniqueById = new Map<string, AlertDraft>()
  for (const alert of alerts) {
    const existing = uniqueById.get(buildAlertId(alert.alertType, alert.topicId))
    if (!existing) {
      uniqueById.set(buildAlertId(alert.alertType, alert.topicId), alert)
      continue
    }

    const severityRank: Record<MentorAlertSeverity, number> = {
      info: 0,
      warning: 1,
      critical: 2,
    }

    if (severityRank[alert.severity] > severityRank[existing.severity]) {
      uniqueById.set(buildAlertId(alert.alertType, alert.topicId), alert)
    }
  }

  return [...uniqueById.values()]
}

function determineAttentionStatus(
  plannedTopics: ReadonlyArray<TopicMastery>,
  alerts: ReadonlyArray<AlertDraft>,
): MentorAttentionStatus {
  if (plannedTopics.length === 0) {
    return 'sem_dados'
  }

  const avgMastery = average(plannedTopics.map((topic) => topic.masteryScore))
  const hasCritical = alerts.some((alert) => alert.severity === 'critical')
  const hasWarning = alerts.some((alert) => alert.severity === 'warning')

  if (hasCritical || avgMastery < 45) {
    return 'vermelho'
  }

  if (hasWarning || avgMastery < 70) {
    return 'amarelo'
  }

  return 'verde'
}

function buildBriefing(
  status: MentorAttentionStatus,
  criticalTopics: ReadonlyArray<TopicMastery>,
  alerts: ReadonlyArray<AlertDraft>,
): MentorBriefing {
  const topTopics = criticalTopics.slice(0, 2).map((topic) => topic.canonicalLabel)
  const highlights = alerts.slice(0, 3).map((alert) => alert.message)

  if (status === 'vermelho') {
    const summary = topTopics.length > 0
      ? `O plano atual não está cobrindo adequadamente ${topTopics.join(' e ')}. Recomendamos reforçar a base antes de avançar para conteúdos de manutenção.`
      : 'O aluno apresenta lacunas críticas sem cobertura suficiente no plano atual. Recomendamos reforçar a base imediatamente.'
    return {
      summary,
      action: 'Reforçar base',
      highlights,
    }
  }

  if (alerts.some((alert) => alert.alertType === 'can_advance')) {
    const summary = topTopics.length > 0
      ? `${topTopics.join(' e ')} já apresentam domínio consistente. O mentor pode acelerar a trilha sem perder controle de qualidade.`
      : 'Os tópicos planejados apresentam domínio consistente. O mentor pode avançar conteúdo com segurança.'
    return {
      summary,
      action: 'Avançar conteúdo',
      highlights,
    }
  }

  const summary = topTopics.length > 0
    ? `O aluno segue a trilha com atenção pontual em ${topTopics.join(' e ')}. Vale manter o plano e monitorar a próxima avaliação.`
    : 'O aluno está aderente ao plano atual. Vale manter a trilha e monitorar a próxima avaliação.'

  return {
    summary,
    action: 'Manter trilha',
    highlights,
  }
}

export function buildStudentPerformanceAudit(
  input: BuildAuditInput,
): StudentPerformanceAudit {
  const planTopicIds = new Set(input.planTopics.map((topic) => topic.topicId))
  const stats = buildTopicStats(input.records)
  const masteryByTopic = stats
    .map((topic) => toTopicMastery(topic, planTopicIds))
    .sort((left, right) => left.masteryScore - right.masteryScore)

  const plannedOrder = new Map(
    input.planTopics.map((topic) => [topic.topicId, topic.plannedOrder]),
  )
  const plannedTopics = masteryByTopic
    .filter((topic) => planTopicIds.has(topic.topicId))
    .sort(
      (left, right) =>
        (plannedOrder.get(left.topicId) ?? 999) - (plannedOrder.get(right.topicId) ?? 999),
    )
  const criticalTopics = masteryByTopic.filter((topic) => topic.masteryScore < 70)
  const alertsDraft = buildAlerts(input, stats, masteryByTopic)
  const overallStatus = determineAttentionStatus(plannedTopics, alertsDraft)
  const briefing = buildBriefing(overallStatus, criticalTopics, alertsDraft)
  const analyzedAt = input.analyzedAt ?? new Date().toISOString()

  const alerts: MentorAlert[] = alertsDraft.map((alert) => ({
    id: buildAlertId(alert.alertType, alert.topicId),
    analysisRunId: '',
    schoolId: alert.schoolId,
    studentKey: alert.studentKey,
    topicId: alert.topicId,
    topicLabel: alert.topicLabel,
    alertType: alert.alertType,
    severity: alert.severity,
    message: alert.message,
    evidence: alert.evidence,
    status: alert.status,
    createdAt: analyzedAt,
    updatedAt: analyzedAt,
  }))

  return {
    mentorPlanId: input.mentorPlanId,
    schoolId: input.schoolId,
    studentKey: input.studentKey,
    overallStatus,
    briefing,
    plannedTopics,
    criticalTopics,
    masteryByTopic,
    alerts,
    coverageMetrics: {
      mappedQuestionsCount: input.mappedQuestionsCount,
      unmappedQuestionsCount: input.unmappedQuestionsCount,
      plannedTopicsCount: input.planTopics.length,
      criticalTopicsCount: criticalTopics.length,
    },
    analyzedAt,
  }
}
