/**
 * Report Engine — Serviço determinístico de dados para relatório XTRI.
 *
 * Computa TUDO com dados reais do Supabase antes de qualquer IA.
 * Zero chamadas a LLM — apenas computação pura sobre dados de banco.
 *
 * Bancos utilizados:
 * - INEP/ENEM/SISU (qgqliquusdkkwnfuzdwi): enem_itens, sisu_cursos, etc.
 * - Banco de Questões (fbykcqcssykopvcrsfoo): itens com link_imagem
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getInepSupabaseClient } from '../lib/inep-supabase'
import { getQuestionBankSupabaseClient } from '../lib/question-bank-supabase'
import type { SimuladoResult } from '../types/supabase'
import type {
  AreaSigla,
  BenchmarkEscola,
  Cenario,
  Cenarios,
  ClassificacaoDificuldade,
  CursoEscolhido,
  CursoEncontrado,
  ErroHabilidade,
  HabilidadeCritica,
  IncidenciaHabilidade,
  IncidenciaHistorica,
  ItemTRI,
  MapaHabilidades,
  NotasAluno,
  ParametrosTRI,
  PerfilAprovados,
  PesosSisu,
  QuestaoRecomendada,
  QuestoesRecomendadas,
  ReportData,
  ReportProgress,
  ComputeReportDataOptions,
  RoiArea,
  SisuAnalysis,
} from '../types/report'
import { getConteudoDidatico } from '../constants/habilidade-conteudo'
import {
  getDifficultyWindowForTri,
  mergeRecommendationsForStudent,
  pickRecommendationsForStudent,
} from './report-recommendations'
import {
  derivePedagogicalFocusForSkill,
  extractTopicSearchTerms,
  scoreTopicTextRelevance,
} from './report-topic-focus'
import { isQuestionQuarantined } from '../constants/question-bank-quarantine'
import {
  buildQuestionCandidateMap,
  questionRequiresVisualContext,
  resolveItem,
  sortQuestionOptions,
  type QuestionCandidateRow,
  type QuestionOptionRow,
} from './question-delivery'

function getProvasClient(): SupabaseClient {
  return getQuestionBankSupabaseClient()
}

// ============ HELPERS ============

function emitReportProgress(
  options: ComputeReportDataOptions | undefined,
  progress: ReportProgress,
): void {
  options?.onProgress?.(progress)
}

function extractNotasAluno(result: SimuladoResult): NotasAluno {
  const sa = result.studentAnswer
  return {
    lc: sa.tri_lc,
    ch: sa.tri_ch,
    cn: sa.tri_cn,
    mt: sa.tri_mt,
    redacao: null, // simulado não tem redação
  }
}

function classificarDificuldade(b: number): ClassificacaoDificuldade {
  if (b < -1) return 'muito_facil'
  if (b < 0) return 'facil'
  if (b <= 1) return 'medio'
  if (b <= 1.5) return 'dificil'
  return 'muito_dificil'
}

function median(sorted: ReadonlyArray<number>): number {
  const n = sorted.length
  if (n === 0) return 0
  const mid = Math.floor(n / 2)
  return n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function percentile(sorted: ReadonlyArray<number>, p: number): number {
  if (sorted.length === 0) return 0
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

/**
 * Normalizes a modalidade name for ILIKE search, handling the accent mismatch
 * between the UI (unaccented, e.g. "Ampla concorrencia") and the database
 * (accented, e.g. "Ampla concorrência").
 *
 * Strategy: extract the first significant keyword from the modalidade name.
 * For "Ampla concorrencia" -> "Ampla" (matches "Ampla concorrência")
 * For "Cotas - Escola publica" -> "Escola publica" which the DB stores similarly
 * For anything with accents -> strip accents to a safe ASCII fragment
 */
function normalizeForIlike(modalidade: string): string {
  // Map of common UI labels to DB-safe ILIKE fragments
  const MODALIDADE_FRAGMENTS: ReadonlyArray<readonly [string, string]> = [
    ['Ampla concorrencia', 'Ampla concorr'],
    ['Cotas - Escola publica + Renda + PPI', 'pretos, pardos%renda'],
    ['Cotas - Escola publica + PPI', 'pretos, pardos%independentemente da renda'],
    ['Cotas - Escola publica + Renda', 'renda familiar%igual ou inferior'],
    ['Cotas - Escola publica', 'independentemente da renda%cursado integralmente'],
    ['Cotas - PcD', 'defici'],
  ]

  const lower = modalidade.toLowerCase()
  for (const [key, fragment] of MODALIDADE_FRAGMENTS) {
    if (lower.includes(key.toLowerCase())) return fragment
  }

  // Fallback: use first word
  return modalidade.split(' ')[0]
}

// ============ CONVERSÃO QUESTÃO SIMULADO → ÁREA + POSIÇÃO ============

/**
 * Converte o questionNumber sequencial do simulado (1-180) para área + posição relativa (1-45).
 *
 * Layout do simulado:
 *   Q1-45   → LC, posição 1-45
 *   Q46-90  → CH, posição 1-45
 *   Q91-135 → CN, posição 1-45
 *   Q136-180 → MT, posição 1-45
 */
function questionNumberToAreaAndPosition(qn: number): { area: AreaSigla; posicao: number } | null {
  if (qn >= 1 && qn <= 45) {
    return { area: 'LC', posicao: qn }
  }
  if (qn >= 46 && qn <= 90) {
    return { area: 'CH', posicao: qn - 45 }
  }
  if (qn >= 91 && qn <= 135) {
    return { area: 'CN', posicao: qn - 90 }
  }
  if (qn >= 136 && qn <= 180) {
    return { area: 'MT', posicao: qn - 135 }
  }
  return null
}

function getObservedAreasFromWrongQuestions(
  wrongQuestions: ReadonlyArray<SimuladoResult['wrongQuestions'][number]>,
): AreaSigla[] {
  const observed = new Set<AreaSigla>()

  for (const wrongQuestion of wrongQuestions) {
    const mapped = questionNumberToAreaAndPosition(wrongQuestion.questionNumber)
    if (mapped) {
      observed.add(mapped.area)
    }
  }

  const order: AreaSigla[] = ['LC', 'CH', 'CN', 'MT']
  return order.filter((area) => observed.has(area))
}

function buildTopicBackedBucketsForArea(
  area: AreaSigla,
  wrongQuestions: ReadonlyArray<SimuladoResult['wrongQuestions'][number]>,
): Array<ErroHabilidade & { percentualIncidencia: number; score: number }> {
  const topicMap = new Map<string, number[]>()

  for (const wrongQuestion of wrongQuestions) {
    const mapped = questionNumberToAreaAndPosition(wrongQuestion.questionNumber)
    if (!mapped || mapped.area !== area) continue

    const topic = wrongQuestion.topic?.trim() || `${area}-TOPIC`
    const existing = topicMap.get(topic)
    if (existing) {
      existing.push(wrongQuestion.questionNumber)
    } else {
      topicMap.set(topic, [wrongQuestion.questionNumber])
    }
  }

  return [...topicMap.entries()]
    .map(([topic, questoes], index) => ({
      area,
      numeroHabilidade: 0,
      identificador: `${area}-TOPIC-${index + 1}`,
      descricao: topic,
      questoesErradas: questoes,
      totalErros: questoes.length,
      percentualIncidencia: 0,
      score: questoes.length,
    }))
    .sort((left, right) => right.totalErros - left.totalErros)
    .slice(0, 3)
}

// ============ 1. MAPA DE HABILIDADES ============

