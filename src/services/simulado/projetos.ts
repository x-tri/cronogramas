import { supabase } from '../../lib/supabase'
import type { SimuladoResult, WrongQuestion } from '../../types/supabase'
import {
  distributeErrorsInArea,
  getDetailedTopicByQuestionNumber,
  groupByTopic,
} from './helpers'

/**
 * Busca o resultado do simulado na tabela 'projetos'
 * A coluna 'students' é um array JSONB com os dados dos alunos
 */
export async function getSimuladoFromProjetos(
  matricula: string,
): Promise<SimuladoResult | null> {
  console.log('[getSimuladoFromProjetos] Buscando projetos para matrícula:', matricula)

  // Buscar projetos que contêm o aluno com a matrícula especificada
  // Incluir campos tri_scores e tri_scores_by_area se existirem
  const { data, error } = await supabase
    .from('projetos')
    .select(
      'id, nome, answer_key, question_contents, students, created_at, tri_scores, tri_scores_by_area',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getSimuladoFromProjetos] Error fetching from projetos:', error)
    return null
  }

  console.log(
    '[getSimuladoFromProjetos] Total de projetos retornados:',
    data?.length || 0,
  )

  if (!data || data.length === 0) {
    console.log('[getSimuladoFromProjetos] Nenhum projeto encontrado')
    return null
  }

  // Procurar o aluno dentro da coluna students (JSONB) de cada projeto
  for (const projeto of data) {
    const studentsArray = projeto.students as ProjetoStudent[] | null
    console.log(
      `[getSimuladoFromProjetos] Projeto ${projeto.id}: ${studentsArray?.length || 0} alunos`,
    )

    if (!studentsArray || !Array.isArray(studentsArray)) {
      console.log(
        `[getSimuladoFromProjetos] Projeto ${projeto.id}: students não é array válido`,
      )
      continue
    }

    // Log do primeiro aluno para verificar formato
    if (studentsArray.length > 0) {
      const firstStudent = studentsArray[0]
      console.log(
        `[getSimuladoFromProjetos] Exemplo de aluno no projeto - TODOS OS CAMPOS:`,
        Object.keys(firstStudent).reduce((acc, key) => {
          acc[key] = firstStudent[key as keyof ProjetoStudent]
          return acc
        }, {} as Record<string, unknown>),
      )
    }

    // Busca flexível - converte para string e compara
    const matriculaStr = String(matricula).trim()
    const matriculaNormalized = matriculaStr.replace(/^0+/, '') || '0'

    const studentData = studentsArray.find((s) => {
      const sMatricula = String(s.matricula ?? '').trim()
      const sStudentNumber = String(s.student_number ?? '').trim()
      const sId = String(s.id ?? '').trim()

      // Extrair matrícula do id no formato "merged-{matricula}-{timestamp}"
      const idMatch = sId.match(/merged-(\d+)-\d+$/)
      const matriculaFromId = idMatch ? idMatch[1] : ''

      // Remove zeros à esquerda para comparação
      const sMatriculaNormalized = sMatricula.replace(/^0+/, '') || '0'
      const sStudentNumberNormalized = sStudentNumber.replace(/^0+/, '') || '0'
      const matriculaFromIdNormalized = matriculaFromId.replace(/^0+/, '') || '0'

      return (
        sMatricula === matriculaStr ||
        sStudentNumber === matriculaStr ||
        sMatriculaNormalized === matriculaNormalized ||
        sStudentNumberNormalized === matriculaNormalized ||
        matriculaFromId === matriculaStr ||
        matriculaFromIdNormalized === matriculaNormalized
      )
    })

    if (studentData) {
      console.log('[getSimuladoFromProjetos] Aluno encontrado no projeto:', projeto.id)
      console.log('[getSimuladoFromProjetos] === DADOS BRUTOS COMPLETOS ===')
      console.log(JSON.stringify(studentData, null, 2))
      console.log('[getSimuladoFromProjetos] === FIM DOS DADOS BRUTOS ===')
      console.log(
        '[getSimuladoFromProjetos] Campos disponíveis:',
        Object.keys(studentData).join(', '),
      )
      const result = await convertProjetoStudentToResult(studentData, projeto)
      console.log(
        '[getSimuladoFromProjetos] Resultado convertido com sucesso:',
        !!result,
      )
      return result
    }
  }

  console.log('[getSimuladoFromProjetos] Aluno não encontrado em nenhum projeto')
  return null
}

