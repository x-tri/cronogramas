export interface RoiArea {
  sigla: string;
  area: string;
  peso: number;
  pesoNormalizado: number;
  valorPontoFinal: number;
}

export interface HabilidadeCritica {
  area: string;
  identificador: string;
  pedagogicalLabel: string;
  score: number;
  totalErros: number;
  percentualIncidencia: number;
  questoesRecomendadas: QuestaoRecomendada[];
}

export interface QuestaoRecomendada {
  sourceExam: string;
  enunciado: string;
  textoApoio?: string;
  alternativas: { letra: string; texto: string }[];
  gabarito: string;
  linkImagem?: string;
  imagemUrl?: string;
  matchedTopicLabel?: string;
}

export interface CenarioData {
  nome: string;
  descricao: string;
  notaFinalEstimada: number;
  gapEstimado: number;
  incrementoPorArea: Record<string, number>;
}

export interface PerfilAprovados {
  totalAprovados: number;
  notaMinima: number;
  notaP25: number;
  notaMediana: number;
  notaMedia?: number;
  notaP75: number;
  notaMaxima: number;
  ano: number;
  modalidade: string;
}

export interface Desperdicio {
  area: string;
  questionNumber: number;
  classificacao: string;
}

export interface ReportData {
  sisuAnalysis?: {
    notaPonderadaAtual: number;
    notaCorte: number;
    gap: number;
    curso?: { nome: string; universidade: string };
    roiPorArea?: RoiArea[];
  };
  mapaHabilidades?: {
    totalQuestoesErradas: number;
  };
  parametrosTRI?: {
    totalDesperdicios: number;
    desperdicios?: Desperdicio[];
  };
  questoesRecomendadas?: {
    habilidadesCriticas?: HabilidadeCritica[];
  };
  cenarios?: {
    otimista?: CenarioData;
    moderado?: CenarioData;
    conservador?: CenarioData;
  };
  perfilAprovados?: PerfilAprovados;
}

export const AREA_COLORS: Record<string, string> = {
  LC: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  CH: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  CN: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  MT: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  RED: "bg-red-500/15 text-red-600 border-red-500/30",
};
