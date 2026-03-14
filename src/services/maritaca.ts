import type { SimuladoResult } from '../types/supabase'

const MARITACA_API_URL = 'https://chat.maritaca.ai/api/chat/completions'
const MARITACA_MODEL = 'sabia-3'

export interface PlanoEstudo {
  resumo: string
  porArea: {
    area: string
    cor: string
    nota: string | null
    prioridade: 'alta' | 'media' | 'baixa'
    topicos: string[]
    estrategia: string
  }[]
  recomendacaoGeral: string
  semanas: string
}

function buildPrompt(result: SimuladoResult): string {
  const { studentAnswer, wrongQuestions } = result
  const nome = studentAnswer.student_name ?? 'Aluno(a)'
  const turma = studentAnswer.turma ?? ''

  // Agrupa erros por área
  const lc = wrongQuestions.filter(q => q.questionNumber >= 1 && q.questionNumber <= 45)
  const ch = wrongQuestions.filter(q => q.questionNumber >= 46 && q.questionNumber <= 90)
  const cn = wrongQuestions.filter(q => q.questionNumber >= 91 && q.questionNumber <= 135)
  const mt = wrongQuestions.filter(q => q.questionNumber >= 136 && q.questionNumber <= 180)

  const formatArea = (nome: string, erros: typeof wrongQuestions, tri: number | null) => {
    if (erros.length === 0) return ''
    const topicos = [...new Set(erros.map(q => q.topic).filter(Boolean))].slice(0, 8)
    return `**${nome}** (${erros.length} erros | TRI: ${tri?.toFixed(0) ?? 'N/A'})\nTópicos com erro: ${topicos.join(', ')}`
  }

  const areas = [
    formatArea('Linguagens e Códigos (LC)', lc, studentAnswer.tri_lc),
    formatArea('Ciências Humanas (CH)', ch, studentAnswer.tri_ch),
    formatArea('Ciências da Natureza (CN)', cn, studentAnswer.tri_cn),
    formatArea('Matemática (MT)', mt, studentAnswer.tri_mt),
  ].filter(Boolean).join('\n\n')

  return `Você é um professor especialista em ENEM com foco em TRI (Teoria de Resposta ao Item).
Analise o desempenho do(a) aluno(a) abaixo e crie um plano de estudos personalizado e motivador para as próximas semanas.

**ALUNO(A):** ${nome}${turma ? ` | Turma: ${turma}` : ''}
**SIMULADO:** ${result.exam.title}
**RESULTADO:** ${studentAnswer.correct_answers} acertos de 180 questões (${studentAnswer.wrong_answers} erros)

**DESEMPENHO POR ÁREA:**
${areas}

**INSTRUÇÕES:**
Retorne um JSON válido com exatamente esta estrutura (sem markdown, sem explicações fora do JSON):
{
  "resumo": "Análise motivadora e personalizada do desempenho em 2-3 frases",
  "porArea": [
    {
      "area": "Nome da área",
      "cor": "hex color (use: #3B82F6 para LC, #F97316 para CH, #10B981 para CN, #EF4444 para MT)",
      "nota": "nota TRI ou null",
      "prioridade": "alta|media|baixa",
      "topicos": ["tópico 1", "tópico 2", "tópico 3"],
      "estrategia": "Estratégia específica de 1-2 frases para essa área"
    }
  ],
  "recomendacaoGeral": "Recomendação geral motivadora com foco em TRI em 2-3 frases",
  "semanas": "Distribuição sugerida de horas de estudo por área na semana (ex: LC 4h, CH 3h, CN 5h, MT 6h)"
}`
}

export async function gerarPlanoEstudo(result: SimuladoResult): Promise<PlanoEstudo> {
  const apiKey = import.meta.env.VITE_MARITACA_KEY
  if (!apiKey) throw new Error('VITE_MARITACA_KEY não configurada')

  const prompt = buildPrompt(result)

  const response = await fetch(MARITACA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      model: MARITACA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Maritaca API error ${response.status}: ${err}`)
  }

  const data = await response.json() as {
    choices: { message: { content: string } }[]
  }

  const content = data.choices[0]?.message?.content ?? ''

  // Extrair JSON da resposta (pode vir com markdown)
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Resposta da IA não contém JSON válido')

  return JSON.parse(jsonMatch[0]) as PlanoEstudo
}