async function computeMapaHabilidades(
  result: SimuladoResult,
  inepClient: SupabaseClient,
): Promise<MapaHabilidades> {
  const wrongNumbers = result.wrongQuestions.map(q => q.questionNumber)

  if (wrongNumbers.length === 0) {
    return {
      errosPorHabilidade: [],
      totalQuestoesErradas: 0,
      habilidadesSemMapeamento: [],
    }
  }

  // Precisamos do ano do exame para filtrar corretamente
  const examTitle = result.exam.title ?? ''
  const yearMatch = examTitle.match(/20\d{2}/)
  const examYear = yearMatch ? parseInt(yearMatch[0], 10) : 2024

  // Converter questionNumbers sequenciais (1-180) para posição relativa (1-45) + área
  const converted = wrongNumbers.map(qn => ({
    qn,
    mapped: questionNumberToAreaAndPosition(qn),
  }))

  // Agrupar posições por área para buscar no banco por área
  const byArea = new Map<AreaSigla, number[]>()
  for (const { mapped } of converted) {
    if (!mapped) continue
    const existing = byArea.get(mapped.area)
    if (existing) {
      existing.push(mapped.posicao)
    } else {
      byArea.set(mapped.area, [mapped.posicao])
    }
  }

  // Contar erros por área usando a conversão de questionNumber
  const errosPorAreaCount: Record<AreaSigla, number[]> = { LC: [], CH: [], CN: [], MT: [] }
  for (const { qn, mapped } of converted) {
    if (mapped) {
      errosPorAreaCount[mapped.area].push(qn)
    }
  }

  // Buscar TODAS as habilidades para ter as descrições
  const { data: habilidades } = await inepClient
    .from('enem_habilidades')
    .select('area, numero_habilidade, descricao, identificador')

  const habDescMap = new Map<string, { descricao: string; identificador: string }>(
    (habilidades ?? []).map(h => [
      `${h.area}_${h.numero_habilidade}`,
      { descricao: h.descricao, identificador: h.identificador ?? `${h.area}-H${h.numero_habilidade}` },
    ])
  )

  // Tentar cruzar com enem_itens_prova se for prova ENEM oficial
  const isEnemOficial = /enem\s*20\d{2}/i.test(examTitle) || /prova\s*(dia|enem)/i.test(examTitle)

  const errosMap = new Map<string, { area: AreaSigla; numHab: number; questoes: number[] }>()
  const habilidadesSemMapeamento: number[] = []

  if (isEnemOficial) {
    // Prova ENEM oficial: tentar cruzar posição → co_item → habilidade
    for (const [area, posicoes] of byArea) {
      const uniquePosicoes = [...new Set(posicoes.map(qn => {
        const m = questionNumberToAreaAndPosition(qn)
        return m?.posicao ?? 0
      }).filter(p => p > 0))]

      const { data: itensProva } = await inepClient
        .from('enem_itens_prova')
        .select('co_item, posicao')
        .eq('ano', examYear)
        .in('posicao', uniquePosicoes)

      if (!itensProva || itensProva.length === 0) continue

      const coItems = [...new Set(itensProva.map(ip => ip.co_item))]
      const { data: itens } = await inepClient
        .from('enem_itens')
        .select('co_item, area, numero_habilidade')
        .in('co_item', coItems)
        .eq('area', area)

      if (!itens) continue

      const coItemToItem = new Map(itens.map(i => [i.co_item, i]))
      const posToCoItem = new Map<number, number>()
      for (const ip of itensProva) {
        if (ip.posicao != null && !posToCoItem.has(ip.posicao)) {
          const itemInfo = coItemToItem.get(ip.co_item)
          if (itemInfo) posToCoItem.set(ip.posicao, ip.co_item)
        }
      }

      for (const qn of errosPorAreaCount[area]) {
        const mapped = questionNumberToAreaAndPosition(qn)
        if (!mapped) continue
        const coItem = posToCoItem.get(mapped.posicao)
        if (coItem == null) { habilidadesSemMapeamento.push(qn); continue }
        const item = coItemToItem.get(coItem)
        if (!item || item.numero_habilidade == null) { habilidadesSemMapeamento.push(qn); continue }

        const key = `${item.area}_${item.numero_habilidade}`
        const existing = errosMap.get(key)
        if (existing) {
          errosMap.set(key, { ...existing, questoes: [...existing.questoes, qn] })
        } else {
          errosMap.set(key, { area: item.area as AreaSigla, numHab: item.numero_habilidade, questoes: [qn] })
        }
      }
    }
  }

  // Se NÃO é ENEM oficial OU o cruzamento não retornou resultados:
  // usar contagem por área e distribuir erros entre habilidades de maior incidência
  if (errosMap.size === 0) {
    // Buscar habilidades mais frequentes por área no ENEM histórico
    for (const area of ['LC', 'CH', 'CN', 'MT'] as const) {
      const qnsErrados = errosPorAreaCount[area]
      if (qnsErrados.length === 0) continue

      // Buscar quais habilidades mais caem nessa área
      const { data: topHabs } = await inepClient
        .from('enem_itens')
        .select('numero_habilidade')
        .eq('area', area)
        .not('numero_habilidade', 'is', null)

      if (!topHabs || topHabs.length === 0) continue

      // Contar frequência de cada habilidade
      const habFreq = new Map<number, number>()
      for (const item of topHabs) {
        habFreq.set(item.numero_habilidade, (habFreq.get(item.numero_habilidade) ?? 0) + 1)
      }

      // Top 3 habilidades mais frequentes
      const topHabNums = [...habFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([num]) => num)

      // Distribuir os erros entre as top habilidades proporcionalmente
      const totalErrosArea = qnsErrados.length
      const perHab = Math.ceil(totalErrosArea / topHabNums.length)

      for (let i = 0; i < topHabNums.length; i++) {
        const numHab = topHabNums[i]
        const start = i * perHab
        const end = Math.min(start + perHab, totalErrosArea)
        const questoesSlice = qnsErrados.slice(start, end)
        if (questoesSlice.length === 0) continue

        const key = `${area}_${numHab}`
        errosMap.set(key, { area, numHab, questoes: questoesSlice })
      }
    }
  }

  const errosPorHabilidade: ErroHabilidade[] = [...errosMap.entries()]
    .map(([key, val]) => {
      const hab = habDescMap.get(key)
      return {
        area: val.area,
        numeroHabilidade: val.numHab,
        identificador: hab?.identificador ?? `${val.area}-H${val.numHab}`,
        descricao: hab?.descricao ?? '',
        questoesErradas: val.questoes,
        totalErros: val.questoes.length,
      }
    })
    .sort((a, b) => b.totalErros - a.totalErros)

  return {
    errosPorHabilidade,
    totalQuestoesErradas: wrongNumbers.length,
    habilidadesSemMapeamento: [...new Set(habilidadesSemMapeamento)],
  }
}

// ============ 2. PARÂMETROS TRI ============

