import type {
  QuestionContent,
  TopicSummary,
  WrongQuestion,
} from '../../types/supabase'

export function calculateWrongQuestions(
  studentAnswers: string[],
  answerKey: string[],
  questionContents: QuestionContent[] | null,
): WrongQuestion[] {
  const wrongQuestions: WrongQuestion[] = []

  for (let i = 0; i < Math.min(studentAnswers.length, answerKey.length); i++) {
    const studentAnswer = studentAnswers[i]
    const correctAnswer = answerKey[i]
    const questionNumber = i + 1

    // Se respondeu diferente do gabarito (e não deixou em branco)
    if (studentAnswer && studentAnswer !== correctAnswer) {
      const content = questionContents?.find(
        (qc) => qc.questionNumber === questionNumber,
      )

      wrongQuestions.push({
        questionNumber,
        topic: content?.content || getDetailedTopicByQuestionNumber(questionNumber),
        studentAnswer,
        correctAnswer,
      })
    }
  }

  console.log(`[calculateWrongQuestions] ${wrongQuestions.length} erros calculados`)
  return wrongQuestions
}

// Helper que usa índice relativo ao primeiro questionNumber do dia
export function findWrongQuestionsForDay(
  studentAnswers: string[],
  questionContents: QuestionContent[] | null,
): WrongQuestion[] {
  if (!questionContents || questionContents.length === 0) return []

  const wrongQuestions: WrongQuestion[] = []
  const firstQuestionNumber = questionContents[0].questionNumber

  for (const question of questionContents) {
    // Índice relativo ao primeiro número da questão do dia
    const answerIndex = question.questionNumber - firstQuestionNumber
    const studentAnswer = studentAnswers[answerIndex] ?? ''
    const correctAnswer = question.answer

    // Se respondeu diferente do gabarito (e não deixou em branco)
    if (studentAnswer && studentAnswer !== correctAnswer) {
      wrongQuestions.push({
        questionNumber: question.questionNumber,
        topic: question.content,
        studentAnswer,
        correctAnswer,
      })
    }
  }

  return wrongQuestions
}

export function groupByTopic(wrongQuestions: WrongQuestion[]): TopicSummary[] {
  const topicMap = new Map<string, { count: number; questions: number[] }>()

  for (const wq of wrongQuestions) {
    const existing = topicMap.get(wq.topic)
    if (existing) {
      existing.count++
      existing.questions.push(wq.questionNumber)
    } else {
      topicMap.set(wq.topic, {
        count: 1,
        questions: [wq.questionNumber],
      })
    }
  }

  return Array.from(topicMap.entries())
    .map(([topic, data]) => ({
      topic,
      count: data.count,
      questions: data.questions,
    }))
    .sort((a, b) => b.count - a.count) // Ordenar por mais erros
}

// Helper: Distribui erros em questões específicas dentro de uma área
// Retorna um array de WrongQuestion com questões distribuídas
export function distributeErrorsInArea(
  startQuestion: number,
  endQuestion: number,
  errorCount: number,
): WrongQuestion[] {
  const questions: WrongQuestion[] = []

  // Calcular o intervalo entre questões para distribuir uniformemente
  const totalQuestions = endQuestion - startQuestion + 1
  const step = Math.max(1, Math.floor(totalQuestions / Math.max(1, errorCount)))

  // Gerar questões distribuídas pela área
  for (let i = 0; i < errorCount; i++) {
    // Calcular número da questão (distribuído uniformemente)
    const questionOffset = Math.min(i * step, totalQuestions - 1)
    const questionNumber = startQuestion + questionOffset

    questions.push({
      questionNumber,
      topic: getDetailedTopicByQuestionNumber(questionNumber),
      studentAnswer: 'X',
      correctAnswer: '?',
    })
  }

  return questions
}

