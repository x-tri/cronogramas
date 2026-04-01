import type {
  SimuladoHistoryItem,
  SimuladoResult,
} from '../../types/supabase'
import { groupByTopic } from './helpers'
import {
  getLatestSimuladoResult,
  getStudentAnswersReferenceResult,
  getStudentAnswersSimuladoResult,
  isStudentAnswersHistoryItem,
  listStudentAnswersSimulados,
} from './latest-result'
import {
  getProjetoSimuladoResult,
  getSimuladoFromProjetos,
  listProjetosSimulados,
} from './projetos'
import { getRealStudentErrors } from './real-errors'
import { getStudentByMatricula } from './student'
import { getTRIScoresFromStudentAnswers } from './tri-scores'

function normalizeMatricula(matricula: string): string {
  return matricula.trim().replace(/^0+/, '') || '0'
}

function hasAllTRIScores(result: SimuladoResult): boolean {
  const { tri_lc, tri_ch, tri_cn, tri_mt } = result.studentAnswer
  return tri_lc != null && tri_ch != null && tri_cn != null && tri_mt != null
}

async function mergeTRIScores(
  result: SimuladoResult,
  fallbackStudentNumber?: string | null,
): Promise<SimuladoResult> {
  if (hasAllTRIScores(result)) {
    return result
  }

  const studentNumber =
    result.studentAnswer.student_number || fallbackStudentNumber || undefined

  if (!studentNumber) {
    return result
  }

  const triScores = await getTRIScoresFromStudentAnswers(studentNumber, undefined)
  if (!triScores) {
    return result
  }

  return {
    ...result,
    studentAnswer: {
      ...result.studentAnswer,
      tri_lc: result.studentAnswer.tri_lc ?? triScores.tri_lc,
      tri_ch: result.studentAnswer.tri_ch ?? triScores.tri_ch,
      tri_cn: result.studentAnswer.tri_cn ?? triScores.tri_cn,
      tri_mt: result.studentAnswer.tri_mt ?? triScores.tri_mt,
    },
  }
}

function getAccountedTotal(result: SimuladoResult): number {
  return (
    result.studentAnswer.correct_answers +
    result.studentAnswer.wrong_answers +
    result.studentAnswer.blank_answers
  )
}

async function reconcileWithOfficialAnswers(
  result: SimuladoResult,
  referenceTitle: string | null | undefined,
  referenceDate: string | null | undefined,
  studentNumber: string | null | undefined,
): Promise<SimuladoResult> {
  if (!studentNumber) {
    return result
  }

  const officialResult = await getStudentAnswersReferenceResult(
    studentNumber,
    referenceTitle,
    referenceDate,
  )

  if (!officialResult) {
    return result
  }

  const currentTotal = getAccountedTotal(result)
  const officialTotal = getAccountedTotal(officialResult)
  const shouldAdoptOfficial =
    officialTotal > currentTotal ||
    officialResult.studentAnswer.blank_answers > result.studentAnswer.blank_answers ||
    (officialResult.studentAnswer.answers?.length ?? 0) >
      (result.studentAnswer.answers?.length ?? 0)

  if (!shouldAdoptOfficial) {
    return result
  }

  return {
    ...result,
    exam: {
      ...result.exam,
      question_contents: result.exam.question_contents ?? officialResult.exam.question_contents,
    },
    studentAnswer: {
      ...result.studentAnswer,
      exam_id: officialResult.studentAnswer.exam_id,
      answers: officialResult.studentAnswer.answers,
      correct_answers: officialResult.studentAnswer.correct_answers,
      wrong_answers: officialResult.studentAnswer.wrong_answers,
      blank_answers: officialResult.studentAnswer.blank_answers,
      created_at: officialResult.studentAnswer.created_at,
    },
    wrongQuestions:
      officialResult.wrongQuestions.length > 0
        ? officialResult.wrongQuestions
        : result.wrongQuestions,
    topicsSummary:
      officialResult.topicsSummary.length > 0
        ? officialResult.topicsSummary
        : result.topicsSummary,
  }
}

function markLatest(items: SimuladoHistoryItem[]): SimuladoHistoryItem[] {
  return items.map((item, index) => ({
    ...item,
    isLatest: index === 0,
  }))
}