async function computeParametrosTRI(
  result: SimuladoResult,
  inepClient: SupabaseClient,
): Promise<ParametrosTRI> {
  const wrongNumbers = result.wrongQuestions.map(q => q.questionNumber)

  if (wrongNumbers.length === 0) {
    return {
      itensErrados: [],
      desperdicios: [],
      errosEsperados: [],
      totalDesperdicios: 0,
      totalErrosEsperados: 0,
    }
  }

  const examTitle = result.exam.title ?? ''
  const isEnemOficial = /enem\s*20\d{2}/i.test(examTitle) || /prova\s*(dia|enem)/i.test(examTitle)

  // Para simulados escolares, não temos parâmetros TRI dos itens
  // (as questões do simulado NÃO são questões do ENEM oficial)
  if (!isEnemOficial) {
    // Criar itens "virtuais" usando apenas a classificação por área
    // sem parâmetros TRI reais (que não existem para essas questões)
    const itensErrados: ItemTRI[] = wrongNumbers
      .map(qn => {
        const mapped = questionNumberToAreaAndPosition(qn)
        if (!mapped) return null
        return {
          questionNumber: qn,
          coItem: 0,
          area: mapped.area,
          paramDificuldade: 0, // desconhecido
          paramDiscriminacao: 0,
          paramAcertoCasual: 0.2,
          classificacao: 'medio' as ClassificacaoDificuldade,
        }
      })
      .filter((item): item is ItemTRI => item !== null)

    return {
      itensErrados,
      desperdicios: [], // sem dados TRI reais, não podemos classificar desperdícios
      errosEsperados: [],
      totalDesperdicios: 0,
      totalErrosEsperados: 0,
    }
  }

  const yearMatch = examTitle.match(/20\d{2}/)
  const examYear = yearMatch ? parseInt(yearMatch[0], 10) : 2024

  // Converter questionNumbers para posição relativa + área
  const converted = wrongNumbers.map(qn => ({
    qn,
    mapped: questionNumberToAreaAndPosition(qn),
  }))

  // Buscar itens de prova por área + posição relativa
  const itensErrados: ItemTRI[] = []

  for (const area of ['LC', 'CH', 'CN', 'MT'] as const) {
    const qnsArea = converted.filter(c => c.mapped?.area === area)
    if (qnsArea.length === 0) continue

    const posicoes = [...new Set(qnsArea.map(c => c.mapped!.posicao))]
    const { data: itensProva } = await inepClient
      .from('enem_itens_prova')
      .select('co_item, posicao')
      .eq('ano', examYear)
      .in('posicao', posicoes)

    if (!itensProva || itensProva.length === 0) continue

    const coItems = [...new Set(itensProva.map(ip => ip.co_item))]
    const { data: itens } = await inepClient
      .from('enem_itens')
      .select('co_item, area, param_dificuldade, param_discriminacao, param_acerto_casual')
      .in('co_item', coItems)
      .eq('area', area)

    if (!itens || itens.length === 0) continue

    const coItemMap = new Map(itens.map(i => [i.co_item, i]))
    const posToCoItem = new Map<number, number>()
    for (const ip of itensProva) {
      if (ip.posicao != null && !posToCoItem.has(ip.posicao) && coItemMap.has(ip.co_item)) {
        posToCoItem.set(ip.posicao, ip.co_item)
      }
    }

    for (const { qn, mapped } of qnsArea) {
      if (!mapped) continue
      const coItem = posToCoItem.get(mapped.posicao)
      if (coItem == null) continue
      const params = coItemMap.get(coItem)
      if (!params) continue

      const b = Number(params.param_dificuldade ?? 0)
      const a = Number(params.param_discriminacao ?? 0)
      const c = Number(params.param_acerto_casual ?? 0)

      itensErrados.push({
        questionNumber: qn,
        coItem,
        area,
        paramDificuldade: b,
        paramDiscriminacao: a,
        paramAcertoCasual: c,
        classificacao: classificarDificuldade(b),
      })
    }
  }

  const desperdicios = itensErrados.filter(i => i.paramDificuldade < 0)
  const errosEsperados = itensErrados.filter(i => i.paramDificuldade > 1.5)

  return {
    itensErrados,
    desperdicios,
    errosEsperados,
    totalDesperdicios: desperdicios.length,
    totalErrosEsperados: errosEsperados.length,
  }
}

// ============ 3. INCIDÊNCIA HISTÓRICA ============

async function computeIncidenciaHistorica(
  mapaHabilidades: MapaHabilidades,
  inepClient: SupabaseClient,
): Promise<IncidenciaHistorica> {
  // Buscar todas as habilidades que foram erradas
  const habsErradas = mapaHabilidades.errosPorHabilidade

  if (habsErradas.length === 0) {
    return {
      habilidades: [],
      periodoAnalisado: { inicio: 2010, fim: 2024 },
    }
  }

  // Contar total de itens por (area, numero_habilidade) em toda a base 2010-2024
  const areas = [...new Set(habsErradas.map(h => h.area))]

  const { data: todosItens } = await inepClient
    .from('enem_itens')
    .select('area, numero_habilidade, ano')
    .in('area', areas)
    .gte('ano', 2010)
    .lte('ano', 2024)

  if (!todosItens || todosItens.length === 0) {
    return {
      habilidades: [],
      periodoAnalisado: { inicio: 2010, fim: 2024 },
    }
  }

  // Contar provas únicas por área (cada ano é uma prova)
  const provasPorArea = new Map<string, Set<number>>()
  const aparicoesPorHab = new Map<string, Set<number>>()

  for (const item of todosItens) {
    if (item.numero_habilidade == null) continue

    const areaKey = item.area as string
    if (!provasPorArea.has(areaKey)) {
      provasPorArea.set(areaKey, new Set())
    }
    provasPorArea.get(areaKey)!.add(item.ano)

    const habKey = `${item.area}_${item.numero_habilidade}`
    if (!aparicoesPorHab.has(habKey)) {
      aparicoesPorHab.set(habKey, new Set())
    }
    aparicoesPorHab.get(habKey)!.add(item.ano)
  }

  const habilidades: IncidenciaHabilidade[] = habsErradas.map(h => {
    const habKey = `${h.area}_${h.numeroHabilidade}`
    const totalAparicoes = aparicoesPorHab.get(habKey)?.size ?? 0
    const totalProvas = provasPorArea.get(h.area)?.size ?? 1

    return {
      area: h.area,
      numeroHabilidade: h.numeroHabilidade,
      identificador: h.identificador,
      totalAparicoes,
      totalProvas,
      percentualIncidencia: totalProvas > 0
        ? Math.round((totalAparicoes / totalProvas) * 1000) / 10
        : 0,
    }
  })

  return {
    habilidades: habilidades.sort((a, b) => b.percentualIncidencia - a.percentualIncidencia),
    periodoAnalisado: { inicio: 2010, fim: 2024 },
  }
}

// ============ 4. ANÁLISE SISU ============

/** Mapa de siglas → nome completo para universidades federais/estaduais */
const SIGLA_UNIVERSIDADE: Readonly<Record<string, string>> = {
  UFMA: 'Universidade Federal do Maranhão',
  UFMG: 'Universidade Federal de Minas Gerais',
  UFRJ: 'Universidade Federal do Rio de Janeiro',
  USP: 'Universidade de São Paulo',
  UNICAMP: 'Universidade Estadual de Campinas',
  UFRGS: 'Universidade Federal do Rio Grande do Sul',
  UFBA: 'Universidade Federal da Bahia',
  UFPE: 'Universidade Federal de Pernambuco',
  UFPR: 'Universidade Federal do Paraná',
  UFSC: 'Universidade Federal de Santa Catarina',
  UNB: 'Universidade de Brasília',
  UFC: 'Universidade Federal do Ceará',
  UFPA: 'Universidade Federal do Pará',
  UFRN: 'Universidade Federal do Rio Grande do Norte',
  UFES: 'Universidade Federal do Espírito Santo',
  UFG: 'Universidade Federal de Goiás',
  UFAL: 'Universidade Federal de Alagoas',
  UFPB: 'Universidade Federal da Paraíba',
  UFS: 'Universidade Federal de Sergipe',
  UFPI: 'Universidade Federal do Piauí',
  UFAM: 'Universidade Federal do Amazonas',
  UFJF: 'Universidade Federal de Juiz de Fora',
  UFMS: 'Universidade Federal de Mato Grosso do Sul',
  UFMT: 'Universidade Federal de Mato Grosso',
  UFSM: 'Universidade Federal de Santa Maria',
  UFOP: 'Universidade Federal de Ouro Preto',
  UFSCAR: 'Universidade Federal de São Carlos',
  UNIFESP: 'Universidade Federal de São Paulo',
  UFCG: 'Universidade Federal de Campina Grande',
  UFERSA: 'Universidade Federal Rural do Semi-Árido',
  UFRRJ: 'Universidade Federal Rural do Rio de Janeiro',
  UFF: 'Universidade Federal Fluminense',
  UFABC: 'Universidade Federal do ABC',
  UFTM: 'Universidade Federal do Triângulo Mineiro',
  UFU: 'Universidade Federal de Uberlândia',
  UFLA: 'Universidade Federal de Lavras',
  UFV: 'Universidade Federal de Viçosa',
  UNIR: 'Universidade Federal de Rondônia',
  UNIFAP: 'Universidade Federal do Amapá',
  UFRR: 'Universidade Federal de Roraima',
  UFT: 'Universidade Federal do Tocantins',
  UFAC: 'Universidade Federal do Acre',
  UFRA: 'Universidade Federal Rural da Amazônia',
  IFMA: 'Instituto Federal de Educação, Ciência e Tecnologia do Maranhão',
}

/**
 * Expande sigla para nome completo se possível.
 * Retorna o input original se não for sigla conhecida.
 */
function expandirSigla(input: string): string {
  const upper = input.trim().toUpperCase()
  return SIGLA_UNIVERSIDADE[upper] ?? input
}