// Tipo para os dados do aluno dentro da coluna students JSONB
type ProjetoStudent = {
  id?: string // pode estar no formato "merged-{matricula}-{timestamp}"
  // Campos originais (para compatibilidade)
  matricula?: string
  student_number?: string
  name?: string
  nome?: string
  // Campos do projeto atual (Diagnóstica-MarRN)
  studentName?: string
  studentNumber?: string
  turma?: string
  answers?: string[] // respostas do aluno
  score?: number
  confidence?: number
  pageNumber?: number
  fezDia1?: boolean
  fezDia2?: boolean
  // Questões erradas pode ser array de números ou de objetos
  wrong_questions?: number[] | { question_number: number; topic?: string }[]
  questoes_erradas?: number[] | { questao: number; topico?: string }[]
  // Contadores (novos nomes)
  wrongAnswers?: number
  correctAnswers?: number
  // Contadores originais
  correct_answers?: number
  total_acertos?: number
  wrong_answers?: number
  total_erros?: number
  blank_answers?: number
  total_branco?: number
  // Notas por área (novo formato)
  areaScores?: {
    CH?: number
    CN?: number
    LC?: number
    MT?: number
  }
  areaCorrectAnswers?: {
    CH?: number
    CN?: number
    LC?: number
    MT?: number
  }
  // Notas TRI (vários formatos possíveis)
  triScore?: number
  tri_theta?: number
  tri_lc?: number
  tri_ch?: number
  tri_cn?: number
  tri_mt?: number
  nota_lc?: number
  nota_ch?: number
  nota_cn?: number
  nota_mt?: number
}

// Tipo para o projeto
type Projeto = {
  id: string
  nome?: string
  title?: string
  simulado_nome?: string
  created_at: string
  students?: ProjetoStudent[]
  tri_scores?: {
    LC?: number
    CH?: number
    CN?: number
    MT?: number
  }
  tri_scores_by_area?: {
    LC?: number
    CH?: number
    CN?: number
    MT?: number
    Linguagens?: number
    Humanas?: number
    Natureza?: number
    Matematica?: number
  }
}

