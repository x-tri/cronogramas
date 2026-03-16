import {
  FIXED_PAUSE_ACTIVITIES,
  STUDY_ACTIVITY_SLOTS,
  combineStudyActivitiesWithPauses,
  normalizeArea,
  normalizeList,
  normalizePlanoEstudo,
  normalizePriority,
  simplifyText,
  stripCodeFences,
  type Atividade,
  type Diagnostico,
  type PlanoEstudo,
  type PlanoEstudoGeneratorInput,
} from './plano-estudo-shared.ts'

type StudyArea = Exclude<Atividade['area'], 'pausa'>

type StageOneActivitySeed = {
  horario: string
  titulo: string
  prioridade: Atividade['prioridade']
  area: StudyArea
}

type StageOneResult = {
  estrategia: string
  diagnostico: Diagnostico
  atividades: StageOneActivitySeed[]
}

type CompletionResult = {
  content: string
  finishReason: string | null
}

export type CompletionRequest = {
  prompt: string
  maxTokens: number
  temperature: number
  timeoutMs: number
}

export type RequestCompletion = (
  request: CompletionRequest,
) => Promise<CompletionResult>

const STAGE_ONE_CONFIG = {
  maxTokens: 1_400,
  temperature: 0.35,
  timeoutMs: 70_000,
  attempts: 2,
} as const

const STAGE_TWO_CONFIG = {
  maxTokens: 900,
  temperature: 0.3,
  timeoutMs: 45_000,
  attempts: 2,
} as const

function triLabel(value: number | null): string {
  return value === null ? 'N/A' : value.toFixed(0)
}

function topicsLabel(topics: string[]): string {
  return topics.length ? topics.join(', ') : 'sem dados'
}

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function extractJsonObject(content: string): Record<string, unknown> {
  const cleaned = stripCodeFences(content)
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error('Resposta da IA não contém JSON válido')
  }

  const parsed = JSON.parse(match[0]) as unknown
  const object = toObject(parsed)
  if (!object) {
    throw new Error('Resposta da IA não contém um objeto JSON válido')
  }

  return object
}

function ensureNonEmptyText(value: unknown, message: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(message)
  return simplifyText(text, maxLength)
}

function normalizeStudyArea(value: unknown, title: string): StudyArea {
  const area = normalizeArea(value, title)
  if (area === 'pausa') return 'revisao'
  return area
}

function buildStageOnePrompt(input: PlanoEstudoGeneratorInput): string {
  return `ETAPA 1 - PLANEJAMENTO BASE

Você é um professor especialista em ENEM do XTRI, plataforma de preparação baseada em TRI.

Crie um plano de estudos diário DETALHADO no mesmo nível de profundidade do PDF de referência do XTRI, mas nesta etapa retorne apenas:
- estrategia
- diagnostico
- 8 blocos de estudo base

=== DADOS DO ALUNO ===
Nome: ${input.studentName}${input.turma ? ` | Turma: ${input.turma}` : ''}
Simulado: ${input.examTitle}
Resultado: ${input.correctAnswers}/180 acertos (${input.wrongAnswers} erros)

=== DESEMPENHO POR ÁREA ===
LC (Linguagens): TRI ${triLabel(input.tri.lc)} | Tópicos críticos: ${topicsLabel(input.topicsByArea.lc)}
CH (Humanas): TRI ${triLabel(input.tri.ch)} | Tópicos críticos: ${topicsLabel(input.topicsByArea.ch)}
CN (Natureza): TRI ${triLabel(input.tri.cn)} | Tópicos críticos: ${topicsLabel(input.topicsByArea.cn)}
MT (Matemática): TRI ${triLabel(input.tri.mt)} | Tópicos críticos: ${topicsLabel(input.topicsByArea.mt)}

=== REGRAS ===
- Priorize áreas com TRI mais baixo e mais erros.
- Monte um dia completo de estudos no padrão XTRI.
- NÃO inclua pausas; elas serão adicionadas depois pelo sistema.
- Retorne EXATAMENTE 8 blocos de estudo, um para cada horário abaixo, nesta ordem:
  1. 08:00-09:30
  2. 09:45-11:15
  3. 13:00-14:30
  4. 14:45-16:15
  5. 17:15-18:15
  6. 18:30-19:30
  7. 19:45-20:45
  8. 21:00-22:00
- Cada bloco deve ter somente: horario, titulo, prioridade, area.
- O titulo deve seguir o estilo "Área - Tópico Principal".
- area deve ser um destes valores: "lc", "ch", "cn", "mt", "revisao".
- prioridade deve ser "ALTA", "MEDIA" ou "BAIXA".
- estrategia deve ser um parágrafo longo de 4 a 6 frases, no nível do PDF XTRI.
- diagnostico deve trazer pontosFracos, pontosFortes e metaProximoSimulado, com meta numérica quando fizer sentido.

Retorne APENAS JSON válido, sem markdown, sem crases e sem texto extra.

Formato exato:
{
  "estrategia": "texto longo",
  "diagnostico": {
    "pontosFracos": ["..."],
    "pontosFortes": ["..."],
    "metaProximoSimulado": "..."
  },
  "atividades": [
    {
      "horario": "08:00-09:30",
      "titulo": "Área - Tópico Principal",
      "prioridade": "ALTA",
      "area": "cn"
    }
  ]
}`
}

