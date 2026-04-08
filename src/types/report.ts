// ============ REPORT ENGINE TYPES ============
// Tipos para o engine determinístico de dados do relatório XTRI.
// Toda computação é feita com dados reais do Supabase — zero IA.

import type { SimuladoResult } from './supabase'

// ============ INPUT TYPES ============

export interface CursoEscolhido {
  readonly nome: string
  readonly universidade: string
  readonly estado: string
  readonly modalidade?: string // default: "Ampla concorrência"
}

export interface ReportInput {
  readonly result: SimuladoResult
  readonly curso: CursoEscolhido
  readonly codigoInep?: string // opcional, para benchmark escola
}

export type ReportProgressStep =
  | 'mapa_habilidades'
  | 'analise_base'
  | 'questoes_recomendadas'
  | 'finalizacao'

export interface ReportProgress {
  readonly step: ReportProgressStep
  readonly message: string
}

export interface ComputeReportDataOptions {
  readonly codigoInep?: string
  readonly onProgress?: (progress: ReportProgress) => void
}

// ============ AREA TYPES ============

export type AreaSigla = 'CH' | 'CN' | 'LC' | 'MT'

export interface NotasAluno {
  readonly lc: number | null
  readonly ch: number | null
  readonly cn: number | null
  readonly mt: number | null
  readonly redacao: number | null
}

// ============ 1. MAPA DE HABILIDADES ============

export interface ErroHabilidade {
  readonly area: AreaSigla
  readonly numeroHabilidade: number
  readonly identificador: string // ex: "CH_H1"
  readonly descricao: string
  readonly questoesErradas: ReadonlyArray<number> // números das questões
  readonly totalErros: number
}

export interface MapaHabilidades {
  readonly errosPorHabilidade: ReadonlyArray<ErroHabilidade>
  readonly totalQuestoesErradas: number
  readonly habilidadesSemMapeamento: ReadonlyArray<number> // questões sem match
}

// ============ 2. PARÂMETROS TRI ============

export type ClassificacaoDificuldade = 'muito_facil' | 'facil' | 'medio' | 'dificil' | 'muito_dificil'

export interface ItemTRI {
  readonly questionNumber: number
  readonly coItem: number
  readonly area: AreaSigla
  readonly paramDificuldade: number
  readonly paramDiscriminacao: number
  readonly paramAcertoCasual: number
  readonly classificacao: ClassificacaoDificuldade
}

export interface ParametrosTRI {
  readonly itensErrados: ReadonlyArray<ItemTRI>
  readonly desperdicios: ReadonlyArray<ItemTRI> // errou fácil (dificuldade < 0)
  readonly errosEsperados: ReadonlyArray<ItemTRI> // errou difícil (> 1.5)
  readonly totalDesperdicios: number
  readonly totalErrosEsperados: number
}

// ============ 3. INCIDÊNCIA HISTÓRICA ============

export interface IncidenciaHabilidade {
  readonly area: AreaSigla
  readonly numeroHabilidade: number
  readonly identificador: string
  readonly totalAparicoes: number
  readonly totalProvas: number // total de provas na área (2010-2024)
  readonly percentualIncidencia: number // (totalAparicoes / totalProvas) * 100
}

export interface IncidenciaHistorica {
  readonly habilidades: ReadonlyArray<IncidenciaHabilidade>
  readonly periodoAnalisado: { readonly inicio: number; readonly fim: number }
}

// ============ 4. ANÁLISE SISU ============

export interface PesosSisu {
  readonly ano: number
  readonly redacao: number
  readonly linguagens: number
  readonly matematica: number
  readonly cienciasHumanas: number
  readonly cienciasNatureza: number
}

export interface RoiArea {
  readonly area: string // nome legível
  readonly sigla: AreaSigla | 'RED'
  readonly peso: number
  readonly pesoNormalizado: number // peso / soma_pesos
  readonly valorPontoFinal: number // quanto 1 ponto nessa área vale na nota final
}

export interface CursoEncontrado {
  readonly id: number
  readonly codigo: number
  readonly nome: string
  readonly universidade: string
  readonly campus: string | null
  readonly cidade: string | null
  readonly estado: string
  readonly grau: string | null
  readonly turno: string | null
}

