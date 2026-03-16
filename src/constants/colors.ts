import type { AreaEnem, TipoBloco } from '../types/domain'

export const CORES_AREAS: Record<AreaEnem, string> = {
  natureza: '#10B981', // Verde - Ciências da Natureza
  matematica: '#EF4444', // Vermelho - Matemática
  linguagens: '#3B82F6', // Azul - Linguagens
  humanas: '#F97316', // Laranja - Humanas (diferente do amarelo de revisão)
  outros: '#8B5CF6', // Roxo - Outros
}

export const CORES_TIPOS: Record<TipoBloco, string> = {
  aula_oficial: '#6B7280', // Cinza - Não editável
  estudo: '#3B82F6', // Azul
  simulado: '#EF4444', // Vermelho
  revisao: '#F59E0B', // Amarelo
  bloqueio: '#DC2626', // Vermelho forte - Horário bloqueado
  descanso: '#10B981', // Verde
  rotina: '#8B5CF6', // Roxo
  foco: '#EC4899', // Rosa - Foco especial
}

export const CORES_PRIORIDADE: Record<number, string> = {
  0: '#6B7280', // Normal - Cinza
  1: '#F59E0B', // Alta - Amarelo
  2: '#EF4444', // Urgente - Vermelho
}

export function getBlockColor(
  tipo: TipoBloco,
  disciplinaArea?: AreaEnem | null,
  customCor?: string | null
): string {
  if (customCor) return customCor
  if (tipo === 'estudo' && disciplinaArea) return CORES_AREAS[disciplinaArea]
  return CORES_TIPOS[tipo]
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Detect area from ENEM question number
// Q1-45: Linguagens | Q46-90: Humanas | Q91-135: Natureza | Q136-180: Matemática
export function getAreaFromQuestionNumber(questionNumber: number): AreaEnem {
  if (questionNumber >= 1 && questionNumber <= 45) return 'linguagens'
  if (questionNumber >= 46 && questionNumber <= 90) return 'humanas'
  if (questionNumber >= 91 && questionNumber <= 135) return 'natureza'
  if (questionNumber >= 136 && questionNumber <= 180) return 'matematica'
  return 'outros'
}

export function getColorFromQuestionNumber(questionNumber: number): string {
  const area = getAreaFromQuestionNumber(questionNumber)
  return CORES_AREAS[area]
}

// Keywords to detect knowledge area from block title
const AREA_KEYWORDS: Record<AreaEnem, string[]> = {
  linguagens: [
    'português', 'portuguesa', 'literatura', 'redação', 'texto', 'interpretação',
    'gênero', 'textual', 'arte', 'inglês', 'espanhol', 'linguagem', 'linguística',
    'variação', 'argumentativ', 'modernismo', 'romantismo', 'parnasianismo',
    'maneirismo', 'barroco', 'arcadismo', 'realismo', 'naturalismo',
  ],
  humanas: [
    // Disciplinas principais
    'história', 'historia', 'geografia', 'geografia', 'filosofia', 'filosofia', 
    'sociologia', 'sociologia', 'atualidades',
    // Geopolítica e política
    'geopolítica', 'geopolitica', 'política', 'politica', 'politico', 'político',
    'diplomacia', 'relações internacionais', 'relacoes internacionais',
    // Sistemas econômicos e sociais
    'capitalismo', 'socialismo', 'comunismo', 'neoliberalismo', 'globalização', 
    'globalizacao', 'mercantilismo', 'feudalismo', 'escravismo',
    // Conflitos e movimentos
    'guerra', 'guerras', 'revolução', 'revolucao', 'revoluções', 'revolucoes',
    'independência', 'independencia', 'emancipação', 'emancipacao',
    // Períodos históricos - Brasil
    'colonização', 'colonizacao', 'brasil colônia', 'brasil colonia', 
    'brasil colônia', 'brasil colonia', 'período colonial', 'periodo colonial',
    'quatrocentão', 'quilombos', 'quilombo', 'bandeirantes', 'bandeirantismo',
    'escravidão', 'escravidao', 'tráfico negreiro', 'trafico negreiro',
    'invasões holandesas', 'invasoes holandesas', 'mineração', 'mineracao',
    'ciclo do ouro', 'ciclo do café', 'ciclo da borracha', 'ciclo do açúcar',
    'império', 'imperio', 'primeiro reinado', 'regência', 'regencias',
    'segundo reinado', 'república', 'republica', 'república velha', 
    'república velha', 'era vargas', 'estado novo', 'ditadura', 'ditadura militar',
    'redemocratização', 'redemocratizacao', 'nova república', 'nova republica',
    // Períodos históricos - Geral
    'pré-história', 'pre-historia', 'antiguidade', 'egito', 'mesopotâmia',
    'mesopotamia', 'grécia', 'grecia', 'roma', 'império romano', 'imperio romano',
    'idade média', 'idade media', 'feudalismo', 'renascimento', 'reforma',
    'protestante', 'absolutismo', 'iluminismo', 'revolução francesa',
    'revolucao francesa', 'revolução industrial', 'revolucao industrial',
    'nazismo', 'fascismo', 'bolchevique', 'revolução russa', 'revolucao russa',
    'guerra fria', 'descolonização', 'descolonizacao',
    // Sistema político
    'democracia', 'democracia', 'cidadania', 'cidadania', 'constituição',
    'constituicao', 'direitos humanos', 'direitos fundamentais', 'estado',
    'governo', 'poder executivo', 'poder legislativo', 'poder judiciário',
    'poder judiciario', 'partidos políticos', 'sistema eleitoral',
    // Geografia
    'meio ambiente', 'meio-ambiente', 'ecossistema', 'bioma', 'vegetação',
    'vegetacao', 'relevo', 'clima', 'hidrografia', 'latitude', 'longitude',
    'coordenadas geográficas', 'projeções cartográficas', 'escala',
    'urbanização', 'urbanizacao', 'metropolização', 'conurbação', 'conurbacao',
    'população', 'populacao', 'demografia', 'taxa de natalidade', 'migração',
    'migracao', 'imigração', 'imigracao', 'emigração', 'emigracao',
    'divisão territorial', 'divisao territorial', 'regiões brasileiras',
    'regioes brasileiras', 'amazônia', 'amazonia', 'cerrado', 'mata atlântica',
    'pampa', 'pantanal', 'caatinga', 'indústria', 'industria', 'agropecuária',
    'agropecuaria', 'comércio', 'comercio', 'transporte', 'globalização',
    // Sociologia
    'cultura', 'indivíduo', 'individuo', 'sociedade', 'estrutura social',
    'estratificação', 'movimentos sociais', 'conflito social', 'desigualdade',
    'etnia', 'gênero', 'identidade', 'modernidade', 'pós-modernidade',
  ],
  natureza: [
    'física', 'química', 'biologia', 'genética', 'ecologia', 'evolução',
    'célula', 'citologia', 'fisiologia', 'botânica', 'zoologia', 'anatomia',
    'termodinâmica', 'óptica', 'ondulatória', 'eletricidade', 'magnetismo',
    'cinemática', 'dinâmica', 'estática', 'hidrostática', 'calorimetria',
    'reação', 'reações', 'ácido', 'base', 'sal', 'óxido', 'orgânica',
    'inorgânica', 'estequiometria', 'mol', 'concentração', 'titulação',
    'eletroquímica', 'oxiredução', 'cinética', 'equilíbrio', 'ph',
    'circuito', 'potência', 'eletrodinâmica', 'impulso', 'movimento',
    'compostos', 'fármacos', 'protozoário', 'endócrino', 'sistema',
  ],
  matematica: [
    'matemática', 'geometria', 'álgebra', 'estatística', 'probabilidade',
    'função', 'funções', 'equação', 'inequação', 'polinômio', 'matriz',
    'determinante', 'progressão', 'sequência', 'logaritmo', 'exponencial',
    'trigonometria', 'combinatória', 'análise combinatória', 'porcentagem',
    'juros', 'razão', 'proporção', 'grandezas', 'escala', 'gráfico',
    'aritmética', 'plana', 'espacial', 'analítica', 'projeção', 'área',
  ],
  outros: [],
}

export function detectAreaFromTitle(title: string): AreaEnem | null {
  // Normaliza o título: minúsculas, remove acentos extras de forma simples
  const normalizedTitle = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
    if (area === 'outros') continue
    for (const keyword of keywords) {
      // Normaliza a keyword também para comparação consistente
      const normalizedKeyword = keyword
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      
      if (normalizedTitle.includes(normalizedKeyword)) {
        return area as AreaEnem
      }
    }
  }

  return null
}

export function getBlockColorWithAutoDetect(
  tipo: TipoBloco,
  titulo: string,
  disciplinaArea?: AreaEnem | null,
  customCor?: string | null
): string {
  // For study and revision blocks, prioritize auto-detection by area
  if (tipo === 'estudo' || tipo === 'revisao') {
    // First check explicit disciplinaArea
    if (disciplinaArea) return CORES_AREAS[disciplinaArea]

    // Then try to detect area from title keywords
    const detectedArea = detectAreaFromTitle(titulo)
    if (detectedArea) return CORES_AREAS[detectedArea]

    // Fall back to custom color if set
    if (customCor) return customCor
  }

  // For other block types, use custom color if set
  if (customCor) return customCor

  return CORES_TIPOS[tipo]
}
