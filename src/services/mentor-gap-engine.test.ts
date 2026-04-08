import { describe, expect, it } from 'vitest'
import { buildStudentPerformanceAudit, weightQuestionByDifficulty } from './mentor-gap-engine'

function buildBaseInput() {
  return {
    mentorPlanId: 'plan-1',
    schoolId: 'school-1',
    studentKey: 'student-1',
    mappedQuestionsCount: 0,
    unmappedQuestionsCount: 0,
  }
}

describe('weightQuestionByDifficulty', () => {
  it('aplica clamp no peso TRI', () => {
    expect(weightQuestionByDifficulty(null)).toBe(1)
    expect(weightQuestionByDifficulty(4)).toBe(1.5)
    expect(weightQuestionByDifficulty(-4)).toBe(0.5)
  })
})

describe('buildStudentPerformanceAudit', () => {
  it('marca sem_dados quando não há questões mapeadas suficientes', () => {
    const audit = buildStudentPerformanceAudit({
      ...buildBaseInput(),
      planTopics: [
        {
          topicId: 'topic-a',
          canonicalLabel: 'topic-a',
          areaSigla: 'MT',
          plannedOrder: 0,
        },
      ],
      records: [],
    })

    expect(audit.overallStatus).toBe('sem_dados')
    expect(audit.alerts).toHaveLength(0)
  })

  it('calcula mastery usando ponderação de dificuldade', () => {
    const audit = buildStudentPerformanceAudit({
      ...buildBaseInput(),
      planTopics: [
        {
          topicId: 'topic-a',
          canonicalLabel: 'topic-a',
          areaSigla: 'MT',
          plannedOrder: 0,
        },
      ],
      records: [
        {
          topicId: 'topic-a',
          canonicalLabel: 'topic-a',
          areaSigla: 'MT',
          examId: 'exam-1',
          assessedAt: '2026-03-01T10:00:00.000Z',
          questionNumber: 1,
          correct: true,
          difficulty: 2,
        },
        {
          topicId: 'topic-a',
          canonicalLabel: 'topic-a',
          areaSigla: 'MT',
          examId: 'exam-2',
          assessedAt: '2026-03-15T10:00:00.000Z',
          questionNumber: 1,
          correct: false,
          difficulty: -2,
        },
      ],
      mappedQuestionsCount: 2,
    })

    expect(audit.masteryByTopic[0]?.weightedAccuracy).toBe(0.7)
    expect(audit.masteryByTopic[0]?.masteryScore).toBe(69)
    expect(audit.overallStatus).toBe('amarelo')
  })

  it('dispara persistent_gap após três avaliações consecutivas com erro', () => {
    const audit = buildStudentPerformanceAudit({
      ...buildBaseInput(),
      planTopics: [
        {
          topicId: 'topic-gap',
          canonicalLabel: 'topic-gap',
          areaSigla: 'CH',
          plannedOrder: 0,
        },
      ],
      records: [
        {
          topicId: 'topic-gap',
          canonicalLabel: 'topic-gap',
          areaSigla: 'CH',
          examId: 'exam-1',
          assessedAt: '2026-01-10T10:00:00.000Z',
          questionNumber: 1,
          correct: false,
          difficulty: null,
        },
        {
          topicId: 'topic-gap',
          canonicalLabel: 'topic-gap',
          areaSigla: 'CH',
          examId: 'exam-2',
          assessedAt: '2026-02-10T10:00:00.000Z',
          questionNumber: 1,
          correct: false,
          difficulty: null,
        },
        {
          topicId: 'topic-gap',
          canonicalLabel: 'topic-gap',
          areaSigla: 'CH',
          examId: 'exam-3',
          assessedAt: '2026-03-10T10:00:00.000Z',
          questionNumber: 1,
          correct: false,
          difficulty: null,
        },
      ],
      mappedQuestionsCount: 3,
    })

    expect(audit.overallStatus).toBe('vermelho')
    expect(audit.alerts.some((alert) => alert.alertType === 'persistent_gap')).toBe(true)
  })

  it('dispara not_absorbed quando o tópico reaparece sem evolução suficiente', () => {
    const audit = buildStudentPerformanceAudit({
      ...buildBaseInput(),
      planTopics: [
        {
          topicId: 'topic-repeat',
          canonicalLabel: 'topic-repeat',
          areaSigla: 'LC',
          plannedOrder: 0,
        },
      ],
      previousPlanTopicIds: [['topic-repeat']],
      records: [
        {
          topicId: 'topic-repeat',
          canonicalLabel: 'topic-repeat',
          areaSigla: 'LC',
          examId: 'exam-1',
          assessedAt: '2026-01-05T10:00:00.000Z',
          questionNumber: 1,
          correct: false,
          difficulty: null,
        },
        {
          topicId: 'topic-repeat',
          canonicalLabel: 'topic-repeat',
          areaSigla: 'LC',
          examId: 'exam-2',
          assessedAt: '2026-03-20T10:00:00.000Z',
          questionNumber: 1,
          correct: false,
          difficulty: null,
        },
      ],
      mappedQuestionsCount: 2,
    })

    expect(audit.alerts.some((alert) => alert.alertType === 'not_absorbed')).toBe(true)
  })

  it('dispara misaligned_plan quando gaps críticos ficam fora do plano', () => {
    const audit = buildStudentPerformanceAudit({
      ...buildBaseInput(),
      planTopics: [
        {
          topicId: 'topic-strong-a',
          canonicalLabel: 'topic-strong-a',
          areaSigla: 'CN',
          plannedOrder: 0,
        },
        {
          topicId: 'topic-strong-b',
          canonicalLabel: 'topic-strong-b',
          areaSigla: 'CN',
          plannedOrder: 1,
        },
      ],
      records: [
        {
          topicId: 'topic-strong-a',
          canonicalLabel: 'topic-strong-a',
          areaSigla: 'CN',
          examId: 'exam-1',
          assessedAt: '2026-03-01T10:00:00.000Z',
          questionNumber: 1,
          correct: true,
          difficulty: null,
        },
        {
          topicId: 'topic-strong-b',
          canonicalLabel: 'topic-strong-b',
          areaSigla: 'CN',
          examId: 'exam-1',
          assessedAt: '2026-03-01T10:00:00.000Z',
          questionNumber: 2,
          correct: true,
          difficulty: null,
        },
        {
          topicId: 'topic-gap-a',
          canonicalLabel: 'topic-gap-a',
          areaSigla: 'MT',
          examId: 'exam-2',
          assessedAt: '2026-03-12T10:00:00.000Z',
          questionNumber: 1,
          correct: false,
          difficulty: null,
        },
        {
          topicId: 'topic-gap-b',
          canonicalLabel: 'topic-gap-b',
          areaSigla: 'MT',
          examId: 'exam-3',
          assessedAt: '2026-03-18T10:00:00.000Z',
          questionNumber: 1,
          correct: false,
          difficulty: null,
        },
      ],
      mappedQuestionsCount: 4,
    })

    expect(audit.alerts.some((alert) => alert.alertType === 'misaligned_plan')).toBe(true)
    expect(audit.overallStatus).toBe('vermelho')
  })

  it('dispara can_advance quando o tópico do plano já está dominado', () => {
    const audit = buildStudentPerformanceAudit({
      ...buildBaseInput(),
      planTopics: [
        {
          topicId: 'topic-mastered',
          canonicalLabel: 'topic-mastered',
          areaSigla: 'LC',
          plannedOrder: 0,
        },
      ],
      records: [
        {
          topicId: 'topic-mastered',
          canonicalLabel: 'topic-mastered',
          areaSigla: 'LC',
          examId: 'exam-1',
          assessedAt: '2026-02-05T10:00:00.000Z',
          questionNumber: 1,
          correct: true,
          difficulty: null,
        },
        {
          topicId: 'topic-mastered',
          canonicalLabel: 'topic-mastered',
          areaSigla: 'LC',
          examId: 'exam-2',
          assessedAt: '2026-03-05T10:00:00.000Z',
          questionNumber: 1,
          correct: true,
          difficulty: null,
        },
      ],
      mappedQuestionsCount: 2,
    })

    expect(audit.alerts.some((alert) => alert.alertType === 'can_advance')).toBe(true)
    expect(audit.briefing.action).toBe('Avançar conteúdo')
  })
})
