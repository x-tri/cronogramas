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
  console.log('[SimuladoAnalyzer] Iniciando busca para matrícula:', matricula)

  // Normalizar matrícula para busca
  const normalizedMatricula = matricula.trim().replace(/^0+/, '') || '0'
  console.log('[SimuladoAnalyzer] Matrícula normalizada:', normalizedMatricula)

  // Buscar o aluno primeiro para obter o sheet_code (para buscar notas TRI depois)
  let student = await getStudentByMatricula(matricula)
  if (!student && normalizedMatricula !== matricula.trim()) {
    student = await getStudentByMatricula(normalizedMatricula)
  }

  // Buscar notas TRI da tabela student_answers - SEMPRE priorizar matrícula
  let triScores: {
    tri_lc: number | null
    tri_ch: number | null
    tri_cn: number | null
    tri_mt: number | null
  } | null = null
  if (matricula) {
    console.log('[SimuladoAnalyzer] Buscando notas TRI pela matrícula:', matricula)
    triScores = await getTRIScoresFromStudentAnswers(matricula, student?.sheet_code)
    console.log('[SimuladoAnalyzer] Notas TRI retornadas:', triScores)
  } else {
    console.log('[SimuladoAnalyzer] Matrícula não fornecida')
  }

  // ===== NOVO: 0. Tentar buscar erros REAIS linkando com conteúdos da prova =====
  console.log(
    '[SimuladoAnalyzer] === TENTATIVA 0: Buscando erros reais com conteúdos ===',
  )
  const realErrors = await getRealStudentErrors(matricula)
  if (realErrors && realErrors.wrongQuestions.length > 0) {
    console.log(
      '[SimuladoAnalyzer] ✅ Erros reais encontrados:',
      realErrors.wrongQuestions.length,
    )

    // Montar o resultado completo
    const topicsSummary = groupByTopic(realErrors.wrongQuestions)

    // Criar um objeto de resultado compatível com notas TRI
    const result: SimuladoResult = {
      exam: realErrors.exam || {
        id: 'real-exam',
        title: 'Simulado - Erros Reais',
        answer_key: [],
        question_contents: null,
      },
      studentAnswer: {
        id: matricula,
        exam_id: realErrors.exam?.id || 'real-exam',
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
      topicsSummary,
    }

    console.log(
      '[SimuladoAnalyzer] ✅ Retornando resultado com erros reais e notas TRI!',
    )
    return result
  }
  console.log('[SimuladoAnalyzer] ⚠️ Não encontrou erros reais, tentando outros métodos...')

  // 1. Tentar buscar da tabela PROJETOS (principal)
  console.log('[SimuladoAnalyzer] === TENTATIVA 1: Buscando na tabela projetos ===')
  let result = await getSimuladoFromProjetos(matricula)
  if (result) {
    console.log('[SimuladoAnalyzer] ✅ Encontrado na tabela projetos!')
    // Mesclar notas TRI se não estiverem presentes
    if (
      triScores &&
      (!result.studentAnswer.tri_lc ||
        !result.studentAnswer.tri_ch ||
        !result.studentAnswer.tri_cn ||
        !result.studentAnswer.tri_mt)
    ) {
      result.studentAnswer.tri_lc = result.studentAnswer.tri_lc ?? triScores.tri_lc
      result.studentAnswer.tri_ch = result.studentAnswer.tri_ch ?? triScores.tri_ch
      result.studentAnswer.tri_cn = result.studentAnswer.tri_cn ?? triScores.tri_cn
      result.studentAnswer.tri_mt = result.studentAnswer.tri_mt ?? triScores.tri_mt
      console.log('[SimuladoAnalyzer] Notas TRI mescladas ao resultado da tabela projetos')
    }
    return result
  }

  // 1.1 Tentar com matrícula normalizada na tabela projetos
  if (normalizedMatricula !== matricula.trim()) {
    console.log(
      '[SimuladoAnalyzer] TENTATIVA 1.1: Buscando na tabela projetos com matrícula normalizada:',
      normalizedMatricula,
    )
    result = await getSimuladoFromProjetos(normalizedMatricula)
    if (result) {
      console.log(
        '[SimuladoAnalyzer] ✅ Encontrado na tabela projetos com matrícula normalizada!',
      )
      // Mesclar notas TRI se não estiverem presentes
      if (
        triScores &&
        (!result.studentAnswer.tri_lc ||
          !result.studentAnswer.tri_ch ||
          !result.studentAnswer.tri_cn ||
          !result.studentAnswer.tri_mt)
      ) {
        result.studentAnswer.tri_lc = result.studentAnswer.tri_lc ?? triScores.tri_lc
        result.studentAnswer.tri_ch = result.studentAnswer.tri_ch ?? triScores.tri_ch
        result.studentAnswer.tri_cn = result.studentAnswer.tri_cn ?? triScores.tri_cn
        result.studentAnswer.tri_mt = result.studentAnswer.tri_mt ?? triScores.tri_mt
      }
      return result
    }
  }

  // 2. Fallback para tabela student_answers + exams
  console.log(
    '[SimuladoAnalyzer] TENTATIVA 2: Fallback para student_answers + exams...',
  )
  result = await getLatestSimuladoResult(matricula)

  // Se não encontrou e matrícula foi normalizada, tentar com formato normalizado
  if (!result && normalizedMatricula !== matricula.trim()) {
    console.log(
      '[SimuladoAnalyzer] TENTATIVA 2.1: Fallback com matrícula normalizada:',
      normalizedMatricula,
    )
    result = await getLatestSimuladoResult(normalizedMatricula)
  }

  // Se não encontrou por matrícula, mas encontrou student com sheet_code, tentar por sheet_code
  if (!result && student?.sheet_code) {
    console.log(
      '[SimuladoAnalyzer] TENTATIVA 2.2: Buscando por sheet_code:',
      student.sheet_code,
    )
    result = await getLatestSimuladoResult(student.sheet_code)
  }

  if (!result) {
    console.log('[SimuladoAnalyzer] ❌ Nenhum resultado encontrado')
    return null
  }

  // Mesclar notas TRI ao resultado final (fallback)
  if (
    triScores &&
    (!result.studentAnswer.tri_lc ||
      !result.studentAnswer.tri_ch ||
      !result.studentAnswer.tri_cn ||
      !result.studentAnswer.tri_mt)
  ) {
    result.studentAnswer.tri_lc = result.studentAnswer.tri_lc ?? triScores.tri_lc
    result.studentAnswer.tri_ch = result.studentAnswer.tri_ch ?? triScores.tri_ch
    result.studentAnswer.tri_cn = result.studentAnswer.tri_cn ?? triScores.tri_cn
    result.studentAnswer.tri_mt = result.studentAnswer.tri_mt ?? triScores.tri_mt
    console.log('[SimuladoAnalyzer] Notas TRI mescladas ao resultado final')
  }

  console.log('[SimuladoAnalyzer] ✅ Encontrado no fallback student_answers')
  return result
}
