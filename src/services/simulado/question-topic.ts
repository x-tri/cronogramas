import type { QuestionContent } from '../../types/supabase'

export type QuestionContentLike = Partial<QuestionContent> & {
  readonly numero?: number
  readonly questao?: number
  readonly conteudo?: string
  readonly topic?: string
  readonly topico?: string
  readonly resposta?: string
  readonly gabarito?: string
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function resolveQuestionTopic(
  questionContent: QuestionContentLike | null | undefined,
  questionNumber: number,
): string {
  const approvedLabel =
    questionContent?.gliner?.reviewStatus === 'approved'
      ? questionContent?.gliner?.approvedLabel ?? questionContent?.gliner?.suggestedLabel
      : null

  if (isNonEmptyString(approvedLabel)) {
    return normalizeLabel(approvedLabel)
  }

  const candidates = [
    questionContent?.content,
    questionContent?.conteudo,
    questionContent?.topic,
    questionContent?.topico,
  ]

  for (const candidate of candidates) {
    if (isNonEmptyString(candidate)) {
      return normalizeLabel(candidate)
    }
  }

  return getDetailedTopicByQuestionNumber(questionNumber)
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
