import {
  buildSimuladoPriorityContext,
  describeHistoricalBase,
  getAreaLabel,
  getTopHistoricalTopicByArea,
  type PrioritizedTopic,
} from './enem-priority'
import { getEnemSkillInsights, type EnemSkillInsight } from './enem-data'
import { getSisuCourseObjective, type SisuCourseObjective } from './sisu-goals'
import type { SimuladoResult } from '../types/supabase'

export interface StudyReportActivity {
  horario: string
  titulo: string
  descricao: string
  dica: string
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA'
  area: 'cn' | 'ch' | 'lc' | 'mt' | 'revisao' | 'pausa'
}

type AreaKey = 'lc' | 'ch' | 'cn' | 'mt'

export interface StudyAreaImprovement {
  area: AreaKey
  label: string
  triScore: number | null
  pesoSisu: number
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA'
  topicoFoco: string
  acao: string
}

export interface StudyReport {
  objetivo: {
    estado: string
    cidade: string
    universidade: string
    curso: string
    campus: string | null
    turno: string | null
    grau: string | null
  }
  pesos: {
    ano: number | null
    redacao: number
    linguagens: number
    humanas: number
    natureza: number
    matematica: number
    notaCorteAno: number | null
    notaCorteReferencia: number | null
    notaCorteModalidade: string | null
    notaCorteTipo: 'ampla_concorrencia' | 'maior_corte' | 'indisponivel'
    notaCorteOrigem: 'aprovados_final' | 'notas_corte' | 'indisponivel'
    notaCorteMaxima: number | null
    notaCorteMedia: number | null
    vagasCorteReferencia: number | null
    chamadaConvocadosReferencia: number | null
    totalConvocadosAmostra: number
    amostraConvocadosCompleta: boolean
    maiorNotaConvocadoAmostra: number | null
    menorNotaConvocadoAmostra: number | null
  }
  estrategia: string
  diagnostico: {
    pontosFracos: string[]
    pontosFortes: string[]
    metaProximoSimulado: string
  }
  melhoriasAreas: StudyAreaImprovement[]
  atividades: StudyReportActivity[]
  referencias: {
    baseHistorica: string
    habilidadesOficiais: string[]
    metodologia: string
  }
}

const STUDY_SLOTS = [
  { horario: '08:00-09:20', prioridade: 'ALTA' as const },
  { horario: '09:35-10:55', prioridade: 'ALTA' as const },
  { horario: '14:00-15:20', prioridade: 'ALTA' as const },
  { horario: '15:35-16:55', prioridade: 'MEDIA' as const },
]

const REQUIRED_AREAS: AreaKey[] = ['lc', 'ch', 'cn', 'mt']

function createFallbackTopic(area: AreaKey): PrioritizedTopic {
  const fallback = getTopHistoricalTopicByArea(area)

  return {
    area,
    areaLabel: getAreaLabel(area),
    displayLabel: fallback?.label ?? `Base de ${getAreaLabel(area)}`,
    matchedHistoricalTopic: fallback?.label ?? null,
    historicalWeight: fallback?.percentage ?? 0,
    errorCount: 0,
    triScore: null,
    score: fallback?.percentage ?? 0,
    questionNumbers: [],
  }
}

function ensureFourTopics(topics: PrioritizedTopic[]): PrioritizedTopic[] {
  const sorted = [...topics].sort((left, right) => right.score - left.score)
  const selectedByArea = new Map<AreaKey, PrioritizedTopic>()

  for (const topic of sorted) {
    if (!selectedByArea.has(topic.area)) {
      selectedByArea.set(topic.area, topic)
    }
  }

  for (const area of REQUIRED_AREAS) {
    if (!selectedByArea.has(area)) {
      selectedByArea.set(area, createFallbackTopic(area))
    }
  }

  return REQUIRED_AREAS.map((area) => selectedByArea.get(area)!)
}