async function findCurso(
  curso: CursoEscolhido,
  inepClient: SupabaseClient,
): Promise<CursoEncontrado | null> {
  const nomeExpandido = expandirSigla(curso.universidade)
  const usouSigla = nomeExpandido !== curso.universidade

  // Busca 1: nome + universidade (expandida) + estado
  const { data } = await inepClient
    .from('sisu_cursos')
    .select('id, codigo, nome, universidade, campus, cidade, estado, grau, turno')
    .ilike('nome', `%${curso.nome}%`)
    .ilike('universidade', `%${nomeExpandido}%`)
    .eq('estado', curso.estado.toUpperCase())
    .limit(5)

  if (data && data.length > 0) {
    return data[0] as CursoEncontrado
  }

  // Busca 2: se usou sigla, tentar com sigla original (caso o banco tenha a sigla)
  if (usouSigla) {
    const { data: siglaBusca } = await inepClient
      .from('sisu_cursos')
      .select('id, codigo, nome, universidade, campus, cidade, estado, grau, turno')
      .ilike('nome', `%${curso.nome}%`)
      .ilike('universidade', `%${curso.universidade}%`)
      .eq('estado', curso.estado.toUpperCase())
      .limit(5)

    if (siglaBusca && siglaBusca.length > 0) {
      return siglaBusca[0] as CursoEncontrado
    }
  }

  // Busca 3: só por nome + estado (sem universidade — fallback amplo)
  const { data: fallback } = await inepClient
    .from('sisu_cursos')
    .select('id, codigo, nome, universidade, campus, cidade, estado, grau, turno')
    .ilike('nome', `%${curso.nome}%`)
    .eq('estado', curso.estado.toUpperCase())
    .limit(10)

  if (!fallback || fallback.length === 0) return null

  // Se encontrou, priorizar a que mais se aproxima da universidade informada
  const nomeUpper = nomeExpandido.toUpperCase()
  const melhorMatch = fallback.find(
    (c) => c.universidade?.toUpperCase().includes(nomeUpper),
  )
  return (melhorMatch ?? fallback[0]) as CursoEncontrado
}

/**
 * Redação assumida no cálculo quando o simulado não mede redação.
 * Valor otimista mas realista para alunos focados — ver legenda na UI
 * "* Assumimos redação = 900 na simulação SISU".
 */
export const REDACAO_ASSUMIDA_DEFAULT = 900

function computeNotaPonderada(
  notas: NotasAluno,
  pesos: PesosSisu,
): number | null {
  const lc = notas.lc
  const ch = notas.ch
  const cn = notas.cn
  const mt = notas.mt
  const red = notas.redacao

  if (lc == null || ch == null || cn == null || mt == null) return null

  // Se não tem redação (simulado padrão não mede), assume 900 hardcoded.
  // Isso evita cair a nota ponderada artificialmente ao ignorar o peso da redação.
  const redacaoNota = red ?? REDACAO_ASSUMIDA_DEFAULT
  const redacaoPeso = pesos.redacao

  const numerador =
    lc * pesos.linguagens +
    ch * pesos.cienciasHumanas +
    cn * pesos.cienciasNatureza +
    mt * pesos.matematica +
    redacaoNota * redacaoPeso

  const denominador =
    pesos.linguagens +
    pesos.cienciasHumanas +
    pesos.cienciasNatureza +
    pesos.matematica +
    redacaoPeso

  if (denominador === 0) return null

  return Math.round((numerador / denominador) * 100) / 100
}

function computeRoi(pesos: PesosSisu): ReadonlyArray<RoiArea> {
  const totalPesos =
    pesos.linguagens + pesos.cienciasHumanas + pesos.cienciasNatureza +
    pesos.matematica + pesos.redacao

  if (totalPesos === 0) return []

  const areas: Array<{ area: string; sigla: AreaSigla | 'RED'; peso: number }> = [
    { area: 'Linguagens', sigla: 'LC', peso: pesos.linguagens },
    { area: 'Ciencias Humanas', sigla: 'CH', peso: pesos.cienciasHumanas },
    { area: 'Ciencias da Natureza', sigla: 'CN', peso: pesos.cienciasNatureza },
    { area: 'Matematica', sigla: 'MT', peso: pesos.matematica },
    { area: 'Redacao', sigla: 'RED', peso: pesos.redacao },
  ]

  return areas
    .map(a => ({
      area: a.area,
      sigla: a.sigla,
      peso: a.peso,
      pesoNormalizado: Math.round((a.peso / totalPesos) * 10000) / 10000,
      valorPontoFinal: Math.round((a.peso / totalPesos) * 10000) / 10000,
    }))
    .sort((a, b) => b.valorPontoFinal - a.valorPontoFinal)
}

async function computeSisuAnalysis(
  result: SimuladoResult,
  curso: CursoEscolhido,
  inepClient: SupabaseClient,
): Promise<SisuAnalysis> {
  const cursoFound = await findCurso(curso, inepClient)

  if (!cursoFound) {
    return {
      curso: null,
      pesos: null,
      notaCorte: null,
      candidatos: null,
      vagas: null,
      nomeModalidade: curso.modalidade ?? 'Ampla concorrencia',
      notaPonderadaAtual: null,
      gap: null,
      roiPorArea: [],
      anoReferencia: null,
    }
  }

  // Sempre usar Ampla Concorrência como referência — independente do que o aluno selecionou
  const modalidadeNome = 'Ampla concorrencia'

  // Buscar pesos e nota de corte em paralelo
  const [pesosResult, notaCorteResult] = await Promise.all([
    inepClient
      .from('sisu_pesos')
      .select('ano, peso_redacao, peso_linguagens, peso_matematica, peso_ciencias_humanas, peso_ciencias_natureza')
      .eq('curso_id', cursoFound.id)
      .order('ano', { ascending: false })
      .limit(1),
    inepClient
      .from('sisu_notas_corte')
      .select('ano, nota_corte, candidatos, vagas, nome_modalidade')
      .eq('curso_id', cursoFound.id)
      .ilike('nome_modalidade', `%${normalizeForIlike(modalidadeNome)}%`)
      .not('nota_corte', 'is', null)
      .gt('nota_corte', 0)
      .order('ano', { ascending: false })
      .limit(1),
  ])

  const pesosRow = pesosResult.data?.[0] ?? null
  const notaCorteRow = notaCorteResult.data?.[0] ?? null

  // Se a busca por modalidade falhou, tentar com código 0 (ampla)
  let finalNotaCorte = notaCorteRow
  if (!finalNotaCorte) {
    const { data: fallbackNota } = await inepClient
      .from('sisu_notas_corte')
      .select('ano, nota_corte, candidatos, vagas, nome_modalidade')
      .eq('curso_id', cursoFound.id)
      .not('nota_corte', 'is', null)
      .gt('nota_corte', 0)
      .order('ano', { ascending: false })
      .limit(1)

    finalNotaCorte = fallbackNota?.[0] ?? null
  }

  const pesos: PesosSisu | null = pesosRow
    ? {
        ano: pesosRow.ano,
        redacao: Number(pesosRow.peso_redacao ?? 1),
        linguagens: Number(pesosRow.peso_linguagens ?? 1),
        matematica: Number(pesosRow.peso_matematica ?? 1),
        cienciasHumanas: Number(pesosRow.peso_ciencias_humanas ?? 1),
        cienciasNatureza: Number(pesosRow.peso_ciencias_natureza ?? 1),
      }
    : null

  const notas = extractNotasAluno(result)
  const notaPonderada = pesos ? computeNotaPonderada(notas, pesos) : null
  const notaCorte = finalNotaCorte ? Number(finalNotaCorte.nota_corte) : null
  const gap = notaPonderada != null && notaCorte != null
    ? Math.round((notaPonderada - notaCorte) * 100) / 100
    : null

  return {
    curso: cursoFound,
    pesos,
    notaCorte,
    candidatos: finalNotaCorte?.candidatos ?? null,
    vagas: finalNotaCorte?.vagas ?? null,
    nomeModalidade: finalNotaCorte?.nome_modalidade ?? modalidadeNome,
    notaPonderadaAtual: notaPonderada,
    gap,
    roiPorArea: pesos ? computeRoi(pesos) : [],
    anoReferencia: pesos?.ano ?? finalNotaCorte?.ano ?? null,
  }
}

// ============ 5. CENÁRIOS ============