export async function listStudentSimulados(
  matricula: string,
): Promise<SimuladoHistoryItem[]> {
  const normalized = normalizeMatricula(matricula)
  const student = await getStudentByMatricula(matricula).then((found) => {
    if (found) return found
    if (normalized !== matricula.trim()) {
      return getStudentByMatricula(normalized)
    }
    return null
  })

  const projetosHistory = await listProjetosSimulados(matricula)
  if (projetosHistory.length > 0) {
    return markLatest(projetosHistory)
  }

  const fallbackIdentifiers = [matricula, normalized, student?.sheet_code]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)

  for (const identifier of fallbackIdentifiers) {
    const history = await listStudentAnswersSimulados(identifier as string)
    if (history.length > 0) {
      return markLatest(history)
    }
  }

  return []
}

export async function getSimuladoResultByHistoryItem(
  item: SimuladoHistoryItem,
): Promise<SimuladoResult | null> {
  const baseResult = isStudentAnswersHistoryItem(item)
    ? await getStudentAnswersSimuladoResult(item)
    : await getProjetoSimuladoResult(item)

  if (!baseResult) {
    return null
  }

  const reconciledResult = isStudentAnswersHistoryItem(item)
    ? baseResult
    : await reconcileWithOfficialAnswers(
        baseResult,
        item.title,
        item.date,
        item.studentNumber,
      )

  return mergeTRIScores(reconciledResult, item.studentNumber)
}

export async function analyzeStudentSimulado(
  matricula: string,
): Promise<SimuladoResult | null> {
  const normalized = normalizeMatricula(matricula)

  const [student, realErrors, projetoResult, triScores] = await Promise.all([
    getStudentByMatricula(matricula).then((found) =>
      found ? found : normalized !== matricula.trim() ? getStudentByMatricula(normalized) : null,
    ),
    getRealStudentErrors(matricula),
    getSimuladoFromProjetos(matricula).then((result) =>
      result ? result : normalized !== matricula.trim() ? getSimuladoFromProjetos(normalized) : null,
    ),
    getTRIScoresFromStudentAnswers(matricula, undefined),
  ])

  const mergeLegacyTRI = (result: SimuladoResult): SimuladoResult => {
    if (!triScores) return result
    return {
      ...result,
      studentAnswer: {
        ...result.studentAnswer,
        tri_lc: result.studentAnswer.tri_lc ?? triScores.tri_lc,
        tri_ch: result.studentAnswer.tri_ch ?? triScores.tri_ch,
        tri_cn: result.studentAnswer.tri_cn ?? triScores.tri_cn,
        tri_mt: result.studentAnswer.tri_mt ?? triScores.tri_mt,
      },
    }
  }

  if (realErrors && realErrors.wrongQuestions.length > 0) {
    return mergeLegacyTRI({
      exam: realErrors.exam ?? {
        id: 'real-exam',
        title: 'Simulado - Erros Reais',
        answer_key: [],
        question_contents: null,
      },
      studentAnswer: {
        id: matricula,
        exam_id: realErrors.exam?.id ?? 'real-exam',
        student_number: matricula,
        student_name: student?.name ?? null,
        turma: student?.turma ?? null,
        answers: [],
        score: 0,
        correct_answers: 180 - realErrors.wrongQuestions.length,
        wrong_answers: realErrors.wrongQuestions.length,
        blank_answers: 0,
        tri_score: null,
        tri_lc: triScores?.tri_lc ?? null,
        tri_ch: triScores?.tri_ch ?? null,
        tri_cn: triScores?.tri_cn ?? null,
        tri_mt: triScores?.tri_mt ?? null,
        created_at: new Date().toISOString(),
      },
      wrongQuestions: realErrors.wrongQuestions,
      topicsSummary: groupByTopic(realErrors.wrongQuestions),
    })
  }

  if (projetoResult) {
    const reconciledProjetoResult = await reconcileWithOfficialAnswers(
      projetoResult,
      projetoResult.exam.title,
      projetoResult.studentAnswer.created_at,
      matricula,
    )
    return mergeLegacyTRI(reconciledProjetoResult)
  }

  const sheetCode = student?.sheet_code

  const fallback = await (async () => {
    const result = await getLatestSimuladoResult(matricula)
    if (result) return result
    if (normalized !== matricula.trim()) {
      const normalizedResult = await getLatestSimuladoResult(normalized)
      if (normalizedResult) return normalizedResult
    }
    if (sheetCode) return getLatestSimuladoResult(sheetCode)
    return null
  })()

  if (!fallback) return null
  return mergeLegacyTRI(fallback)
}