function getAreaWeight(objective: SisuCourseObjective, area: AreaKey): number {
  switch (area) {
    case 'lc':
      return objective.pesos.peso_linguagens
    case 'ch':
      return objective.pesos.peso_ciencias_humanas
    case 'cn':
      return objective.pesos.peso_ciencias_natureza
    case 'mt':
      return objective.pesos.peso_matematica
  }
}

function topicSkillKey(topic: PrioritizedTopic): string {
  return `${topic.area}:${topic.displayLabel}`
}

function buildWeightedTopics(result: SimuladoResult, objective: SisuCourseObjective): PrioritizedTopic[] {
  const context = buildSimuladoPriorityContext(result)

  const weighted = context.prioritizedTopics
    .map((topic) => {
      const areaWeight = getAreaWeight(objective, topic.area)
      const triPenalty = topic.triScore == null ? 1 : Math.max(1, (650 - topic.triScore) / 100 + 1)

      return {
        ...topic,
        score: topic.score * areaWeight * triPenalty,
      }
    })
    .sort((left, right) => right.score - left.score)

  return ensureFourTopics(weighted)
}

function buildOfficialSkillLine(skillInsight?: EnemSkillInsight): string | null {
  if (!skillInsight) return null
  const itemCount = skillInsight.itemCount != null ? ` (${skillInsight.itemCount} itens mapeados)` : ''
  return `${skillInsight.identificador} - ${skillInsight.descricao.replace(/^H\d+\s*[–-]\s*/i, '').replace(/^H\d+\s*-\s*/i, '')}${itemCount}`
}

function buildStrategy(
  objective: SisuCourseObjective,
  prioritizedTopics: PrioritizedTopic[],
): string {
  const topicsByArea = new Map(
    ensureFourTopics(prioritizedTopics).map((topic) => [topic.area as AreaKey, topic]),
  )

  const areaPlan = REQUIRED_AREAS.map((area) => ({
    area,
    label: getAreaLabel(area),
    weight: getAreaWeight(objective, area),
    focus: topicsByArea.get(area)?.displayLabel ?? `foco de manutenção em ${getAreaLabel(area)}`,
  }))

  const hasSisuObjective = objective.curso.id > 0
  const areasLine = areaPlan
    .map((item) => `${item.label} (peso ${item.weight.toFixed(2)})`)
    .join(', ')

  const focusLine = areaPlan
    .map((item) => `${item.label}: ${item.focus}`)
    .join(' | ')

  if (!hasSisuObjective) {
    return `Este plano foi montado a partir do simulado, sem objetivo SISU selecionado. Priorizamos as quatro áreas do ENEM: ${areasLine}. Focos por área: ${focusLine}.`
  }

  const notaCorte = objective.notaCorte.notaCorteReferencia
    ? `A nota de corte de referência considerada é ${objective.notaCorte.notaCorteReferencia.toFixed(1)}${objective.notaCorte.modalidadeReferencia ? ` (${objective.notaCorte.modalidadeReferencia})` : ''}.`
    : ''

  return `Este plano foi montado para ${objective.curso.nome} na ${objective.curso.universidade}, em ${objective.curso.cidade}/${objective.curso.estado}. Priorizamos as quatro áreas do ENEM: ${areasLine}. Focos por área: ${focusLine}.${notaCorte ? ` ${notaCorte}` : ``}`
}

function buildMeta(prioritizedTopics: PrioritizedTopic[], objective: SisuCourseObjective): string {
  const focusLabels = ensureFourTopics(prioritizedTopics).map((topic) => topic.displayLabel).join(', ')
  return `No próximo simulado, o objetivo é reduzir a recorrência de erros nos focos ${focusLabels} e melhorar a regularidade nas quatro áreas (Linguagens, Humanas, Natureza e Matemática) para ${objective.curso.nome}.`
}