function computeCenarios(
  result: SimuladoResult,
  sisuAnalysis: SisuAnalysis,
): Cenarios | null {
  if (!sisuAnalysis.pesos || sisuAnalysis.notaCorte == null) return null

  const notas = extractNotasAluno(result)
  const pesos = sisuAnalysis.pesos
  const notaCorte = sisuAnalysis.notaCorte

  // Encontrar a área de maior ROI (excluindo redação, que o simulado não tem)
  const roiSemRedacao = sisuAnalysis.roiPorArea.filter(r => r.sigla !== 'RED')
  const areaMaiorRoi = roiSemRedacao.length > 0 ? roiSemRedacao[0] : null

  function simularCenario(
    nome: string,
    descricao: string,
    incrementos: Record<string, number>,
  ): Cenario {
    const notasAjustadas: NotasAluno = {
      lc: (notas.lc ?? 0) + (incrementos['LC'] ?? 0),
      ch: (notas.ch ?? 0) + (incrementos['CH'] ?? 0),
      cn: (notas.cn ?? 0) + (incrementos['CN'] ?? 0),
      mt: (notas.mt ?? 0) + (incrementos['MT'] ?? 0),
      redacao: notas.redacao,
    }

    const notaFinal = computeNotaPonderada(notasAjustadas, pesos) ?? 0
    const gapEstimado = Math.round((notaFinal - notaCorte) * 100) / 100

    return {
      nome,
      descricao,
      incrementoPorArea: incrementos,
      notaFinalEstimada: notaFinal,
      gapEstimado,
    }
  }

  const areaFoco = areaMaiorRoi?.sigla ?? 'MT'

  return {
    otimista: simularCenario(
      'Otimista',
      `+40 pontos em ${areaFoco} (area de maior ROI) + 20 nas demais`,
      {
        LC: areaFoco === 'LC' ? 40 : 20,
        CH: areaFoco === 'CH' ? 40 : 20,
        CN: areaFoco === 'CN' ? 40 : 20,
        MT: areaFoco === 'MT' ? 40 : 20,
      },
    ),
    moderado: simularCenario(
      'Moderado',
      `+20 pontos em ${areaFoco} + 10 nas demais`,
      {
        LC: areaFoco === 'LC' ? 20 : 10,
        CH: areaFoco === 'CH' ? 20 : 10,
        CN: areaFoco === 'CN' ? 20 : 10,
        MT: areaFoco === 'MT' ? 20 : 10,
      },
    ),
    conservador: simularCenario(
      'Conservador',
      '+10 pontos em todas as areas',
      { LC: 10, CH: 10, CN: 10, MT: 10 },
    ),
  }
}

// ============ 6. PERFIL DE APROVADOS ============

async function computePerfilAprovados(
  sisuAnalysis: SisuAnalysis,
  inepClient: SupabaseClient,
): Promise<PerfilAprovados | null> {
  if (!sisuAnalysis.curso) return null

  const anoRef = sisuAnalysis.anoReferencia ?? 2025
  const modalidade = sisuAnalysis.nomeModalidade

  const { data: aprovados } = await inepClient
    .from('sisu_aprovados')
    .select('nota')
    .eq('curso_id', sisuAnalysis.curso.id)
    .eq('ano', anoRef)
    .order('nota', { ascending: true })
    .limit(5000)

  if (!aprovados || aprovados.length === 0) {
    // Tentar ano anterior
    const { data: fallback } = await inepClient
      .from('sisu_aprovados')
      .select('nota')
      .eq('curso_id', sisuAnalysis.curso.id)
      .eq('ano', anoRef - 1)
      .order('nota', { ascending: true })
      .limit(5000)

    if (!fallback || fallback.length === 0) return null

    return buildPerfilFromNotas(fallback.map(a => a.nota), anoRef - 1, modalidade)
  }

  return buildPerfilFromNotas(aprovados.map(a => a.nota), anoRef, modalidade)
}

function buildPerfilFromNotas(
  notas: ReadonlyArray<number>,
  ano: number,
  modalidade: string,
): PerfilAprovados {
  const sorted = [...notas].sort((a, b) => a - b)
  const sum = sorted.reduce((acc, n) => acc + n, 0)

  return {
    ano,
    totalAprovados: sorted.length,
    notaMedia: Math.round((sum / sorted.length) * 100) / 100,
    notaMinima: sorted[0],
    notaMaxima: sorted[sorted.length - 1],
    notaMediana: Math.round(median(sorted) * 100) / 100,
    notaP25: Math.round(percentile(sorted, 25) * 100) / 100,
    notaP75: Math.round(percentile(sorted, 75) * 100) / 100,
    modalidade,
  }
}

// ============ 7. BENCHMARK ESCOLA ============

async function computeBenchmarkEscola(
  codigoInep: string | undefined,
  inepClient: SupabaseClient,
): Promise<BenchmarkEscola | null> {
  if (!codigoInep) return null

  const [escolaResult, resultadosResult, desempenhoResult] = await Promise.all([
    inepClient
      .from('inep_escolas')
      .select('nome')
      .eq('codigo_inep', codigoInep)
      .single(),
    inepClient
      .from('inep_resultados_enem')
      .select('ano, media_ciencias_natureza, media_ciencias_humanas, media_linguagens, media_matematica, media_redacao, ranking_nacional, ranking_uf')
      .eq('codigo_inep', codigoInep)
      .order('ano', { ascending: false })
      .limit(1),
    inepClient
      .from('inep_desempenho_habilidades')
      .select('area, numero_habilidade, desempenho')
      .eq('codigo_inep', codigoInep)
      .order('ano', { ascending: false })
      .limit(120),
  ])

  const escola = escolaResult.data
  const resultado = resultadosResult.data?.[0]

  if (!escola || !resultado) return null

  return {
    codigoInep,
    nomeEscola: escola.nome,
    ano: resultado.ano,
    mediaCN: resultado.media_ciencias_natureza ? Number(resultado.media_ciencias_natureza) : null,
    mediaCH: resultado.media_ciencias_humanas ? Number(resultado.media_ciencias_humanas) : null,
    mediaLC: resultado.media_linguagens ? Number(resultado.media_linguagens) : null,
    mediaMT: resultado.media_matematica ? Number(resultado.media_matematica) : null,
    mediaRedacao: resultado.media_redacao ? Number(resultado.media_redacao) : null,
    rankingNacional: resultado.ranking_nacional,
    rankingUF: resultado.ranking_uf,
    desempenhoHabilidades: (desempenhoResult.data ?? []).map(d => ({
      area: d.area,
      numeroHabilidade: d.numero_habilidade,
      desempenho: Number(d.desempenho),
    })),
  }
}

// ============ 8. QUESTÕES RECOMENDADAS ============
// 20 questões INDIVIDUALIZADAS por aluno: 5 por área (LC, CH, CN, MT)
// Estratégia:
//   1. Identifica as TOP 3 habilidades que o aluno mais errou por área (score = erros × incidência)
//   2. Cruza com INEP: habilidade → co_items → (ano, posição no caderno)
//   3. Filtra por dificuldade calibrada ao TRI do aluno: param_b ≈ (TRI - 500) / 100
//   4. Busca questões com texto completo no banco uhqdkaftqjxenobdfqkd
//   5. Fallback por área se o cruzamento não gerar questões suficientes

const TARGET_QUESTOES_POR_AREA = 10
const MAX_QUESTOES_AREA_FALLBACK_POR_AREA = 4

function buildOptionsByQuestionId(
  rows: ReadonlyArray<{
    question_id: string
    letter: string
    text: string
    is_correct: boolean
  }>,
): Map<string, QuestionOptionRow[]> {
  const optionsByQuestionId = new Map<string, QuestionOptionRow[]>()

  for (const row of rows) {
    const option: QuestionOptionRow = {
      letter: row.letter,
      text: row.text,
      is_correct: row.is_correct,
    }
    const existing = optionsByQuestionId.get(row.question_id)
    if (existing) {
      existing.push(option)
    } else {
      optionsByQuestionId.set(row.question_id, [option])
    }
  }

  for (const [questionId, options] of optionsByQuestionId.entries()) {
    optionsByQuestionId.set(questionId, sortQuestionOptions(options))
  }

  return optionsByQuestionId
}

