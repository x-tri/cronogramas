import type { SimuladoResult } from '../../types/supabase'
import { groupByTopic } from './helpers'
import { getLatestSimuladoResult } from './latest-result'
import { getSimuladoFromProjetos } from './projetos'
import { getRealStudentErrors } from './real-errors'
import { getStudentByMatricula } from './student'
import { getTRIScoresFromStudentAnswers } from './tri-scores'

export async function analyzeStudentSimulado(
  matricula: string,
): Promise<SimuladoResult | null> {
  const normalized = matricula.trim().replace(/^0+/, '') || '0'

  // ── Disparar todas as buscas em paralelo ──────────────────────────────────
  const [student, realErrors, projetoResult, triScores] = await Promise.all([
    getStudentByMatricula(matricula).then(s =>
      s ? s : normalized !== matricula.trim() ? getStudentByMatricula(normalized) : null
    ),
    getRealStudentErrors(matricula),
    getSimuladoFromProjetos(matricula).then(r =>
      r ? r : normalized !== matricula.trim() ? getSimuladoFromProjetos(normalized) : null
    ),
    getTRIScoresFromStudentAnswers(matricula, undefined),
  ])

  // Função auxiliar: mescla notas TRI no resultado se estiverem faltando
  const mergeTRI = (result: SimuladoResult): SimuladoResult => {
    if (!triScores) return result
    const sa = result.studentAnswer
    sa.tri_lc = sa.tri_lc ?? triScores.tri_lc
    sa.tri_ch = sa.tri_ch ?? triScores.tri_ch
    sa.tri_cn = sa.tri_cn ?? triScores.tri_cn
    sa.tri_mt = sa.tri_mt ?? triScores.tri_mt
    return result
  }

  // ── Prioridade 0: erros reais linkados a conteúdos ────────────────────────
  if (realErrors && realErrors.wrongQuestions.length > 0) {
    return mergeTRI({
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

  // ── Prioridade 1: tabela projetos ─────────────────────────────────────────
  if (projetoResult) {
    return mergeTRI(projetoResult)
  }

  // ── Prioridade 2: fallback student_answers + exams ────────────────────────
  const sheetCode = student?.sheet_code

  const fallback = await (async () => {
    const r = await getLatestSimuladoResult(matricula)
    if (r) return r
    if (normalized !== matricula.trim()) {
      const r2 = await getLatestSimuladoResult(normalized)
      if (r2) return r2
    }
    if (sheetCode) return getLatestSimuladoResult(sheetCode)
    return null
  })()

  if (!fallback) return null
  return mergeTRI(fallback)
}