function buildDescription(
  topic: PrioritizedTopic,
  objective: SisuCourseObjective,
  skillInsight?: EnemSkillInsight,
): string {
  const areaWeight = getAreaWeight(objective, topic.area)
  const historicalBase = describeHistoricalBase(topic)
  const skillLine = buildOfficialSkillLine(skillInsight)
  const weightText = areaWeight > 1 ? ` Esta área recebe peso ${areaWeight.toFixed(2)} no curso-alvo.` : ''
  const skillText = skillLine ? ` Vincule a revisão à habilidade ${skillLine}.` : ''

  return `Neste bloco, revise ${topic.displayLabel}, resolva uma bateria curta de questões do ENEM e encerre com correção comentada dos erros. Priorize ${historicalBase}.${weightText}${skillText}`
}

function buildTip(topic: PrioritizedTopic, skillInsight?: EnemSkillInsight): string {
  if (skillInsight) {
    return `Antes de marcar a alternativa, identifique a habilidade cobrada no enunciado e justifique sua escolha em uma frase.`
  }

  if (topic.area === 'mt' || topic.area === 'cn') {
    return 'Anote o passo exato em que o raciocínio quebrou antes de corrigir a questão.'
  }

  return 'Resuma em uma linha o argumento central que sustentava a alternativa correta.'
}

function buildAreaImprovementAction(
  area: AreaKey,
  focusTopic: PrioritizedTopic,
  objective: SisuCourseObjective,
): string {
  const historicalBase = describeHistoricalBase(focusTopic)
  const areaWeight = getAreaWeight(objective, area)
  const weightText = areaWeight > 1 ? `peso SISU ${areaWeight.toFixed(2)}` : 'peso SISU padrão'

  if (area === 'mt' || area === 'cn') {
    return `Prática recomendada: teoria curta, bateria objetiva e correção por etapa em ${focusTopic.displayLabel}. Referência histórica: ${historicalBase}. Diretriz de peso: ${weightText}.`
  }

  return `Prática recomendada: leitura orientada, justificativa das alternativas e revisão ativa em ${focusTopic.displayLabel}. Referência histórica: ${historicalBase}. Diretriz de peso: ${weightText}.`
}

function classifyAreaPriority(rank: number, triScore: number | null, wrongCount: number): 'ALTA' | 'MEDIA' | 'BAIXA' {
  if (rank <= 1) {
    return 'ALTA'
  }

  if (triScore != null && triScore >= 620 && wrongCount <= 2) {
    return 'BAIXA'
  }

  return 'MEDIA'
}

function buildAreaImprovements(
  result: SimuladoResult,
  objective: SisuCourseObjective,
  prioritizedTopics: PrioritizedTopic[],
): StudyAreaImprovement[] {
  const context = buildSimuladoPriorityContext(result)
  const rankByArea = new Map<AreaKey, number>()

  context.weakestAreas.forEach((areaPerf, index) => {
    rankByArea.set(areaPerf.area as AreaKey, index)
  })

  const perfByArea = new Map(
    context.weakestAreas.map((areaPerf) => [areaPerf.area as AreaKey, areaPerf]),
  )

  const topicByArea = new Map<AreaKey, PrioritizedTopic>()
  for (const topic of prioritizedTopics) {
    if (!topicByArea.has(topic.area)) {
      topicByArea.set(topic.area, topic)
    }
  }

  return REQUIRED_AREAS
    .map((area) => {
      const perf = perfByArea.get(area)
      const topic = topicByArea.get(area) ?? createFallbackTopic(area)
      const triScore = perf?.triScore ?? topic.triScore ?? null
      const wrongCount = perf?.wrongCount ?? topic.errorCount
      const rank = rankByArea.get(area) ?? 99

      return {
        area,
        label: getAreaLabel(area),
        triScore,
        pesoSisu: getAreaWeight(objective, area),
        prioridade: classifyAreaPriority(rank, triScore, wrongCount),
        topicoFoco: topic.displayLabel,
        acao: buildAreaImprovementAction(area, topic, objective),
      }
    })
    .sort((left, right) => (rankByArea.get(left.area) ?? 99) - (rankByArea.get(right.area) ?? 99))
}

