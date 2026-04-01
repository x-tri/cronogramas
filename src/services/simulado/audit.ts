import type { SimuladoResult } from '../../types/supabase'

export type SimuladoAudit = {
  expectedTotal: number | null
  accountedTotal: number
  uncategorizedCount: number
  overflowCount: number
  answersCount: number
  wrongQuestionsCount: number
  wrongAnswersMismatch: number
  hasDiscrepancy: boolean
  explanation: string | null
}

function inferExpectedTotal(result: SimuladoResult): number | null {
  const questionContentsCount = result.exam.question_contents?.length ?? 0
  if (questionContentsCount > 0) return questionContentsCount

  const hasAllTriScores =
    result.studentAnswer.tri_lc != null &&
    result.studentAnswer.tri_ch != null &&
    result.studentAnswer.tri_cn != null &&
    result.studentAnswer.tri_mt != null

  const maxQuestionNumber = result.wrongQuestions.reduce(
    (max, question) => Math.max(max, question.questionNumber),
    0,
  )

  if (hasAllTriScores || maxQuestionNumber > 135) return 180
  if (maxQuestionNumber > 90) return 135
  if (maxQuestionNumber > 45) return 90
  if (maxQuestionNumber > 0) return 45

  const answersCount = result.studentAnswer.answers?.length ?? 0
  return answersCount > 0 ? answersCount : null
}

export function buildSimuladoAudit(result: SimuladoResult): SimuladoAudit {
  const expectedTotal = inferExpectedTotal(result)
  const accountedTotal =
    result.studentAnswer.correct_answers +
    result.studentAnswer.wrong_answers +
    result.studentAnswer.blank_answers

  const uncategorizedCount =
    expectedTotal == null ? 0 : Math.max(expectedTotal - accountedTotal, 0)
  const overflowCount =
    expectedTotal == null ? 0 : Math.max(accountedTotal - expectedTotal, 0)
  const answersCount = result.studentAnswer.answers?.length ?? 0
  const wrongQuestionsCount = result.wrongQuestions.length
  const wrongAnswersMismatch = Math.abs(
    result.studentAnswer.wrong_answers - wrongQuestionsCount,
  )

  let explanation: string | null = null

  if (uncategorizedCount > 0) {
    explanation =
      result.studentAnswer.blank_answers === 0
        ? 'Os totais vindos da origem nao fecham o total esperado da prova. Ha indicio de questoes nao classificadas como acerto, erro ou branco.'
        : 'Os totais vindos da origem nao fecham o total esperado da prova. Parte das questoes nao esta sendo classificada corretamente.'
  } else if (overflowCount > 0) {
    explanation =
      'Os totais vindos da origem ultrapassam o total esperado da prova. Ha inconsistencia nos contadores carregados.'
  } else if (wrongAnswersMismatch > 0) {
    explanation =
      'A contagem de erros exibida nao bate com a lista detalhada de questoes erradas usada pelo frontend.'
  }

  return {
    expectedTotal,
    accountedTotal,
    uncategorizedCount,
    overflowCount,
    answersCount,
    wrongQuestionsCount,
    wrongAnswersMismatch,
    hasDiscrepancy:
      uncategorizedCount > 0 || overflowCount > 0 || wrongAnswersMismatch > 0,
    explanation,
  }
}