async function convertProjetoStudentToResult(
  studentData: ProjetoStudent,
  projeto: Projeto,
): Promise<SimuladoResult> {
  console.log('[convertProjetoStudentToResult] Convertendo dados do aluno...')

  // Extrair matrícula do id no formato "merged-{matricula}-{timestamp}" ou usar campos disponíveis
  const idMatch = studentData.id?.match(/merged-(\d+)-\d+$/)
  const matriculaFromId = idMatch ? idMatch[1] : null
  const studentMatricula =
    studentData.studentNumber ??
    studentData.student_number ??
    studentData.matricula ??
    matriculaFromId ??
    ''

  // Extrair nome - tentar todos os campos possíveis
  const studentName =
    studentData.studentName ?? studentData.name ?? studentData.nome ?? null

  console.log(
    '[convertProjetoStudentToResult] Matrícula:',
    studentMatricula,
    'Nome:',
    studentName,
  )
  console.log(
    '[convertProjetoStudentToResult] Respostas disponíveis:',
    studentData.answers?.length || 0,
  )

  // Extrair questões erradas - PRIORIDADE 1: Lista detalhada de questões erradas
  let wrongQuestions: WrongQuestion[] = []

  // Tentar usar wrong_questions ou questoes_erradas (lista detalhada)
  const detailedWrongQuestions =
    studentData.wrong_questions ?? studentData.questoes_erradas

  if (detailedWrongQuestions && detailedWrongQuestions.length > 0) {
    console.log(
      '[convertProjetoStudentToResult] Usando lista detalhada de questões erradas:',
      detailedWrongQuestions.length,
    )

    // Buscar conteúdos reais na tabela exams
    wrongQuestions = await getWrongQuestionsWithContents(
      detailedWrongQuestions,
      projeto.id,
    )
  } else if (studentData.answers && studentData.answers.length > 0) {
    // NOVO: Buscar erros reais comparando com gabarito da tabela exams
    console.log(
      '[convertProjetoStudentToResult] Buscando erros reais na tabela exams...',
    )
    wrongQuestions = await getRealWrongQuestionsFromExam(studentData.answers, projeto.id)
  }

  // Se não conseguiu buscar os erros reais, usar fallback
  if (wrongQuestions.length === 0) {
    console.log(
      '[convertProjetoStudentToResult] Gerando questões individuais do resumo por área (fallback)',
    )
    const areaCorrect = studentData.areaCorrectAnswers
    if (areaCorrect) {
      // LC: Questões 1-45
      const lcWrong = 45 - (areaCorrect.LC ?? 0)
      if (lcWrong > 0) {
        const lcQuestions = distributeErrorsInArea(1, 45, lcWrong)
        wrongQuestions.push(...lcQuestions)
      }

      // CH: Questões 46-90
      const chWrong = 45 - (areaCorrect.CH ?? 0)
      if (chWrong > 0) {
        const chQuestions = distributeErrorsInArea(46, 90, chWrong)
        wrongQuestions.push(...chQuestions)
      }

      // CN: Questões 91-135
      const cnWrong = 45 - (areaCorrect.CN ?? 0)
      if (cnWrong > 0) {
        const cnQuestions = distributeErrorsInArea(91, 135, cnWrong)
        wrongQuestions.push(...cnQuestions)
      }

      // MT: Questões 136-180
      const mtWrong = 45 - (areaCorrect.MT ?? 0)
      if (mtWrong > 0) {
        const mtQuestions = distributeErrorsInArea(136, 180, mtWrong)
        wrongQuestions.push(...mtQuestions)
      }
    }
  }

  console.log(
    `[convertProjetoStudentToResult] ${wrongQuestions.length} questões erradas processadas`,
  )

  // Agrupar por tópico
  const topicsSummary = groupByTopic(wrongQuestions)

  // Contadores (normalizar diferentes nomes)
  const correctAnswers =
    studentData.correctAnswers ?? studentData.correct_answers ?? studentData.total_acertos ?? 0
  const wrongAnswers =
    studentData.wrongAnswers ??
    studentData.wrong_answers ??
    studentData.total_erros ??
    wrongQuestions.length
  const blankAnswers = studentData.blank_answers ?? studentData.total_branco ?? 0

  // Notas (novo formato areaScores ou formato antigo)
  // Se areaScores tiver valores > 0, usar; senão tentar outros campos
  const hasValidAreaScores =
    studentData.areaScores &&
    (studentData.areaScores.LC ||
      studentData.areaScores.CH ||
      studentData.areaScores.CN ||
      studentData.areaScores.MT)

  let triLC = hasValidAreaScores
    ? studentData.areaScores?.LC || null
    : (studentData.tri_lc ?? studentData.nota_lc ?? null)
  let triCH = hasValidAreaScores
    ? studentData.areaScores?.CH || null
    : (studentData.tri_ch ?? studentData.nota_ch ?? null)
  let triCN = hasValidAreaScores
    ? studentData.areaScores?.CN || null
    : (studentData.tri_cn ?? studentData.nota_cn ?? null)
  let triMT = hasValidAreaScores
    ? studentData.areaScores?.MT || null
    : (studentData.tri_mt ?? studentData.nota_mt ?? null)

  // ========== NOVO: Buscar notas TRI nos campos do projeto ==========
  if (!triLC && !triCH && !triCN && !triMT) {
    console.log(
      '[convertProjetoStudentToResult] Buscando notas TRI nos campos do projeto...',
    )
    console.log('[convertProjetoStudentToResult] ID do aluno:', studentData.id)

    // Verificar tri_scores (pode ser objeto com notas indexadas pelo ID do aluno)
    const triScores = (projeto as Record<string, unknown>).tri_scores
    const triScoresByArea = (projeto as Record<string, unknown>).tri_scores_by_area

    console.log('[convertProjetoStudentToResult] tri_scores:', triScores)
    console.log('[convertProjetoStudentToResult] tri_scores_by_area:', triScoresByArea)

    // Buscar pelo ID do aluno (formato: merged-{matricula}-{timestamp})
    const studentId = studentData.id

    // Função auxiliar para extrair nota de um objeto TRI
    const extractScore = (
      source: Record<string, unknown>,
      keys: string[],
    ): number | null => {
      for (const key of keys) {
        const value = source[key]
        if (typeof value === 'number' && value > 0) {
          return value
        }
      }
      return null
    }

    // Tentar extrair do tri_scores
    if (triScores && typeof triScores === 'object') {
      const triObj = triScores as Record<string, unknown>

      // Caso 1: tri_scores é um objeto direto com LC/CH/CN/MT
      triLC = triLC || extractScore(triObj, ['LC', 'lc', 'linguagens'])
      triCH = triCH || extractScore(triObj, ['CH', 'ch', 'humanas'])
      triCN = triCN || extractScore(triObj, ['CN', 'cn', 'natureza'])
      triMT = triMT || extractScore(triObj, ['MT', 'mt', 'matematica'])

      // Caso 2: tri_scores é indexado por ID do aluno
      if (studentId && triObj[studentId]) {
        const studentTri = triObj[studentId] as Record<string, unknown>
        triLC = triLC || extractScore(studentTri, ['LC', 'lc', 'linguagens'])
        triCH = triCH || extractScore(studentTri, ['CH', 'ch', 'humanas'])
        triCN = triCN || extractScore(studentTri, ['CN', 'cn', 'natureza'])
        triMT = triMT || extractScore(studentTri, ['MT', 'mt', 'matematica'])
      }
    }

    // Tentar extrair do tri_scores_by_area
    if (triScoresByArea && typeof triScoresByArea === 'object') {
      const triAreaObj = triScoresByArea as Record<string, unknown>

      triLC = triLC || extractScore(triAreaObj, ['LC', 'lc', 'Linguagens'])
      triCH = triCH || extractScore(triAreaObj, ['CH', 'ch', 'Humanas'])
      triCN = triCN || extractScore(triAreaObj, ['CN', 'cn', 'Natureza'])
      triMT = triMT || extractScore(triAreaObj, ['MT', 'mt', 'Matematica'])

      // Se for indexado por student ID
      if (studentId && triAreaObj[studentId]) {
        const studentTriArea = triAreaObj[studentId] as Record<string, unknown>
        triLC = triLC || extractScore(studentTriArea, ['LC', 'lc', 'Linguagens'])
        triCH = triCH || extractScore(studentTriArea, ['CH', 'ch', 'Humanas'])
        triCN = triCN || extractScore(studentTriArea, ['CN', 'cn', 'Natureza'])
        triMT = triMT || extractScore(studentTriArea, ['MT', 'mt', 'Matematica'])
      }
    }

    console.log('[convertProjetoStudentToResult] Notas TRI extraídas:', {
      triLC,
      triCH,
      triCN,
      triMT,
    })
  }

  // Score geral
  const triScore =
    studentData.score ??
    studentData.triScore ??
    studentData.tri_theta ??
    (triLC && triCH && triCN && triMT
      ? (triLC + triCH + triCN + triMT) / 4
      : null)

  const result: SimuladoResult = {
    exam: {
      id: projeto.id,
      title:
        projeto.simulado_nome ||
        projeto.nome ||
        projeto.title ||
        'Simulado sem nome',
      answer_key: [],
      question_contents: null,
    },
    studentAnswer: {
      id: studentData.id || `${projeto.id}-${studentMatricula}`,
      exam_id: projeto.id,
      student_number: studentMatricula,
      student_name: studentName,
      turma: studentData.turma ?? null,
      answers: studentData.answers ?? [],
      score: triScore ?? 0,
      correct_answers: correctAnswers,
      wrong_answers: wrongAnswers,
      blank_answers: blankAnswers,
      tri_score: triScore,
      tri_lc: triLC,
      tri_ch: triCH,
      tri_cn: triCN,
      tri_mt: triMT,
      created_at: projeto.created_at,
    },
    wrongQuestions,
    topicsSummary,
  }

  console.log('[convertProjetoStudentToResult] Notas finais:', {
    triLC,
    triCH,
    triCN,
    triMT,
    areaScores: studentData.areaScores,
    tri_lc: studentData.tri_lc,
    score: studentData.score,
  })
  console.log('[convertProjetoStudentToResult] Resultado:', {
    examTitle: result.exam.title,
    studentName: result.studentAnswer.student_name,
    totalWrongQuestions: result.wrongQuestions.length,
    totalTopics: result.topicsSummary.length,
    topics: result.topicsSummary,
  })

  return result
}