function buildActivities(
  prioritizedTopics: PrioritizedTopic[],
  objective: SisuCourseObjective,
  skillInsights: Map<string, EnemSkillInsight>,
): StudyReportActivity[] {
  const topics = ensureFourTopics(prioritizedTopics)
  const activities = topics.map((topic, index) => {
    const skillInsight = skillInsights.get(topicSkillKey(topic))

    return {
      horario: STUDY_SLOTS[index].horario,
      titulo: `${topic.areaLabel} - ${topic.displayLabel}`,
      descricao: buildDescription(topic, objective, skillInsight),
      dica: buildTip(topic, skillInsight),
      prioridade: STUDY_SLOTS[index].prioridade,
      area: topic.area,
    }
  })

  const revisionTopics = topics.map((topic) => topic.displayLabel).join(', ')

  return [
    activities[0],
    activities[1],
    {
      horario: '11:10-11:30',
      titulo: 'Pausa estratégica',
      descricao: 'Faça uma pausa curta, sem tela, para recuperar o foco antes do próximo bloco de estudo.',
      dica: 'Levante, hidrate-se e volte apenas quando o foco estiver estável.',
      prioridade: 'BAIXA',
      area: 'pausa',
    },
    activities[2],
    activities[3],
    {
      horario: '19:00-19:40',
      titulo: 'Revisão guiada dos erros do dia',
      descricao: `Releia os erros trabalhados em ${revisionTopics} e transforme cada falha recorrente em uma regra curta de revisão. Feche o dia com três pontos: o que avançou, o que travou e o que precisa voltar no próximo ciclo.`,
      dica: 'Se o mesmo erro apareceu em mais de uma questão, ele deve virar prioridade da próxima revisão.',
      prioridade: 'MEDIA',
      area: 'revisao',
    },
  ]
}

function buildFallbackObjective(): SisuCourseObjective {
  return {
    curso: {
      id: 0,
      codigo: 0,
      nome: 'Análise geral ENEM',
      universidade: 'Sem curso definido',
      campus: null,
      cidade: 'Brasil',
      estado: 'BR',
      grau: null,
      turno: null,
    },
    pesos: {
      ano: null,
      peso_redacao: 1,
      peso_linguagens: 1,
      peso_matematica: 1,
      peso_ciencias_humanas: 1,
      peso_ciencias_natureza: 1,
      minimo_redacao: null,
      minimo_linguagens: null,
      minimo_matematica: null,
      minimo_ciencias_humanas: null,
      minimo_ciencias_natureza: null,
      minimo_enem: null,
    },
    notaCorte: {
      ano: null,
      notaCorteReferencia: null,
      codigoModalidadeReferencia: null,
      modalidadeReferencia: null,
      capturadoEmReferencia: null,
      vagasReferencia: null,
      tipoReferencia: 'indisponivel',
      origemReferencia: 'indisponivel',
      notaCorteMaxima: null,
      notaCorteMedia: null,
      modalidadesConsideradas: 0,
      chamadaConvocadosReferencia: null,
      totalConvocadosAmostra: 0,
      amostraConvocadosCompleta: false,
      maiorNotaConvocadoAmostra: null,
      menorNotaConvocadoAmostra: null,
    },
  }
}

function buildStrengths(result: SimuladoResult): string[] {
  return buildSimuladoPriorityContext(result)
    .strongestAreas
    .filter((area) => area.triScore != null)
    .slice(0, 2)
    .map((area) => `${area.label} (TRI ${Math.round(area.triScore ?? 0)})`)
}