export interface SisuAnalysis {
  readonly curso: CursoEncontrado | null
  readonly pesos: PesosSisu | null
  readonly notaCorte: number | null
  readonly candidatos: number | null
  readonly vagas: number | null
  readonly nomeModalidade: string
  readonly notaPonderadaAtual: number | null
  readonly gap: number | null // nota_atual - nota_corte (negativo = falta)
  readonly roiPorArea: ReadonlyArray<RoiArea>
  readonly anoReferencia: number | null
}

// ============ 5. CENÁRIOS ============

export interface Cenario {
  readonly nome: string
  readonly descricao: string
  readonly incrementoPorArea: Readonly<Record<string, number>> // sigla → pontos
  readonly notaFinalEstimada: number
  readonly gapEstimado: number // negativo = ainda falta
}

export interface Cenarios {
  readonly otimista: Cenario
  readonly moderado: Cenario
  readonly conservador: Cenario
}

// ============ 6. PERFIL DE APROVADOS ============

export interface PerfilAprovados {
  readonly ano: number
  readonly totalAprovados: number
  readonly notaMedia: number
  readonly notaMinima: number
  readonly notaMaxima: number
  readonly notaMediana: number // P50
  readonly notaP25: number
  readonly notaP75: number
  readonly modalidade: string
}

// ============ 7. BENCHMARK ESCOLA ============

export interface BenchmarkEscola {
  readonly codigoInep: string
  readonly nomeEscola: string
  readonly ano: number
  readonly mediaCN: number | null
  readonly mediaCH: number | null
  readonly mediaLC: number | null
  readonly mediaMT: number | null
  readonly mediaRedacao: number | null
  readonly rankingNacional: number | null
  readonly rankingUF: number | null
  readonly desempenhoHabilidades: ReadonlyArray<{
    readonly area: string
    readonly numeroHabilidade: number
    readonly desempenho: number // % de acerto
  }>
}

// ============ 8. QUESTÕES RECOMENDADAS ============

export interface QuestaoRecomendada {
  readonly coItem: number
  readonly ano: number
  readonly area: AreaSigla
  readonly habilidade: number
  readonly matchedTopicLabel: string | null
  readonly selectionSource: 'same_topic' | 'same_skill' | 'area_fallback'
  readonly sourceExam: string | null
  readonly sourceExamUsed: string | null
  readonly dificuldade: number
  readonly discriminacao: number
  readonly linkImagem: string | null
  readonly gabarito: string | null // A, B, C, D ou E
  readonly posicaoCaderno: number | null // posição no caderno azul (Q1-Q45)
  readonly enunciado: string | null // stem da questão
  readonly textoApoio: string | null // support_text
  readonly alternativas: ReadonlyArray<{
    readonly letra: string // A, B, C, D, E
    readonly texto: string // texto da alternativa
  }> | null
  readonly imagemUrl: string | null // image_url da questão (se tiver imagem incorporada)
  readonly requiresVisualContext: boolean
  readonly resolutionStatus: 'resolved'
  readonly wasSubstituted: boolean
}

export type PedagogicalLabelSource = 'question_topic' | 'skill_map'

export interface HabilidadeCritica {
  readonly area: AreaSigla
  readonly numeroHabilidade: number
  readonly identificador: string
  readonly pedagogicalLabel: string
  readonly pedagogicalLabelSource: PedagogicalLabelSource
  readonly totalErros: number
  readonly percentualIncidencia: number
  readonly score: number // erros * incidência — prioridade
  readonly questoesRecomendadas: ReadonlyArray<QuestaoRecomendada>
}

export interface QuestoesRecomendadas {
  readonly habilidadesCriticas: ReadonlyArray<HabilidadeCritica>
}

// ============ REPORT DATA (output principal) ============

export interface ReportData {
  readonly mapaHabilidades: MapaHabilidades
  readonly parametrosTRI: ParametrosTRI
  readonly incidenciaHistorica: IncidenciaHistorica
  readonly sisuAnalysis: SisuAnalysis
  readonly cenarios: Cenarios | null // null se SISU não encontrou curso
  readonly perfilAprovados: PerfilAprovados | null
  readonly benchmarkEscola: BenchmarkEscola | null
  readonly questoesRecomendadas: QuestoesRecomendadas
  readonly computedAt: string // ISO timestamp
}