// Helper: Busca conteúdos reais das questões na tabela exams
async function getWrongQuestionsWithContents(
  wrongQuestionsList:
    | number[]
    | { question_number: number; topic?: string }[]
    | { questao: number; topico?: string }[],
  examId: string,
): Promise<WrongQuestion[]> {
  console.log(
    '[getWrongQuestionsWithContents] Buscando conteúdos para',
    wrongQuestionsList.length,
    'questões',
  )

  // Converter para array de números
  let wrongQuestionNumbers: number[]

  if (typeof wrongQuestionsList[0] === 'number') {
    wrongQuestionNumbers = wrongQuestionsList as number[]
  } else {
    wrongQuestionNumbers = (
      wrongQuestionsList as Array<{ question_number?: number; questao?: number }>
    )
      .map((q) => q.question_number ?? q.questao ?? 0)
      .filter((n) => n > 0)
  }

  // Buscar na tabela exams
  const { data: examData, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .maybeSingle()

  if (error || !examData) {
    console.error('[getWrongQuestionsWithContents] Erro ao buscar exam:', error)
    // Retorna sem conteúdos detalhados
    return wrongQuestionNumbers.map((qNum) => ({
      questionNumber: qNum,
      topic: getDetailedTopicByQuestionNumber(qNum),
      studentAnswer: 'X',
      correctAnswer: '?',
    }))
  }

  const questionContents = examData.question_contents as QuestionContentLike[] | null

  return wrongQuestionNumbers.map((qNum) => {
    const content = questionContents?.find((qc) => qc.questionNumber === qNum)
    return {
      questionNumber: qNum,
      topic: content?.content || getDetailedTopicByQuestionNumber(qNum),
      studentAnswer: 'X',
      correctAnswer: content?.answer || '?',
    }
  })
}

// Helper: Calcula erros reais usando dados da própria tabela projetos
async function getRealWrongQuestionsFromExam(
  studentAnswers: string[],
  projetoId: string,
): Promise<WrongQuestion[]> {
  console.log('[getRealWrongQuestionsFromExam] Calculando erros reais...')
  console.log('[getRealWrongQuestionsFromExam] Projeto ID:', projetoId)

  // Buscar o projeto com question_contents e gabarito
  const { data: projeto, error } = await supabase
    .from('projetos')
    .select('id, nome, answer_key, question_contents')
    .eq('id', projetoId)
    .maybeSingle()

  if (error) {
    console.error('[getRealWrongQuestionsFromExam] Erro ao buscar projeto:', error)
    return []
  }

  if (!projeto) {
    console.log('[getRealWrongQuestionsFromExam] Projeto não encontrado:', projetoId)
    return []
  }

  console.log('[getRealWrongQuestionsFromExam] Projeto encontrado:', projeto.nome)

  // Pegar conteúdos das questões da coluna question_contents
  const questionContents = projeto.question_contents as QuestionContentLike[] | null

  console.log(
    '[getRealWrongQuestionsFromExam] Question contents disponível:',
    !!questionContents,
  )
  console.log(
    '[getRealWrongQuestionsFromExam] Question contents quantidade:',
    questionContents?.length || 0,
  )

  // Pegar gabarito
  const answerKey = projeto.answer_key as string[] | null

  console.log('[getRealWrongQuestionsFromExam] Answer key disponível:', !!answerKey)
  console.log(
    '[getRealWrongQuestionsFromExam] Answer key quantidade:',
    answerKey?.length || 0,
  )

  if (!answerKey || answerKey.length === 0) {
    console.log('[getRealWrongQuestionsFromExam] ⚠️ Projeto sem gabarito')
    console.log(
      '[getRealWrongQuestionsFromExam] Campos disponíveis:',
      Object.keys(projeto),
    )
    return []
  }

  console.log(
    '[getRealWrongQuestionsFromExam] ✅ Gabarito com',
    answerKey.length,
    'respostas',
  )

  const wrongQuestions: WrongQuestion[] = []

  for (let i = 0; i < Math.min(studentAnswers.length, answerKey.length); i++) {
    const studentAnswer = studentAnswers[i]
    const correctAnswer = answerKey[i]
    const questionNumber = i + 1

    // Se respondeu diferente do gabarito (e não deixou em branco)
    if (studentAnswer && studentAnswer !== correctAnswer) {
      // Buscar conteúdo específico da questão
      const content = questionContents?.find(
        (qc) => (qc.questionNumber || qc.numero || qc.questao) === questionNumber,
      )

      const topicText = content?.content || content?.conteudo || content?.topic || content?.topico

      wrongQuestions.push({
        questionNumber,
        topic: topicText || getDetailedTopicByQuestionNumber(questionNumber),
        studentAnswer,
        correctAnswer,
      })
    }
  }

  console.log(
    '[getRealWrongQuestionsFromExam] ✅ Calculados',
    wrongQuestions.length,
    'erros reais!',
  )
  return wrongQuestions
}

type QuestionContentLike = {
  questionNumber?: number
  numero?: number
  questao?: number
  content?: string
  conteudo?: string
  topic?: string
  topico?: string
  answer?: string
}