export async function gerarRelatorioEstudoPorObjetivo(
  result: SimuladoResult,
  courseId?: number,
): Promise<StudyReport> {
  const objective = typeof courseId === 'number'
    ? await getSisuCourseObjective(courseId)
    : buildFallbackObjective()
  const prioritizedTopics = buildWeightedTopics(result, objective)
  const skillInsights = await getEnemSkillInsights(prioritizedTopics)
  const habilidadesOficiais = prioritizedTopics
    .map((topic) => buildOfficialSkillLine(skillInsights.get(topicSkillKey(topic))))
    .filter((item): item is string => Boolean(item))

  const mappedTopicsCount = prioritizedTopics.filter((topic) => topic.historicalWeight > 0).length
  const melhoriasAreas = buildAreaImprovements(result, objective, prioritizedTopics)
  const pontosFracos = prioritizedTopics
    .filter((topic) => topic.errorCount > 0)
    .map((topic) => `${topic.displayLabel} (${topic.areaLabel})`)

  if (pontosFracos.length === 0) {
    pontosFracos.push('Sem erros recorrentes no recorte atual; manter revisão das quatro áreas.')
  }

  const hasSisuObjective = objective.curso.id > 0

  return {
    objetivo: {
      estado: objective.curso.estado,
      cidade: objective.curso.cidade,
      universidade: objective.curso.universidade,
      curso: objective.curso.nome,
      campus: objective.curso.campus,
      turno: objective.curso.turno,
      grau: objective.curso.grau,
    },
    pesos: {
      ano: objective.pesos.ano,
      redacao: objective.pesos.peso_redacao,
      linguagens: objective.pesos.peso_linguagens,
      humanas: objective.pesos.peso_ciencias_humanas,
      natureza: objective.pesos.peso_ciencias_natureza,
      matematica: objective.pesos.peso_matematica,
      notaCorteAno: objective.notaCorte.ano,
      notaCorteReferencia: objective.notaCorte.notaCorteReferencia,
      notaCorteModalidade: objective.notaCorte.modalidadeReferencia,
      notaCorteTipo: objective.notaCorte.tipoReferencia,
      notaCorteOrigem: objective.notaCorte.origemReferencia,
      notaCorteMaxima: objective.notaCorte.notaCorteMaxima,
      notaCorteMedia: objective.notaCorte.notaCorteMedia,
      vagasCorteReferencia: objective.notaCorte.vagasReferencia,
      chamadaConvocadosReferencia: objective.notaCorte.chamadaConvocadosReferencia,
      totalConvocadosAmostra: objective.notaCorte.totalConvocadosAmostra,
      amostraConvocadosCompleta: objective.notaCorte.amostraConvocadosCompleta,
      maiorNotaConvocadoAmostra: objective.notaCorte.maiorNotaConvocadoAmostra,
      menorNotaConvocadoAmostra: objective.notaCorte.menorNotaConvocadoAmostra,
    },
    estrategia: buildStrategy(objective, prioritizedTopics),
    diagnostico: {
      pontosFracos,
      pontosFortes: buildStrengths(result),
      metaProximoSimulado: buildMeta(prioritizedTopics, objective),
    },
    melhoriasAreas,
    atividades: buildActivities(prioritizedTopics, objective, skillInsights),
    referencias: {
      baseHistorica: hasSisuObjective
        ? 'Base histórica ENEM 2009-2025 + pesos SISU do curso selecionado'
        : 'Base histórica ENEM 2009-2025 (sem pesos SISU específicos)',
      habilidadesOficiais,
      metodologia: hasSisuObjective
        ? `Ranking determinístico por peso SISU, TRI por área, erros reais do simulado e incidência histórica de conteúdo (mapeamento direto ENEM 2009-2025: ${mappedTopicsCount}/${prioritizedTopics.length} tópicos). Plano com melhorias explícitas nas 4 áreas do ENEM.`
        : `Ranking determinístico por TRI por área, erros reais do simulado e incidência histórica de conteúdo (mapeamento direto ENEM 2009-2025: ${mappedTopicsCount}/${prioritizedTopics.length} tópicos). Plano com melhorias explícitas nas 4 áreas do ENEM.`,
    },
  }
}
