/**
 * Adapter dos simulados "mentoria" (novo fluxo, banco primary) para o
 * contrato SimuladoHistoryItem/SimuladoResult do SimuladoAnalyzer legacy.
 *
 * Motivacao: usuario quer ver os simulados novos no mesmo card "Simulado"
 * que ja lista os legacy (projetos + student_answers do banco dedicado).
 * Este module resolve a matricula -> students.id e monta os items/results
 * a partir das tabelas simulados/simulado_itens/simulado_respostas.
 */

import { supabase } from '../../lib/supabase'
import type {
  Exam,
  MentoriaSimuladoHistoryItem,
  SimuladoResult,
  StudentAnswer,
  TopicSummary,
  WrongQuestion,
} from '../../types/supabase'

/**
 * Resolve students.id a partir da matricula (banco primary).
 * O currentStudent.id do store e legacy (= matricula).
 */
async function resolveStudentId(matricula: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('matricula', matricula.trim())
    .maybeSingle()
  if (error || !data) return null
  return data.id as string
}

interface RespostaWithSim {
  id: string
  simulado_id: string
  student_id: string
  submitted_at: string
  simulados: { title: string; published_at: string | null } | null
}

/**
 * Lista simulados do banco primary que o aluno (por matricula) respondeu.
 * Retorna items no formato SimuladoHistoryItem para merge com o legacy.
 */
export async function listMentoriaSimulados(
  matricula: string,
): Promise<MentoriaSimuladoHistoryItem[]> {
  const studentId = await resolveStudentId(matricula)
  if (!studentId) return []

  const { data, error } = await supabase
    .from('simulado_respostas')
    .select(
      'id, simulado_id, student_id, submitted_at, simulados:simulado_id (title, published_at)',
    )
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })

  if (error || !data) return []

  const rows = data as unknown as RespostaWithSim[]
  return rows.map((r) => ({
    id: `mentoria:${r.id}`,
    source: 'mentoria' as const,
    title: r.simulados?.title ?? 'Simulado ENEM',
    date: r.submitted_at,
    isLatest: false, // `markLatest` no analyze.ts marca o 1o da lista consolidada
    simuladoId: r.simulado_id,
    respostaId: r.id,
    studentId: r.student_id,
  }))
}

interface RespostaRow {
  id: string
  simulado_id: string
  student_id: string
  submitted_at: string
  answers: Record<string, string>
  tri_lc: number | null
  tri_ch: number | null
  tri_cn: number | null
  tri_mt: number | null
  acertos_lc: number
  erros_lc: number
  branco_lc: number
  acertos_ch: number
  erros_ch: number
  branco_ch: number
  acertos_cn: number
  erros_cn: number
  branco_cn: number
  acertos_mt: number
  erros_mt: number
  branco_mt: number
  // Suporta ambos formatos: legacy (number) e novo ({ area, n }).
  // Ver migration 027 e ranking-aggregations.unwrapErroValor.
  erros_por_topico: Record<string, number | { area: string; n: number }>
  erros_por_habilidade: Record<string, number>
}

interface ItemRow {
  numero: number
  area: string
  gabarito: string
  dificuldade: number
  topico: string | null
  habilidade: string | null
}

interface SimuladoRow {
  id: string
  title: string
  school_id: string
  turmas: string[]
  status: string
  published_at: string | null
}

/**
 * Monta um SimuladoResult a partir das tabelas simulado_*.
 * Reutiliza a forma esperada pelo SimuladoAnalyzer (Exam + StudentAnswer +
 * WrongQuestions + TopicsSummary) para nao quebrar o render legacy.
 */
