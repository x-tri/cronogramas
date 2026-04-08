import { describe, expect, it } from 'vitest'
import { buildSimuladoAudit } from './audit'
import type { SimuladoResult } from '../../types/supabase'

function createResult(overrides?: Partial<SimuladoResult>): SimuladoResult {
  return {
    exam: {
      id: 'exam-1',
      title: 'Diagnostica',
      answer_key: [],
      question_contents: null,
    },
    studentAnswer: {
      id: 'answer-1',
      exam_id: 'exam-1',
      student_number: '123',
      student_name: 'Aluno Teste',
      turma: '3A',
      answers: [],
      score: 0,
      correct_answers: 68,
      wrong_answers: 106,
      blank_answers: 0,
      tri_score: null,
      tri_lc: 523.5,
      tri_ch: 603.9,
      tri_cn: 453.2,
      tri_mt: 498.1,
      created_at: new Date().toISOString(),
    },
    wrongQuestions: Array.from({ length: 106 }, (_, index) => ({
      questionNumber: index + 1,
      topic: `Q${index + 1}`,
      studentAnswer: 'A',
      correctAnswer: 'B',
    })),
    topicsSummary: [],
    ...overrides,
  }
}

describe('buildSimuladoAudit', () => {
  it('detecta quando o total nao fecha 180 questoes', () => {
    const audit = buildSimuladoAudit(createResult())

    expect(audit.expectedTotal).toBe(180)
    expect(audit.accountedTotal).toBe(174)
    expect(audit.uncategorizedCount).toBe(6)
    expect(audit.hasDiscrepancy).toBe(true)
  })

  it('nao acusa discrepancia quando os contadores fecham o total esperado', () => {
    const audit = buildSimuladoAudit(
      createResult({
        exam: {
          id: 'exam-45',
          title: 'Lista 45',
          answer_key: [],
          question_contents: Array.from({ length: 45 }, (_, index) => ({
            questionNumber: index + 1,
            answer: 'A',
            content: `Q${index + 1}`,
          })),
        },
        studentAnswer: {
          ...createResult().studentAnswer,
          correct_answers: 30,
          wrong_answers: 10,
          blank_answers: 5,
          tri_lc: null,
          tri_ch: null,
          tri_cn: null,
          tri_mt: null,
        },
        wrongQuestions: Array.from({ length: 10 }, (_, index) => ({
          questionNumber: index + 1,
          topic: `Q${index + 1}`,
          studentAnswer: 'A',
          correctAnswer: 'B',
        })),
      }),
    )

    expect(audit.expectedTotal).toBe(45)
    expect(audit.accountedTotal).toBe(45)
    expect(audit.hasDiscrepancy).toBe(false)
  })
})