function parseStageOneResponse(content: string): StageOneResult {
  const parsed = extractJsonObject(content)
  const diagnostico = toObject(parsed.diagnostico) ?? {}
  const rawActivities = Array.isArray(parsed.atividades)
    ? parsed.atividades
    : Array.isArray(parsed.blocos)
      ? parsed.blocos
      : Array.isArray(parsed.agenda)
        ? parsed.agenda
        : []

  const filteredActivities = rawActivities
    .map((item) => toObject(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => {
      const title = typeof item.titulo === 'string' ? item.titulo : ''
      const area = normalizeArea(item.area, title)
      const horario = typeof item.horario === 'string' ? item.horario : ''
      return area !== 'pausa' && !FIXED_PAUSE_ACTIVITIES.some((pause) => pause.horario === horario)
    })

  if (filteredActivities.length < STUDY_ACTIVITY_SLOTS.length) {
    throw new Error('Etapa 1 não retornou os 8 blocos de estudo esperados')
  }

  const atividades = STUDY_ACTIVITY_SLOTS.map((horario, index) => {
    const item = filteredActivities[index]
    if (!item) {
      throw new Error('Etapa 1 não retornou os 8 blocos de estudo esperados')
    }

    const titulo = ensureNonEmptyText(item.titulo, `Etapa 1 não retornou título para o bloco ${index + 1}`, 140)
    return {
      horario,
      titulo,
      prioridade: normalizePriority(item.prioridade),
      area: normalizeStudyArea(item.area, titulo),
    } satisfies StageOneActivitySeed
  })

  return {
    estrategia: ensureNonEmptyText(parsed.estrategia, 'Etapa 1 não retornou estratégia', 3_000),
    diagnostico: {
      pontosFracos: normalizeList(diagnostico.pontosFracos, ['Ciências da Natureza', 'Matemática']),
      pontosFortes: normalizeList(diagnostico.pontosFortes, ['Linguagens', 'Humanas']),
      metaProximoSimulado: ensureNonEmptyText(
        diagnostico.metaProximoSimulado,
        'Etapa 1 não retornou meta do próximo simulado',
        500,
      ),
    },
    atividades,
  }
}

function buildStageTwoPrompt(
  input: PlanoEstudoGeneratorInput,
  stageOne: StageOneResult,
  batch: StageOneActivitySeed[],
): string {
  const batchDescription = batch
    .map(
      (activity, index) => `${index + 1}. ${activity.horario} | ${activity.titulo} | prioridade ${activity.prioridade} | area ${activity.area}`,
    )
    .join('\n')

  return `ETAPA 2 - EXPANSÃO DETALHADA

Você é um professor especialista em ENEM do XTRI. Expanda APENAS os 2 blocos abaixo no nível de detalhe do PDF de referência do XTRI.

=== CONTEXTO DO ALUNO ===
Nome: ${input.studentName}${input.turma ? ` | Turma: ${input.turma}` : ''}
Simulado: ${input.examTitle}
Resultado: ${input.correctAnswers}/180 acertos (${input.wrongAnswers} erros)

Estratégia geral já definida:
${stageOne.estrategia}

Diagnóstico resumido:
- Pontos fracos: ${stageOne.diagnostico.pontosFracos.join(', ')}
- Pontos fortes: ${stageOne.diagnostico.pontosFortes.join(', ')}
- Meta: ${stageOne.diagnostico.metaProximoSimulado}

Blocos para expandir:
${batchDescription}

=== REGRAS ===
- Não altere horario, titulo, prioridade ou area.
- Preencha APENAS descricao e dica.
- Cada descricao deve ter 3 a 5 frases, com instruções concretas: conteúdo, quantidade de questões e fonte sugerida.
- A dica deve ser prática e específica, no estilo do PDF XTRI.
- Retorne exatamente 2 atividades, na mesma ordem recebida.

Retorne APENAS JSON válido, sem markdown, sem crases e sem texto extra.

Formato exato:
{
  "atividades": [
    {
      "horario": "${batch[0]?.horario ?? '08:00-09:30'}",
      "descricao": "texto detalhado",
      "dica": "texto específico"
    }
  ]
}`
}

function parseStageTwoResponse(content: string, batch: StageOneActivitySeed[]): Atividade[] {
  const parsed = extractJsonObject(content)
  const rawActivities = Array.isArray(parsed.atividades)
    ? parsed.atividades
    : Array.isArray(parsed.blocos)
      ? parsed.blocos
      : Array.isArray(parsed.itens)
        ? parsed.itens
        : Array.isArray(parsed)
          ? parsed
          : []

  const candidates = rawActivities
    .map((item) => toObject(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))

  if (candidates.length < batch.length) {
    throw new Error('Etapa 2 não retornou atividades suficientes para o lote')
  }

  return batch.map((baseActivity, index) => {
    const matchedByHorario = candidates.find(
      (candidate) => typeof candidate.horario === 'string' && candidate.horario.trim() === baseActivity.horario,
    )
    const candidate = matchedByHorario ?? candidates[index]

    if (!candidate) {
      throw new Error('Etapa 2 não retornou atividades suficientes para o lote')
    }

    return {
      horario: baseActivity.horario,
      titulo: baseActivity.titulo,
      prioridade: baseActivity.prioridade,
      area: baseActivity.area,
      descricao: ensureNonEmptyText(
        candidate.descricao,
        `Etapa 2 não retornou descrição para o bloco ${baseActivity.horario}`,
        2_000,
      ),
      dica: ensureNonEmptyText(
        candidate.dica,
        `Etapa 2 não retornou dica para o bloco ${baseActivity.horario}`,
        400,
      ),
    } satisfies Atividade
  })
}

async function runStageWithRetries<T>(
  requestCompletion: RequestCompletion,
  request: CompletionRequest & { attempts: number },
  parse: (content: string) => T,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= request.attempts; attempt++) {
    try {
      const response = await requestCompletion(request)
      if (!response.content.trim()) {
        throw new Error('Resposta da IA veio vazia')
      }

      if (response.finishReason === 'length') {
        throw new Error('Resposta da IA veio truncada')
      }

      return parse(response.content)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError ?? new Error('Erro inesperado ao processar resposta da IA')
}

function validateFinalPlano(plano: PlanoEstudo): void {
  if (plano.atividades.length !== 10) {
    throw new Error('Plano final não contém os 10 blocos esperados')
  }

  const pauses = plano.atividades.filter((activity) => activity.area === 'pausa')
  if (pauses.length !== 2) {
    throw new Error('Plano final não contém as 2 pausas obrigatórias')
  }

  for (const pause of FIXED_PAUSE_ACTIVITIES) {
    const found = pauses.find((activity) => activity.horario === pause.horario)
    if (!found) {
      throw new Error('Plano final não contém as pausas nos horários fixos')
    }
  }

  const studyActivities = plano.atividades.filter((activity) => activity.area !== 'pausa')
  if (studyActivities.length !== STUDY_ACTIVITY_SLOTS.length) {
    throw new Error('Plano final não contém os 8 blocos de estudo esperados')
  }

  for (const activity of studyActivities) {
    if (!activity.descricao.trim() || !activity.dica.trim()) {
      throw new Error('Plano final contém blocos sem descrição ou dica')
    }
  }
}

export async function orchestratePlanoEstudo(
  input: PlanoEstudoGeneratorInput,
  requestCompletion: RequestCompletion,
): Promise<PlanoEstudo> {
  const stageOne = await runStageWithRetries(
    requestCompletion,
    {
      prompt: buildStageOnePrompt(input),
      maxTokens: STAGE_ONE_CONFIG.maxTokens,
      temperature: STAGE_ONE_CONFIG.temperature,
      timeoutMs: STAGE_ONE_CONFIG.timeoutMs,
      attempts: STAGE_ONE_CONFIG.attempts,
    },
    parseStageOneResponse,
  )

  const batches = Array.from({ length: stageOne.atividades.length / 2 }, (_, index) =>
    stageOne.atividades.slice(index * 2, index * 2 + 2),
  )

  const expandedBatches = await Promise.all(
    batches.map((batch) =>
      runStageWithRetries(
        requestCompletion,
        {
          prompt: buildStageTwoPrompt(input, stageOne, batch),
          maxTokens: STAGE_TWO_CONFIG.maxTokens,
          temperature: STAGE_TWO_CONFIG.temperature,
          timeoutMs: STAGE_TWO_CONFIG.timeoutMs,
          attempts: STAGE_TWO_CONFIG.attempts,
        },
        (content) => parseStageTwoResponse(content, batch),
      ),
    ),
  )

  const studyActivities = expandedBatches.flat()
  const plano = normalizePlanoEstudo({
    estrategia: stageOne.estrategia,
    diagnostico: stageOne.diagnostico,
    atividades: combineStudyActivitiesWithPauses(studyActivities),
  })

  validateFinalPlano(plano)
  return plano
}