export async function getMentoriaSimuladoResult(
  item: MentoriaSimuladoHistoryItem,
): Promise<SimuladoResult | null> {
  const [simResult, itensResult, respostaResult] = await Promise.all([
    supabase
      .from('simulados')
      .select('id, title, school_id, turmas, status, published_at')
      .eq('id', item.simuladoId)
      .maybeSingle(),
    supabase
      .from('simulado_itens')
      .select('numero, area, gabarito, dificuldade, topico, habilidade')
      .eq('simulado_id', item.simuladoId)
      .order('numero', { ascending: true }),
    supabase
      .from('simulado_respostas')
      .select('*')
      .eq('id', item.respostaId)
      .maybeSingle(),
  ])

  if (simResult.error || !simResult.data) return null
  if (respostaResult.error || !respostaResult.data) return null
  if (itensResult.error || !itensResult.data) return null
  // Sanity: simulado sem itens cadastrados gera resultado vazio sem sentido
  // (todos os 180 respostas entram como erradas vs gabarito ''). Bail.
  if (itensResult.data.length === 0) return null

  const simulado = simResult.data as SimuladoRow
  const itens = itensResult.data as ItemRow[]
  const resposta = respostaResult.data as RespostaRow

  // answer_key ordenado por numero (1..180)
  const answerKey: string[] = Array(180).fill('')
  const topicoByNumero = new Map<number, string | null>()
  for (const it of itens) {
    if (it.numero >= 1 && it.numero <= 180) {
      answerKey[it.numero - 1] = it.gabarito
      topicoByNumero.set(it.numero, it.topico)
    }
  }

  // Student answers array (ordem numero 1..180)
  const answersArray: string[] = Array(180).fill('')
  for (const [k, v] of Object.entries(resposta.answers ?? {})) {
    const n = Number(k)
    if (n >= 1 && n <= 180) answersArray[n - 1] = v
  }

  // WrongQuestions + contagens
  const wrongQuestions: WrongQuestion[] = []
  const topicBuckets = new Map<string, number[]>()
  let correctCount = 0
  let blankCount = 0
  for (let i = 0; i < 180; i++) {
    const correct = (answerKey[i] || '').toUpperCase().trim()
    const student = (answersArray[i] || '').toUpperCase().trim()
    if (!student || student === '-') {
      blankCount++
      continue
    }
    if (student === correct) {
      correctCount++
      continue
    }
    // Errou
    const numero = i + 1
    const topico = topicoByNumero.get(numero) ?? `Area ${Math.ceil(numero / 45)}`
    wrongQuestions.push({
      examId: item.simuladoId,
      questionNumber: numero,
      topic: topico,
      studentAnswer: student,
      correctAnswer: correct,
    })
    if (!topicBuckets.has(topico)) topicBuckets.set(topico, [])
    topicBuckets.get(topico)!.push(numero)
  }

  const topicsSummary: TopicSummary[] = [...topicBuckets.entries()]
    .map(([topic, questions]) => ({ topic, count: questions.length, questions }))
    .sort((a, b) => b.count - a.count)

  const exam: Exam = {
    id: simulado.id,
    title: simulado.title,
    answer_key: answerKey,
    question_contents: null,
  }

  const studentAnswer: StudentAnswer = {
    id: resposta.id,
    student_number: resposta.student_id, // usar students.id como chave
    student_name: null,
    turma: null,
    exam_id: simulado.id,
    answers: answersArray,
    score: correctCount * 20, // placeholder ~ sem peso TRI oficial
    correct_answers: correctCount,
    wrong_answers: wrongQuestions.length,
    blank_answers: blankCount,
    created_at: resposta.submitted_at,
    tri_score: null,
    tri_lc: resposta.tri_lc != null ? Number(resposta.tri_lc) : null,
    tri_ch: resposta.tri_ch != null ? Number(resposta.tri_ch) : null,
    tri_cn: resposta.tri_cn != null ? Number(resposta.tri_cn) : null,
    tri_mt: resposta.tri_mt != null ? Number(resposta.tri_mt) : null,
  }

  return {
    exam,
    studentAnswer,
    wrongQuestions,
    topicsSummary,
  }
}
