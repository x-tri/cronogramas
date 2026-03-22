export interface SubjectTopic {
  label: string;
}

export interface Subject {
  label: string;
  topics: SubjectTopic[];
}

export interface SubjectArea {
  label: string;
  subjects: Subject[];
}

export const EXTRA_ACTIVITIES = [
  "Fazer Simulado",
  "Corrigir Simulado",
  "Retomar Erros",
  "Lista de Exercícios",
];

export const ENEM_AREAS: SubjectArea[] = [
  {
    label: "Linguagens",
    subjects: [
      {
        label: "Português",
        topics: [
          { label: "Interpretação de textos" },
          { label: "Literatura" },
          { label: "Gramática" },
          { label: "Estilística" },
          { label: "Variações linguísticas" },
          { label: "Teoria da comunicação" },
        ],
      },
      {
        label: "Arte",
        topics: [
          { label: "Expressões da arte" },
          { label: "História da arte" },
          { label: "Arte contemporânea" },
          { label: "Matrizes culturais" },
          { label: "Arte do Brasil" },
        ],
      },
      {
        label: "Inglês",
        topics: [
          { label: "Text comprehension" },
        ],
      },
      {
        label: "Espanhol",
        topics: [
          { label: "Interpretación de textos" },
          { label: "Vocabulario" },
          { label: "Gramática" },
        ],
      },
      {
        label: "Redação",
        topics: [
          { label: "Treino de redação" },
        ],
      },
    ],
  },
  {
    label: "Ciências Humanas",
    subjects: [
      {
        label: "História",
        topics: [
          { label: "Brasil" },
          { label: "Geral" },
          { label: "Temática" },
          { label: "América" },
        ],
      },
      {
        label: "Geografia",
        topics: [
          { label: "Econômica" },
          { label: "Física" },
          { label: "Geopolítica" },
          { label: "Humana" },
          { label: "Questões ambientais" },
          { label: "Regional" },
        ],
      },
      {
        label: "Filosofia",
        topics: [
          { label: "Filosofia política" },
          { label: "Ética" },
          { label: "Teoria do conhecimento" },
          { label: "Filosofia moderna" },
          { label: "Filosofia antiga" },
          { label: "Filosofia contemporânea" },
          { label: "Filosofia medieval" },
        ],
      },
      {
        label: "Sociologia",
        topics: [
          { label: "Diversidade cultural e estratificação social" },
          { label: "Poder, Estado e política" },
          { label: "Teoria sociológica" },
          { label: "Trabalho e produção" },
          { label: "Movimentos sociais" },
        ],
      },
    ],
  },
  {
    label: "Matemática",
    subjects: [
      {
        label: "Matemática",
        topics: [
          { label: "Grandezas proporcionais" },
          { label: "Geometria espacial" },
          { label: "Funções" },
          { label: "Geometria plana" },
          { label: "Estatística" },
          { label: "Probabilidades" },
          { label: "Aritmética" },
          { label: "Análise combinatória" },
          { label: "Médias" },
          { label: "Trigonometria" },
          { label: "Geometria analítica" },
          { label: "Progressão aritmética" },
          { label: "Inequações" },
          { label: "Logaritmos" },
        ],
      },
    ],
  },
  {
    label: "Ciências da Natureza",
    subjects: [
      {
        label: "Física",
        topics: [
          { label: "Mecânica" },
          { label: "Eletricidade" },
          { label: "Ondulatória" },
          { label: "Termologia" },
          { label: "Óptica" },
          { label: "Magnetismo" },
        ],
      },
      {
        label: "Química",
        topics: [
          { label: "Físico-química" },
          { label: "Química Geral" },
          { label: "Orgânica" },
          { label: "Atomística" },
          { label: "Meio ambiente" },
          { label: "Bioquímica" },
        ],
      },
      {
        label: "Biologia",
        topics: [
          { label: "Ecologia" },
          { label: "Fisiologia animal e humana" },
          { label: "Genética" },
          { label: "Citologia" },
          { label: "Reino vegetal / fungos" },
          { label: "Reino animal" },
          { label: "Parasitologia" },
          { label: "Evolução biológica" },
          { label: "Histologia" },
        ],
      },
    ],
  },
];