async function chooseQuestionRows(
  rows: ReadonlyArray<QuestionCandidateRow>,
  optionsByQuestionId: ReadonlyMap<string, ReadonlyArray<QuestionOptionRow>>,
): Promise<Array<{
  candidate: QuestionCandidateRow
  resolvedImageUrl: string | null
  sourceExamUsed: string | null
  wasSubstituted: boolean
}>> {
  const grouped = buildQuestionCandidateMap(rows)
  const chosen: Array<{
    candidate: QuestionCandidateRow
    resolvedImageUrl: string | null
    sourceExamUsed: string | null
    wasSubstituted: boolean
  }> = []

  for (const [key, candidates] of grouped.entries()) {
    const [sourceYearRaw, sourceQuestionRaw] = key.split(':')
    const resolution = await resolveItem(
      Number(sourceYearRaw),
      Number(sourceQuestionRaw),
      'LC',
      'delivery',
      {
        candidateRows: candidates,
        optionsByQuestionId,
      },
    )

    if (resolution.status === 'resolved' && resolution.resolvedQuestion) {
      chosen.push({
        candidate: resolution.resolvedQuestion.candidate,
        resolvedImageUrl: resolution.resolvedQuestion.resolvedImageUrl,
        sourceExamUsed: resolution.sourceExamUsed,
        wasSubstituted: resolution.wasSubstituted,
      })
    }
  }

  return chosen
}

