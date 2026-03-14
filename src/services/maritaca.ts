import type { SimuladoResult } from '../types/supabase'

// Chamada via Edge Function do Supabase para evitar CORS (API key fica server-side)
const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/maritaca-proxy`
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
    acoes: string[]
  }[]
  recomendacaoGeral: string
  semanas: string
  metaTRI: string
}

function buildPrompt(result: SimuladoResult): string {
  const { studentAnswer, wrongQuestions } = result
  const nome = studentAnswer.student_name?.split(' ')[0] ?? 'Aluno(a)'
  const nomeCompleto = studentAnswer.student_name ?? 'Aluno(a)'
  const turma = studentAnswer.turma ?? ''

  // Agrupa erros por área com tópicos detalhados
  const lc = wrongQuestions.filter(q => q.questionNumber >= 1 && q.questionNumber <= 45)
  const ch = wrongQuestions.filter(q => q.questionNumber >= 46 && q.questionNumber <= 90)
  const cn = wrongQuestions.filter(q => q.questionNumber >= 91 && q.questionNumber <= 135)
  const mt = wrongQuestions.filter(q => q.questionNumber >= 136 && q.questionNumber <= 180)

  const formatArea = (label: string, erros: typeof wrongQuestions, tri: number | null, acertos: number, total: number) => {
    const topicos = [...new Set(erros.map(q => q.topic).filter(Boolean))].slice(0, 10)
    const aproveitamento = Math.round((acertos / total) * 100)
    return `**${label}**
- Nota TRI: ${tri?.toFixed(0) ?? 'N/A'} | Acertos: ${acertos}/${total} (${aproveitamento}%)
- Tópicos com maior número de erros: ${topicos.length > 0 ? topicos.join(', ') : 'sem dados detalhados'}`
  }

  const lcAcertos = 45 - lc.length
  const chAcertos = 45 - ch.length
  const cnAcertos = 45 - cn.length
  const mtAcertos = 45 - mt.length

  const areas = [
    formatArea('Linguagens e Códigos (LC)', lc, studentAnswer.tri_lc, lcAcertos, 45),
    formatArea('Ciências Humanas (CH)', ch, studentAnswer.tri_ch, chAcertos, 45),
    formatArea('Ciências da Natureza (CN)', cn, studentAnswer.tri_cn, cnAcertos, 45),
    formatArea('Matemática (MT)', mt, studentAnswer.tri_mt, mtAcertos, 45),
  ].join('\n\n')

  return `Você é um professor experiente do XTRI, plataforma especializada em preparação para o ENEM usando TRI (Teoria de Resposta ao Item).

Analise com profundidade o desempenho de ${nome} e crie um plano de estudos CONCRETO e ALTAMENTE PERSONALIZADO.

=== DADOS DO ALUNO ===
Nome: ${nomeCompleto}${turma ? ` | Turma: ${turma}` : ''}
Simulado: ${result.exam.title}
Resultado geral: ${studentAnswer.correct_answers} acertos / 180 questões (${studentAnswer.wrong_answers} erros)

=== DESEMPENHO DETALHADO POR ÁREA ===
${areas}

=== CONTEXTO TRI ===
Na TRI do ENEM, questões de MÉDIA e ALTA dificuldade valem muito mais pontos. ${nome} deve priorizar dominar os tópicos de média dificuldade antes de avançar para os difíceis. Áreas com TRI abaixo de 500 indicam necessidade urgente de revisão de conceitos fundamentais.

=== INSTRUÇÕES ===
Gere um plano ACIONÁVEL com estratégias ESPECÍFICAS para cada tópico com erro. Não use frases genéricas como "revise o conteúdo" — diga EXATAMENTE o que fazer (ex: "Resolva 15 questões de Geometria Analítica do ENEM 2015-2023, focando em distância entre ponto e reta").

Retorne APENAS um JSON válido com esta estrutura exata (sem markdown, sem texto fora do JSON):
{
  "resumo": "Análise personalizada de 2-3 frases citando o nome do aluno, pontos fortes e principais gaps",
  "porArea": [
    {
      "area": "Nome completo da área",
      "cor": "#3B82F6 para LC | #F97316 para CH | #10B981 para CN | #EF4444 para MT",
      "nota": "nota TRI como string ou null",
      "prioridade": "alta|media|baixa (baseado na nota TRI e % de acertos)",
      "topicos": ["lista dos 3-5 tópicos mais críticos com erro"],
      "estrategia": "Estratégia pedagógica específica de 2-3 frases citando técnicas concretas (mapas mentais de X, resolução de Y questões de Z, etc.)",
      "acoes": [
        "Ação concreta 1: faça X questões de [tópico] do ENEM [ano-ano]",
        "Ação concreta 2: assista aula/videoaula sobre [tópico específico]",
        "Ação concreta 3: refaça as questões [números] do simulado revisando [conceito]"
      ]
    }
  ],
  "recomendacaoGeral": "Recomendação final de 2-3 frases com meta de nota TRI realista e como distribuir o tempo de estudo",
  "semanas": "Distribuição de horas por área na semana (ex: LC 4h | CH 6h | CN 5h | MT 7h)",
  "metaTRI": "Meta de nota TRI geral realista para o próximo simulado baseada no desempenho atual (ex: de 480 para 530)"
}`
}

export async function gerarPlanoEstudo(result: SimuladoResult): Promise<PlanoEstudo> {
  const prompt = buildPrompt(result)

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
