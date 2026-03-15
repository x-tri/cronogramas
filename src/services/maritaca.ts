import type { SimuladoResult } from '../types/supabase'

// Chamada via Edge Function do Supabase para evitar CORS (API key fica server-side)
const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/maritaca-proxy`
const MARITACA_MODEL = 'sabiazinho-3'

export interface Atividade {
  horario: string       // ex: "08:00-09:30"
  titulo: string        // ex: "Ciências da Natureza - Ecologia e Meio Ambiente"
  descricao: string     // parágrafo detalhado com o que fazer
  dica: string          // frase de dica prática em itálico
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA'
  area: 'cn' | 'ch' | 'lc' | 'mt' | 'revisao' | 'pausa'
}

export interface Diagnostico {
  pontosFracos: string[]
  pontosFortes: string[]
  metaProximoSimulado: string
}

export interface PlanoEstudo {
  estrategia: string
  diagnostico: Diagnostico
  atividades: Atividade[]
}

function buildPrompt(result: SimuladoResult): string {
  const { studentAnswer, wrongQuestions } = result
  const nomeCompleto = studentAnswer.student_name ?? 'Aluno(a)'
  const turma = studentAnswer.turma ?? ''

  const lc = wrongQuestions.filter(q => q.questionNumber >= 1   && q.questionNumber <= 45)
  const ch = wrongQuestions.filter(q => q.questionNumber >= 46  && q.questionNumber <= 90)
  const cn = wrongQuestions.filter(q => q.questionNumber >= 91  && q.questionNumber <= 135)
  const mt = wrongQuestions.filter(q => q.questionNumber >= 136 && q.questionNumber <= 180)

  const topicos = (erros: typeof wrongQuestions) =>
    [...new Set(erros.map(q => q.topic).filter(Boolean))].slice(0, 6).join(', ') || 'sem dados'

  const lcAcertos = 45 - lc.length
  const chAcertos = 45 - ch.length
  const cnAcertos = 45 - cn.length
  const mtAcertos = 45 - mt.length

  return `Você é um professor especialista em ENEM do XTRI, plataforma de preparação baseada em TRI.

Crie um PLANO DE ESTUDOS DIÁRIO DETALHADO para ${nomeCompleto} com base nos resultados abaixo.

=== DADOS DO ALUNO ===
Nome: ${nomeCompleto}${turma ? ` | Turma: ${turma}` : ''}
Simulado: ${result.exam.title}
Resultado: ${studentAnswer.correct_answers}/180 acertos (${studentAnswer.wrong_answers} erros)

=== DESEMPENHO POR ÁREA ===
LC (Linguagens): TRI ${studentAnswer.tri_lc?.toFixed(0) ?? 'N/A'} | ${lcAcertos}/45 acertos | Erros em: ${topicos(lc)}
CH (Humanas):    TRI ${studentAnswer.tri_ch?.toFixed(0) ?? 'N/A'} | ${chAcertos}/45 acertos | Erros em: ${topicos(ch)}
CN (Natureza):   TRI ${studentAnswer.tri_cn?.toFixed(0) ?? 'N/A'} | ${cnAcertos}/45 acertos | Erros em: ${topicos(cn)}
MT (Matemática): TRI ${studentAnswer.tri_mt?.toFixed(0) ?? 'N/A'} | ${mtAcertos}/45 acertos | Erros em: ${topicos(mt)}

=== INSTRUÇÕES ===
Gere um plano para UM DIA COMPLETO de estudos, das 8h às 22h, com horários específicos.
Para cada bloco de estudo:
- Descreva EXATAMENTE o que fazer (qual conteúdo, quantas questões, qual site/app)
- Use o ciclo: teoria → exercício → revisão
- Inclua pausas estratégicas entre os blocos
- Priorize as áreas com menor TRI e mais erros
- Cada descrição deve ter 3-5 frases bem detalhadas e acionáveis
- A dica deve ser prática e específica (não genérica)

Retorne APENAS o JSON abaixo, sem markdown, sem texto fora do JSON:
{
  "estrategia": "Parágrafo de 4-6 frases analisando o desempenho geral, identificando os principais pontos fracos e a lógica por trás do plano. Cite as áreas com TRI mais baixo e proponha o método teoria → exercício → revisão com alternância entre áreas.",
  "diagnostico": {
    "pontosFracos": ["Tópico específico (Área)", "Tópico específico (Área)", "..."],
    "pontosFortes": ["Área ou habilidade forte", "..."],
    "metaProximoSimulado": "Frase com metas numéricas de TRI por área para o próximo simulado"
  },
  "atividades": [
    {
      "horario": "08:00-09:30",
      "titulo": "Área - Tópico Principal",
      "descricao": "3-5 frases detalhadas dizendo exatamente o que estudar, como estudar, quantas questões resolver e onde encontrar o material (ex: ENEM dos últimos 5 anos, Qconcursos, Khan Academy, livro didático).",
      "dica": "Dica prática e específica em uma frase.",
      "prioridade": "ALTA",
      "area": "cn"
    },
    {
      "horario": "09:45-11:15",
      "titulo": "Área - Exercícios de Tópico",
      "descricao": "...",
      "dica": "...",
      "prioridade": "ALTA",
      "area": "cn"
    },
    {
      "horario": "11:30-12:00",
      "titulo": "Pausa Estratégica",
      "descricao": "Levante-se, alongue, beba água e faça respiração profunda.",
      "dica": "Evite telas nesta pausa para recarregar o cérebro.",
      "prioridade": "BAIXA",
      "area": "pausa"
    }
  ]
}

Gere entre 8 e 12 atividades cobrindo o dia inteiro (08:00-22:00), incluindo 2-3 pausas estratégicas.`
}

export async function gerarPlanoEstudo(result: SimuladoResult): Promise<PlanoEstudo> {
  const prompt = buildPrompt(result)

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MARITACA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 2000,
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
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Resposta da IA não contém JSON válido')

  return JSON.parse(jsonMatch[0]) as PlanoEstudo
}