function escapeIlikeToken(token: string): string {
  return token
    .replace(/[%_]/g, '')
    .replace(/'/g, "''")
    .trim()
}

function buildTopicSearchFilter(label: string): string | null {
  const terms = extractTopicSearchTerms(label)
    .map(escapeIlikeToken)
    .filter((token) => token.length >= 4)
    .slice(0, 4)

  if (terms.length === 0) {
    return null
  }

  return terms.flatMap((term) => [
    `stem.ilike.%${term}%`,
    `support_text.ilike.%${term}%`,
    `image_alt.ilike.%${term}%`,
  ]).join(',')
}

async function fetchTopicMatchedRecommendations(params: {
  readonly area: AreaSigla
  readonly topicLabel: string
  readonly triArea: number | null
  readonly habilidade: number
  readonly subjectIds: ReadonlyArray<string>
  readonly provasClient: SupabaseClient
}): Promise<QuestaoRecomendada[]> {
  if (params.subjectIds.length === 0) {
    return []
  }

  const searchFilter = buildTopicSearchFilter(params.topicLabel)
  if (!searchFilter) {
    return []
  }

  const { data: topicRaw } = await params.provasClient
    .from('questions')
    .select('id, stem, source_year, source_question, source_exam, difficulty, support_text, image_url, image_alt')
    .eq('source', 'ENEM')
    .in('subject_id', params.subjectIds)
    .or(searchFilter)
    .order('source_year', { ascending: false })
    .limit(160)

  const candidateRows = (topicRaw ?? []).filter(
    (row) => !isQuestionQuarantined(row.id as string),
  ) as QuestionCandidateRow[]

  if (candidateRows.length === 0) {
    return []
  }

  const qIds = candidateRows.map((question) => question.id as string)
  const { data: allOptions } = await params.provasClient
    .from('question_options')
    .select('question_id, letter, text, is_correct')
    .in('question_id', qIds)

  const optionsByQuestionId = buildOptionsByQuestionId(
    ((allOptions ?? []) as Array<{
      question_id: string
      letter: string
      text: string
      is_correct: boolean
    }>),
  )

  const chosen = await chooseQuestionRows(candidateRows, optionsByQuestionId)
  const difficultyByBucket: Record<string, number> = {
    VERY_EASY: -1.5,
    EASY: -0.5,
    MEDIUM: 0.5,
    HARD: 1.5,
    VERY_HARD: 2.5,
  }

  const withRelevance = chosen
    .map(({ candidate, resolvedImageUrl, sourceExamUsed, wasSubstituted }) => {
      const relevance = scoreTopicTextRelevance(params.topicLabel, {
        stem: candidate.stem,
        supportText: candidate.support_text,
        imageAlt: candidate.image_alt,
      })

      if (relevance <= 0) {
        return null
      }

      const options = optionsByQuestionId.get(candidate.id as string) ?? []
      const correctOpt = options.find((option) => option.is_correct)

      return {
        question: {
          coItem: candidate.source_question as number ?? 0,
          ano: candidate.source_year as number ?? 0,
          area: params.area,
          habilidade: params.habilidade,
          matchedTopicLabel: params.topicLabel,
          selectionSource: 'same_topic' as const,
          sourceExam: candidate.source_exam ?? null,
          sourceExamUsed,
          dificuldade: difficultyByBucket[(candidate.difficulty as string) ?? ''] ?? 0,
          discriminacao: 0,
          linkImagem: null,
          gabarito: correctOpt?.letter ?? null,
          posicaoCaderno: candidate.source_question as number | null,
          enunciado: (candidate.stem as string) ?? null,
          textoApoio: (candidate.support_text as string) ?? null,
          alternativas: options.length > 0
            ? options.map((option) => ({ letra: option.letter, texto: option.text }))
            : null,
          imagemUrl: resolvedImageUrl,
          requiresVisualContext: questionRequiresVisualContext(candidate),
          resolutionStatus: 'resolved' as const,
          wasSubstituted,
        },
        relevance,
      }
    })
    .filter((entry) => entry !== null)
    .sort((left, right) => right.relevance - left.relevance)

  return pickRecommendationsForStudent(
    withRelevance.map((entry) => entry.question),
    params.triArea,
    TARGET_QUESTOES_POR_AREA,
  )
}

async function computeQuestoesRecomendadas(
  result: SimuladoResult,
  mapaHabilidades: MapaHabilidades,
  incidenciaHistorica: IncidenciaHistorica,
  notas: NotasAluno,
  inepClient: SupabaseClient,
): Promise<QuestoesRecomendadas> {
  const erros = mapaHabilidades.errosPorHabilidade
  const observedAreas = getObservedAreasFromWrongQuestions(result.wrongQuestions)
  const incidencias = new Map(
    incidenciaHistorica.habilidades.map(h => [
      `${h.area}_${h.numeroHabilidade}`,
      h.percentualIncidencia,
    ])
  )

  // Score = erros × (incidência + 1) — quanto mais o aluno errou e mais cai no ENEM, maior o score
  const habComScore = erros.map(e => {
    const key = `${e.area}_${e.numeroHabilidade}`
    const incidencia = incidencias.get(key) ?? 0
    return {
      ...e,
      percentualIncidencia: incidencia,
      score: e.totalErros * (incidencia / 100 + 1),
    }
  })

  // TOP 3 habilidades por área para máxima individualização
  const areas: AreaSigla[] = observedAreas
  const topPorArea = new Map<AreaSigla, typeof habComScore>()
  for (const area of areas) {
    const habsDaArea = habComScore
      .filter(h => h.area === area)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    const topicBackedBuckets = buildTopicBackedBucketsForArea(area, result.wrongQuestions)

    topPorArea.set(
      area,
      habsDaArea.length > 0
        ? habsDaArea
        : topicBackedBuckets
    )
  }

  const provasClient = getProvasClient()

  // Buscar subjects para fallback por área
  const { data: subjects } = await provasClient.from('subjects').select('id, enem_area')
  const subjectsByArea = new Map<string, string[]>()
  if (subjects) {
    for (const s of subjects) {
      if (!s.enem_area) continue
      const area = s.enem_area as string
      const existing = subjectsByArea.get(area)
      if (existing) { existing.push(s.id as string) }
      else { subjectsByArea.set(area, [s.id as string]) }
    }
  }

  // TRI do aluno por área (para calibrar dificuldade das questões)
  const notasByArea: Record<AreaSigla, number | null> = {
    LC: notas.lc, CH: notas.ch, CN: notas.cn, MT: notas.mt,
  }

  const habilidadesCriticasNested = await Promise.all(
    areas.map(async (area): Promise<HabilidadeCritica[]> => {
      const habs = topPorArea.get(area) ?? []
      if (habs.length === 0) {
        return []
      }
      const topHab = habs[0]
      const habNums = habs.map(h => h.numeroHabilidade).filter(n => n > 0)
      // Fallback: se todas as habs têm numero 0 (topic-backed), buscar por área inteira
      const useAreaFallback = habNums.length === 0 && habs.length > 0
      const topHabFallbackLabel = getConteudoDidatico(topHab.identificador)
      const topHabFocus = derivePedagogicalFocusForSkill({
        erro: topHab,
        wrongQuestions: result.wrongQuestions,
        fallbackLabel: topHabFallbackLabel,
      })

      // Converter TRI (escala ENEM ≈ 0-1000) para param_b (escala IRT ≈ -3 a 3)
      // TRI 500 ≈ param_b 0; cada 100 pts TRI ≈ 1 unidade param_b
      const triArea = notasByArea[area]
      const difficultyWindow = getDifficultyWindowForTri(triArea)
      const paramBMin = difficultyWindow.min
      const paramBMax = difficultyWindow.max

      let recomendadas: QuestaoRecomendada[] = []
      let recomendadasTopic: QuestaoRecomendada[] = []
      let recomendadasSkill: QuestaoRecomendada[] = []

      if (topHabFocus.source === 'question_topic') {
        recomendadasTopic = await fetchTopicMatchedRecommendations({
          area,
          topicLabel: topHabFocus.label,
          triArea,
          habilidade: topHab.numeroHabilidade,
          subjectIds: subjectsByArea.get(area) ?? [],
          provasClient,
        })
      }

      // ── Passo 1: Cruzamento individualizado (habilidade → INEP → questão com texto) ──
      // Se habNums vazio mas tem habs (topic-backed), buscar por área inteira no INEP
      const effectiveHabNums = useAreaFallback
        ? habs.map(h => h.numeroHabilidade) // inclui 0, mas usaremos query diferente
        : habNums

      if ((effectiveHabNums.length > 0 || useAreaFallback) && topHab.totalErros > 0) {
        // 1a. Buscar co_items — por habilidade ou por área inteira (fallback)
        const itensQuery = useAreaFallback
          ? inepClient
              .from('enem_itens')
              .select('co_item, param_dificuldade, numero_habilidade')
              .eq('area', area)
              .gte('param_dificuldade', paramBMin)
              .lte('param_dificuldade', paramBMax)
              .limit(60)
          : inepClient
              .from('enem_itens')
              .select('co_item, param_dificuldade, numero_habilidade')
              .eq('area', area)
              .in('numero_habilidade', habNums)
              .gte('param_dificuldade', paramBMin)
              .lte('param_dificuldade', paramBMax)

        const { data: itensTRI } = await itensQuery

        // 1b. Se faixa restrita não retornou nada, buscar sem filtro de dificuldade
        const itensParaUsar = (itensTRI && itensTRI.length > 0)
          ? itensTRI
          : await (async () => {
              const fallbackQuery = useAreaFallback
                ? inepClient
                    .from('enem_itens')
                    .select('co_item, param_dificuldade, numero_habilidade')
                    .eq('area', area)
                    .limit(60)
                : inepClient
                    .from('enem_itens')
                    .select('co_item, param_dificuldade, numero_habilidade')
                    .eq('area', area)
                    .in('numero_habilidade', habNums)
              const { data } = await fallbackQuery
              return data ?? []
            })()

        if (itensParaUsar.length > 0) {
          const coItems = [...new Set(itensParaUsar.map(i => i.co_item as number))]
          const diffMap = new Map(itensParaUsar.map(i => [i.co_item as number, Number(i.param_dificuldade ?? 0)]))
          const habMap = new Map(itensParaUsar.map(i => [i.co_item as number, i.numero_habilidade as number]))

          // 1c. Buscar posições no caderno para esses co_items (anos recentes)
          const { data: posicoes } = await inepClient
            .from('enem_itens_prova')
            .select('co_item, posicao, ano')
            .in('co_item', coItems.slice(0, 120))
            .gte('ano', 2017)
            .order('ano', { ascending: false })

          if (posicoes && posicoes.length > 0) {
            // Deduplicar (ano, posicao) — manter apenas 1 por par
            const seen = new Set<string>()
            const uniquePairs: Array<{
              ano: number
              posicao: number
              posicaoCaderno: number
              paramB: number
              dificuldade: number
              habNum: number
              coItem: number
            }> = []
            for (const p of posicoes) {
              const key = `${p.ano}_${p.posicao}`
              if (!seen.has(key)) {
                seen.add(key)
                uniquePairs.push({
                  ano: p.ano as number,
                  posicao: p.posicao as number,
                  posicaoCaderno: p.posicao as number,
                  paramB: diffMap.get(p.co_item as number) ?? 0,
                  dificuldade: diffMap.get(p.co_item as number) ?? 0,
                  habNum: habMap.get(p.co_item as number) ?? topHab.numeroHabilidade,
                  coItem: p.co_item as number,
                })
              }
            }

            const sorted = pickRecommendationsForStudent(
              uniquePairs,
              triArea,
              40,
            )

            if (sorted.length > 0) {
              // 1d. Buscar questões com texto completo no banco de provas
              const orFilter = sorted
                .map(c => `and(source_year.eq.${c.ano},source_question.eq.${c.posicao})`)
                .join(',')

              const { data: questoesRaw } = await provasClient
                .from('questions')
                .select('id, stem, source_year, source_question, source_exam, difficulty, support_text, image_url, image_alt')
                .eq('source', 'ENEM')
                .or(orFilter)
                .limit(80)

              const candidateRows = (questoesRaw ?? []).filter(
                (row) => !isQuestionQuarantined(row.id as string),
              ) as QuestionCandidateRow[]

              if (candidateRows.length > 0) {
                const qIds = candidateRows.map(q => q.id as string)
                const { data: allOptions } = await provasClient
                  .from('question_options')
                  .select('question_id, letter, text, is_correct')
                  .in('question_id', qIds)

                const optsByQ = buildOptionsByQuestionId(
                  ((allOptions ?? []) as Array<{
                    question_id: string
                    letter: string
                    text: string
                    is_correct: boolean
                  }>),
                )
                const questoes = await chooseQuestionRows(candidateRows, optsByQ)

                const pairParamMap = new Map(sorted.map(c => [`${c.ano}_${c.posicao}`, c]))

                recomendadasSkill = questoes
                  .map(({ candidate: q, resolvedImageUrl, sourceExamUsed, wasSubstituted }) => {
                    const opts = optsByQ.get(q.id as string) ?? []
                    const correctOpt = opts.find(o => o.is_correct)
                    const requiresVisualContext = questionRequiresVisualContext(q)
                    const pair = pairParamMap.get(`${q.source_year as number}_${q.source_question as number}`)
                    return {
                      coItem: pair?.coItem ?? (q.source_question as number ?? 0),
                      ano: q.source_year as number ?? 0,
                      area,
                      habilidade: pair?.habNum ?? topHab.numeroHabilidade,
                      matchedTopicLabel: topHabFocus.source === 'question_topic'
                        ? topHabFocus.label
                        : null,
                      selectionSource: 'same_skill' as const,
                      sourceExam: q.source_exam ?? null,
                      sourceExamUsed,
                      dificuldade: pair?.paramB ?? 0,
                      discriminacao: 0,
                      linkImagem: null,
                      gabarito: correctOpt?.letter ?? null,
                      posicaoCaderno: q.source_question as number | null,
                      enunciado: (q.stem as string) ?? null,
                      textoApoio: (q.support_text as string) ?? null,
                      alternativas: opts.length > 0 ? opts.map(o => ({ letra: o.letter, texto: o.text })) : null,
                      imagemUrl: resolvedImageUrl,
                      requiresVisualContext,
                      resolutionStatus: 'resolved' as const,
                      wasSubstituted,
                    }
                  })

                recomendadasSkill = pickRecommendationsForStudent(
                  recomendadasSkill,
                  triArea,
                  TARGET_QUESTOES_POR_AREA,
                )
              }
            }
          }
        }
      }

      recomendadas = mergeRecommendationsForStudent(
        recomendadasTopic,
        recomendadasSkill,
        triArea,
        TARGET_QUESTOES_POR_AREA,
      )

      // Completa com fallback por área sem sobrescrever o que já foi personalizado.
      if (recomendadas.length < TARGET_QUESTOES_POR_AREA) {
        const subjectIds = subjectsByArea.get(area) ?? []
        if (subjectIds.length > 0) {
          const { data: questoesFallbackRaw } = await provasClient
            .from('questions')
            .select('id, stem, source_year, source_question, source_exam, difficulty, support_text, image_url, image_alt')
            .eq('source', 'ENEM')
            .in('subject_id', subjectIds)
            .order('source_year', { ascending: false })
            .limit(120)

          const candidateRows = (questoesFallbackRaw ?? []).filter(
            (row) => !isQuestionQuarantined(row.id as string),
          ) as QuestionCandidateRow[]

          if (candidateRows.length > 0) {
            const qIds = candidateRows.map(q => q.id as string)
            const { data: allOptions } = await provasClient
              .from('question_options')
              .select('question_id, letter, text, is_correct')
              .in('question_id', qIds)

            const optsByQ = buildOptionsByQuestionId(
              ((allOptions ?? []) as Array<{
                question_id: string
                letter: string
                text: string
                is_correct: boolean
              }>),
            )
            const questoesFallback = await chooseQuestionRows(candidateRows, optsByQ)

            const diffMap: Record<string, number> = { VERY_EASY: -1.5, EASY: -0.5, MEDIUM: 0.5, HARD: 1.5, VERY_HARD: 2.5 }
            const recomendadasFallback = questoesFallback.map(({ candidate: q, resolvedImageUrl, sourceExamUsed, wasSubstituted }) => {
              const opts = optsByQ.get(q.id as string) ?? []
              const correctOpt = opts.find(o => o.is_correct)
              const requiresVisualContext = questionRequiresVisualContext(q)
              return {
                coItem: q.source_question as number ?? 0,
                ano: q.source_year as number ?? 0,
                area,
                habilidade: topHab.numeroHabilidade,
                matchedTopicLabel: null,
                selectionSource: 'area_fallback' as const,
                sourceExam: q.source_exam ?? null,
                sourceExamUsed,
                dificuldade: diffMap[(q.difficulty as string) ?? ''] ?? 0,
                discriminacao: 0,
                linkImagem: null,
                gabarito: correctOpt?.letter ?? null,
                posicaoCaderno: q.source_question as number | null,
                enunciado: (q.stem as string) ?? null,
                textoApoio: (q.support_text as string) ?? null,
                alternativas: opts.length > 0 ? opts.map(o => ({ letra: o.letter, texto: o.text })) : null,
                imagemUrl: resolvedImageUrl,
                requiresVisualContext,
                resolutionStatus: 'resolved' as const,
                wasSubstituted,
              }
            })

            recomendadas = mergeRecommendationsForStudent(
              recomendadas,
              recomendadasFallback,
              triArea,
              TARGET_QUESTOES_POR_AREA,
              MAX_QUESTOES_AREA_FALLBACK_POR_AREA,
            )
          }
        }
      }

      // Distribuir as questões recomendadas entre as top habilidades por numeroHabilidade.
      // Cada conteúdo crítico recebe apenas as questões que realmente avaliam aquela habilidade.
      const questoesByHab = new Map<number, QuestaoRecomendada[]>()
      for (const q of recomendadas) {
        const entry = questoesByHab.get(q.habilidade)
        if (entry) { entry.push(q) } else { questoesByHab.set(q.habilidade, [q]) }
      }

      // CRÍTICO: retornar TODAS as habilidades da área com erros (não apenas o top 1).
      // Sem isso, "Onde Investir" subdimensiona os erros do aluno — mostra só o topHab
      // e ignora as demais. O total por área somado pela UI precisa bater com o simulado.
      // Apenas as top habilidades (que passaram pela calibração TRI) recebem questoesRecomendadas.
      const topHabNumSet = useAreaFallback
        ? new Set(habs.map(h => h.numeroHabilidade)) // incluir todas (inclusive 0)
        : new Set(habNums)
      const todasHabsDaArea = habComScore
        .filter(h => h.area === area && h.totalErros > 0)
        .sort((a, b) => b.score - a.score)

      if (todasHabsDaArea.length === 0) {
        return []
      }

      // Deduplicação global por (ano, questão) dentro desta área — garante que a mesma
      // questão nunca apareça em duas habilidades diferentes do caderno PDF.
      const qKeyVistas = new Set<string>()
      const dedupeQuestoes = (
        lista: ReadonlyArray<QuestaoRecomendada>,
      ): QuestaoRecomendada[] => {
        const saida: QuestaoRecomendada[] = []
        for (const q of lista) {
          const key = `${q.ano}_${q.posicaoCaderno ?? q.coItem}`
          if (qKeyVistas.has(key)) continue
          qKeyVistas.add(key)
          saida.push(q)
        }
        return saida
      }

      return todasHabsDaArea.map(hab => {
        const pedagogicalFocus = derivePedagogicalFocusForSkill({
          erro: hab,
          wrongQuestions: result.wrongQuestions,
          fallbackLabel: getConteudoDidatico(hab.identificador),
        })

        return {
          pedagogicalLabel: pedagogicalFocus.label,
          pedagogicalLabelSource: pedagogicalFocus.source,
          area,
          numeroHabilidade: hab.numeroHabilidade,
          identificador: hab.identificador,
          totalErros: hab.totalErros,
          percentualIncidencia: hab.percentualIncidencia,
          score: Math.round(hab.score * 100) / 100,
          questoesRecomendadas: topHabNumSet.has(hab.numeroHabilidade)
            ? dedupeQuestoes(questoesByHab.get(hab.numeroHabilidade) ?? [])
            : useAreaFallback
              ? dedupeQuestoes(questoesByHab.get(0) ?? recomendadas.slice(0, TARGET_QUESTOES_POR_AREA))
              : [],
        }
      })
    })
  )

  const habilidadesCriticas = habilidadesCriticasNested.flat()
  const areaOrder: Record<string, number> = { LC: 0, CH: 1, CN: 2, MT: 3 }
  return {
    habilidadesCriticas: [...habilidadesCriticas].sort((a, b) => {
      const areaDiff = (areaOrder[a.area] ?? 99) - (areaOrder[b.area] ?? 99)
      if (areaDiff !== 0) return areaDiff
      // Dentro da mesma área: ordenar por score desc (mais crítico primeiro)
      return b.score - a.score
    }),
  }
}

// ============ MAIN ENGINE ============

/**
 * Computa todos os dados do relatório de forma determinística.
 * Zero IA — apenas computação sobre dados reais do Supabase.
 */
export async function computeReportData(
  result: SimuladoResult,
  curso: CursoEscolhido,
  options?: ComputeReportDataOptions,
): Promise<ReportData> {
  const inepClient = getInepSupabaseClient()

  // Fase 1: Mapa de habilidades (necessário para fases 3 e 8)
  emitReportProgress(options, {
    step: 'mapa_habilidades',
    message: 'Lendo erros e habilidades do simulado...',
  })
  const mapaHabilidades = await computeMapaHabilidades(result, inepClient)

  // Fase 2: Computar em paralelo tudo que pode ser paralelo
  emitReportProgress(options, {
    step: 'analise_base',
    message: 'Consultando SISU, TRI e incidência histórica...',
  })
  const [
    parametrosTRI,
    sisuAnalysis,
    incidenciaHistorica,
    benchmarkEscola,
  ] = await Promise.all([
    computeParametrosTRI(result, inepClient),
    computeSisuAnalysis(result, curso, inepClient),
    computeIncidenciaHistorica(mapaHabilidades, inepClient),
    computeBenchmarkEscola(options?.codigoInep, inepClient),
  ])

  // Notas do aluno necessárias para calibrar dificuldade das questões recomendadas
  const notas = extractNotasAluno(result)

  // Fase 3: Dependentes (dependem dos resultados anteriores)
  emitReportProgress(options, {
    step: 'questoes_recomendadas',
    message: 'Selecionando questões recomendadas no banco ENEM...',
  })
  const [cenarios, perfilAprovados, questoesRecomendadas] = await Promise.all([
    Promise.resolve(computeCenarios(result, sisuAnalysis)),
    computePerfilAprovados(sisuAnalysis, inepClient),
    computeQuestoesRecomendadas(result, mapaHabilidades, incidenciaHistorica, notas, inepClient),
  ])

  emitReportProgress(options, {
    step: 'finalizacao',
    message: 'Montando o relatório final...',
  })

  return {
    mapaHabilidades,
    parametrosTRI,
    incidenciaHistorica,
    sisuAnalysis,
    cenarios,
    perfilAprovados,
    benchmarkEscola,
    questoesRecomendadas,
    computedAt: new Date().toISOString(),
  }
}