// Helper: Retorna o assunto DETALHADO baseado no número da questão (ENEM)
// Divide cada área em sub-áreas mais específicas
export function getDetailedTopicByQuestionNumber(questionNumber: number): string {
  // === LINGUAGENS (Q1-45) ===
  if (questionNumber >= 1 && questionNumber <= 5)
    return `Q${questionNumber} - Interpretação de Texto`
  if (questionNumber >= 6 && questionNumber <= 10)
    return `Q${questionNumber} - Gramática (Morfologia)`
  if (questionNumber >= 11 && questionNumber <= 15)
    return `Q${questionNumber} - Gramática (Sintaxe)`
  if (questionNumber >= 16 && questionNumber <= 20)
    return `Q${questionNumber} - Semântica e Figuras de Linguagem`
  if (questionNumber >= 21 && questionNumber <= 25)
    return `Q${questionNumber} - Funções da Linguagem`
  if (questionNumber >= 26 && questionNumber <= 30)
    return `Q${questionNumber} - Literatura Brasileira`
  if (questionNumber >= 31 && questionNumber <= 35)
    return `Q${questionNumber} - Literatura Portuguesa e Universal`
  if (questionNumber >= 36 && questionNumber <= 40)
    return `Q${questionNumber} - Arte e Cultura`
  if (questionNumber >= 41 && questionNumber <= 45)
    return `Q${questionNumber} - Língua Estrangeira (Inglês/Espanhol)`

  // === HUMANAS (Q46-90) ===
  if (questionNumber >= 46 && questionNumber <= 50)
    return `Q${questionNumber} - História do Brasil (Colônia)`
  if (questionNumber >= 51 && questionNumber <= 55)
    return `Q${questionNumber} - História do Brasil (Império e República)`
  if (questionNumber >= 56 && questionNumber <= 60)
    return `Q${questionNumber} - História Geral (Antiguidade e Idade Média)`
  if (questionNumber >= 61 && questionNumber <= 65)
    return `Q${questionNumber} - História Geral (Idade Moderna e Contemporânea)`
  if (questionNumber >= 66 && questionNumber <= 70)
    return `Q${questionNumber} - Geografia (Natureza e Sociedade)`
  if (questionNumber >= 71 && questionNumber <= 75)
    return `Q${questionNumber} - Geografia (Espaço e Território)`
  if (questionNumber >= 76 && questionNumber <= 80)
    return `Q${questionNumber} - Geografia (Globalização e Regionalização)`
  if (questionNumber >= 81 && questionNumber <= 85)
    return `Q${questionNumber} - Sociologia (Estrutura Social)`
  if (questionNumber >= 86 && questionNumber <= 90)
    return `Q${questionNumber} - Filosofia e Pensamento Crítico`

  // === NATUREZA (Q91-135) ===
  if (questionNumber >= 91 && questionNumber <= 95)
    return `Q${questionNumber} - Biologia (Citologia)`
  if (questionNumber >= 96 && questionNumber <= 100)
    return `Q${questionNumber} - Biologia (Genética)`
  if (questionNumber >= 101 && questionNumber <= 105)
    return `Q${questionNumber} - Biologia (Ecologia e Evolução)`
  if (questionNumber >= 106 && questionNumber <= 110)
    return `Q${questionNumber} - Biologia (Fisiologia Humana)`
  if (questionNumber >= 111 && questionNumber <= 115)
    return `Q${questionNumber} - Química (Geral)`
  if (questionNumber >= 116 && questionNumber <= 120)
    return `Q${questionNumber} - Química (Orgânica)`
  if (questionNumber >= 121 && questionNumber <= 125)
    return `Q${questionNumber} - Física (Mecânica)`
  if (questionNumber >= 126 && questionNumber <= 130)
    return `Q${questionNumber} - Física (Eletromagnetismo)`
  if (questionNumber >= 131 && questionNumber <= 135)
    return `Q${questionNumber} - Física (Termodinâmica e Óptica)`

  // === MATEMÁTICA (Q136-180) ===
  if (questionNumber >= 136 && questionNumber <= 140)
    return `Q${questionNumber} - Matemática (Conjuntos e Funções)`
  if (questionNumber >= 141 && questionNumber <= 145)
    return `Q${questionNumber} - Matemática (Funções e Gráficos)`
  if (questionNumber >= 146 && questionNumber <= 150)
    return `Q${questionNumber} - Matemática (Progressões e Logaritmos)`
  if (questionNumber >= 151 && questionNumber <= 155)
    return `Q${questionNumber} - Geometria (Plana)`
  if (questionNumber >= 156 && questionNumber <= 160)
    return `Q${questionNumber} - Geometria (Espacial)`
  if (questionNumber >= 161 && questionNumber <= 165)
    return `Q${questionNumber} - Geometria Analítica`
  if (questionNumber >= 166 && questionNumber <= 170)
    return `Q${questionNumber} - Estatística e Probabilidade`
  if (questionNumber >= 171 && questionNumber <= 175)
    return `Q${questionNumber} - Matemática Financeira e Razões`
  if (questionNumber >= 176 && questionNumber <= 180)
    return `Q${questionNumber} - Análise Combinatória e Probabilidade`

  return `Q${questionNumber} - Tópico não identificado`
}
