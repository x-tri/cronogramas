export type EnemPlanArea = 'lc' | 'ch' | 'cn' | 'mt'

export type EnemWeightedTopic = {
  area: EnemPlanArea
  label: string
  percentage: number
  aliases: string[]
}

export const ENEM_HISTORICAL_TOPIC_WEIGHTS: EnemWeightedTopic[] = [
  {
    area: 'lc',
    label: 'Competência leitora',
    percentage: 46.23,
    aliases: ['competencia leitora', 'interpretacao de texto', 'leitura', 'compreensao textual'],
  },
  {
    area: 'lc',
    label: 'Apreensão de sentido',
    percentage: 11.27,
    aliases: ['apreensao de sentido', 'sentido do texto', 'efeitos de sentido'],
  },
  {
    area: 'lc',
    label: 'Estruturas linguísticas e aspectos discursivos',
    percentage: 6.65,
    aliases: ['estruturas linguisticas', 'aspectos discursivos', 'gramatica', 'linguagem', 'generos textuais', 'tipologia textual', 'tipos textuais'],
  },
  {
    area: 'mt',
    label: 'Proporcionalidade direta e indireta',
    percentage: 14.8,
    aliases: ['porcentagem', 'proporcionalidade', 'regra de tres', 'escala', 'razao e proporcao'],
  },
  {
    area: 'mt',
    label: 'Estatística',
    percentage: 12.61,
    aliases: ['estatistica', 'interpretacao de graficos', 'graficos', 'tabelas', 'media', 'mediana'],
  },
  {
    area: 'mt',
    label: 'Geometria plana',
    percentage: 7.37,
    aliases: ['geometria plana', 'area', 'perimetro', 'poligonos'],
  },
  {
    area: 'mt',
    label: 'Geometria espacial',
    percentage: 6.57,
    aliases: ['geometria espacial', 'volume', 'prismas', 'cilindros'],
  },
  {
    area: 'mt',
    label: 'Probabilidade',
    percentage: 5.51,
    aliases: ['probabilidade', 'analise combinatoria'],
  },
  {
    area: 'mt',
    label: 'Funções',
    percentage: 5.37,
    aliases: ['funcoes', 'funcao afim', 'funcao quadratica', 'grafico de funcao'],
  },
  {
    area: 'ch',
    label: 'Urbanização',
    percentage: 6.79,
    aliases: ['urbanizacao', 'espaco urbano', 'cidades'],
  },
  {
    area: 'ch',
    label: 'Agropecuária',
    percentage: 6.39,
    aliases: ['agropecuaria', 'agricultura', 'pecuaria'],
  },
  {
    area: 'ch',
    label: 'Ruralidade',
    percentage: 5.19,
    aliases: ['ruralidade', 'espaco rural', 'questao agraria'],
  },
  {
    area: 'ch',
    label: 'Desenvolvimento econômico',
    percentage: 4.79,
    aliases: ['desenvolvimento economico', 'industrializacao', 'globalizacao economica'],
  },
  {
    area: 'ch',
    label: 'Geopolítica e relações internacionais',
    percentage: 4.19,
    aliases: ['geopolitica', 'relacoes internacionais', 'ordem mundial', 'blocos economicos'],
  },
  {
    area: 'ch',
    label: 'Brasil colonial',
    percentage: 8.95,
    aliases: ['brasil colonial', 'colonia', 'periodo colonial'],
  },
  {
    area: 'ch',
    label: 'Primeira República',
    percentage: 6.03,
    aliases: ['primeira republica', 'republica velha'],
  },
  {
    area: 'ch',
    label: 'Era Vargas',
    percentage: 5.06,
    aliases: ['era vargas', 'getulio vargas'],
  },
  {
    area: 'ch',
    label: 'Direito, cidadania e movimentos sociais',
    percentage: 20.25,
    aliases: [
      'direito',
      'cidadania',
      'movimentos sociais',
      'violencia contra a mulher',
      'feminismo',
      'participacao social'
    ],
  },
  {
    area: 'ch',
    label: 'Cultura e sociedade',
    percentage: 11.39,
    aliases: ['cultura e sociedade', 'cultura', 'sociedade'],
  },
  {
    area: 'ch',
    label: 'Identidade e diversidade',
    percentage: 10.55,
    aliases: ['identidade e diversidade', 'diversidade', 'genero', 'desigualdade de genero'],
  },
  {
    area: 'ch',
    label: 'Política e Estado',
    percentage: 9.7,
    aliases: ['politica e estado', 'estado', 'democracia', 'poder'],
  },
  {
    area: 'ch',
    label: 'Trabalho e sociedade',
    percentage: 8.86,
    aliases: ['trabalho e sociedade', 'trabalho', 'mundo do trabalho'],
  },
  {
    area: 'ch',
    label: 'Desigualdade',
    percentage: 4.64,
    aliases: ['desigualdade', 'desigualdade social'],
  },
  {
    area: 'ch',
    label: 'Violência',
    percentage: 2.95,
    aliases: ['violencia', 'violencia urbana'],
  },
  {
    area: 'ch',
    label: 'Filosofia política',
    percentage: 12.77,
    aliases: ['filosofia politica', 'contratualismo', 'poder politico'],
  },
  {
    area: 'ch',
    label: 'Moral e ética',
    percentage: 7.98,
    aliases: ['moral e etica', 'etica', 'moral'],
  },
  {
    area: 'cn',
    label: 'Desequilíbrio em ecossistemas',
    percentage: 11.62,
    aliases: ['desequilibrio em ecossistemas', 'ecologia', 'impactos ambientais', 'ecossistemas'],
  },
  {
    area: 'cn',
    label: 'Viroses',
    percentage: 4.17,
    aliases: ['viroses', 'virus'],
  },
  {
    area: 'cn',
    label: 'DNA e genética',
    percentage: 3.99,
    aliases: ['dna', 'genetica', 'hereditariedade'],
  },
  {
    area: 'cn',
    label: 'Bioquímica',
    percentage: 3.27,
    aliases: ['bioquimica', 'metabolismo'],
  },
  {
    area: 'cn',
    label: 'Biologia celular',
    percentage: 3.27,
    aliases: ['biologia celular', 'celula'],
  },
  {
    area: 'cn',
    label: 'Fisiologia animal e humana',
    percentage: 3.1,
    aliases: ['fisiologia animal e humana', 'fisiologia humana', 'sistemas do corpo'],
  },
  {
    area: 'cn',
    label: 'Calorimetria',
    percentage: 7.47,
    aliases: ['calorimetria', 'calor'],
  },
  {
    area: 'cn',
    label: 'Circuitos elétricos',
    percentage: 6.64,
    aliases: ['circuitos eletricos', 'eletricidade', 'resistores'],
  },
  {
    area: 'cn',
    label: 'Termodinâmica',
    percentage: 4.98,
    aliases: ['termodinamica'],
  },
  {
    area: 'cn',
    label: 'Forças e movimento',
    percentage: 4.98,
    aliases: ['forcas e movimento', 'dinamica', 'cinematica'],
  },
  {
    area: 'cn',
    label: 'Funções orgânicas',
    percentage: 6.01,
    aliases: ['funcoes organicas', 'compostos organicos', 'quimica organica'],
  },
  {
    area: 'cn',
    label: 'Reações orgânicas',
    percentage: 4.67,
    aliases: ['reacoes organicas'],
  },
  {
    area: 'cn',
    label: 'Cinética química',
    percentage: 4.17,
    aliases: ['cinetica quimica', 'velocidade das reacoes'],
  },
]
