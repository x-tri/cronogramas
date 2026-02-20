import type {
  Cronograma,
  BlocoCronograma,
  Aluno,
  DiaSemana,
  Turno,
  TipoBloco,
  Prioridade,
} from './domain'

// ============ ROW TYPES (snake_case - como vem do banco) ============

export type CronogramaRow = {
  id: string
  aluno_id: string
  semana_inicio: string
  semana_fim: string
  observacoes: string | null
  status: 'ativo' | 'arquivado'
  created_at: string
  updated_at: string
}

export type BlocoCronogramaRow = {
  id: string
  cronograma_id: string
  dia_semana: string
  horario_inicio: string
  horario_fim: string
  turno: string
  tipo: string
  titulo: string
  descricao: string | null
  disciplina_codigo: string | null
  cor: string | null
  prioridade: number
  concluido: boolean
  created_at: string
}

export type AlunoXTRIRow = {
  id: string
  matricula: string
  nome: string
  turma: string
  email: string | null
  foto_filename: string | null
  created_at: string
}

// ============ CONVERSION FUNCTIONS ============

export function cronogramaFromRow(row: CronogramaRow): Cronograma {
  return {
    id: row.id,
    alunoId: row.aluno_id,
    semanaInicio: new Date(row.semana_inicio),
    semanaFim: new Date(row.semana_fim),
    observacoes: row.observacoes,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export function cronogramaToRow(
  cronograma: Omit<Cronograma, 'id' | 'createdAt' | 'updatedAt'>
): Omit<CronogramaRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    aluno_id: cronograma.alunoId,
    semana_inicio: cronograma.semanaInicio.toISOString().split('T')[0],
    semana_fim: cronograma.semanaFim.toISOString().split('T')[0],
    observacoes: cronograma.observacoes,
    status: cronograma.status,
  }
}

export function blocoFromRow(row: BlocoCronogramaRow): BlocoCronograma {
  return {
    id: row.id,
    cronogramaId: row.cronograma_id,
    diaSemana: row.dia_semana as DiaSemana,
    horarioInicio: row.horario_inicio,
    horarioFim: row.horario_fim,
    turno: row.turno as Turno,
    tipo: row.tipo as TipoBloco,
    titulo: row.titulo,
    descricao: row.descricao,
    disciplinaCodigo: row.disciplina_codigo,
    cor: row.cor,
    prioridade: row.prioridade as Prioridade,
    concluido: row.concluido,
    createdAt: new Date(row.created_at),
  }
}

export function blocoToRow(
  bloco: Omit<BlocoCronograma, 'id' | 'createdAt'>
): Omit<BlocoCronogramaRow, 'id' | 'created_at'> {
  return {
    cronograma_id: bloco.cronogramaId,
    dia_semana: bloco.diaSemana,
    horario_inicio: bloco.horarioInicio,
    horario_fim: bloco.horarioFim,
    turno: bloco.turno,
    tipo: bloco.tipo,
    titulo: bloco.titulo,
    descricao: bloco.descricao,
    disciplina_codigo: bloco.disciplinaCodigo,
    cor: bloco.cor,
    prioridade: bloco.prioridade,
    concluido: bloco.concluido,
  }
}

export function alunoXTRIFromRow(row: AlunoXTRIRow): Aluno {
  return {
    id: row.id,
    matricula: row.matricula,
    nome: row.nome,
    turma: row.turma,
    email: row.email,
    fotoFilename: row.foto_filename,
    escola: 'XTRI',
    createdAt: new Date(row.created_at),
  }
}

export function alunoXTRIToRow(
  aluno: Omit<Aluno, 'id' | 'createdAt' | 'escola'>
): Omit<AlunoXTRIRow, 'id' | 'created_at'> {
  return {
    matricula: aluno.matricula,
    nome: aluno.nome,
    turma: aluno.turma,
    email: aluno.email,
    foto_filename: aluno.fotoFilename,
  }
}

// ============ EXISTING TYPES ============

export type SupabaseStudent = {
  id: string
  matricula: string
  name: string
  turma: string
  sheet_code: string
  school_id: string
  school: {
    name: string
  }
}

export type StudentAnswer = {
  id: string
  exam_id: string
  student_number: string
  student_name: string | null
  turma: string | null
  answers: string[]
  score: number
  correct_answers: number
  wrong_answers: number
  blank_answers: number
  tri_score: number | null
  tri_lc: number | null
  tri_ch: number | null
  tri_cn: number | null
  tri_mt: number | null
  created_at: string
}

export type QuestionContent = {
  questionNumber: number
  answer: string
  content: string // tópico
}

export type Exam = {
  id: string
  title: string
  answer_key: string[]
  question_contents: QuestionContent[] | null
}

export type WrongQuestion = {
  questionNumber: number
  topic: string
  studentAnswer: string
  correctAnswer: string
}

export type SimuladoResult = {
  exam: Exam
  studentAnswer: StudentAnswer
  wrongQuestions: WrongQuestion[]
  topicsSummary: TopicSummary[]
}

export type TopicSummary = {
  topic: string
  count: number
  questions: number[]
}

// ============ TABELA PROJETOS (Gabaritos) ============

export type ProjetoRow = {
  id: string
  matricula: string
  nome_aluno: string | null
  turma: string | null
  simulado_nome: string | null
  questoes_erradas: number[] | null
  topicos_erros: Record<string, number> | null // { "Matemática": 5, "Física": 3 }
  total_acertos: number | null
  total_erros: number | null
  total_branco: number | null
  nota_lc: number | null
  nota_ch: number | null
  nota_cn: number | null
  nota_mt: number | null
  created_at: string
  updated_at: string
}

export type Projeto = {
  id: string
  matricula: string
  nomeAluno: string | null
  turma: string | null
  simuladoNome: string | null
  questoesErradas: number[]
  topicosErros: Record<string, number>
  totalAcertos: number
  totalErros: number
  totalBranco: number
  notaLC: number | null
  notaCH: number | null
  notaCN: number | null
  notaMT: number | null
  createdAt: Date
  updatedAt: Date
}

export function projetoFromRow(row: ProjetoRow): Projeto {
  return {
    id: row.id,
    matricula: row.matricula,
    nomeAluno: row.nome_aluno,
    turma: row.turma,
    simuladoNome: row.simulado_nome,
    questoesErradas: row.questoes_erradas ?? [],
    topicosErros: row.topicos_erros ?? {},
    totalAcertos: row.total_acertos ?? 0,
    totalErros: row.total_erros ?? 0,
    totalBranco: row.total_branco ?? 0,
    notaLC: row.nota_lc,
    notaCH: row.nota_ch,
    notaCN: row.nota_cn,
    notaMT: row.nota_mt,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}
