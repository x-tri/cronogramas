// ============ ENUMS & CONSTANTS AS TYPES ============

export const DIAS_SEMANA = [
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
  'domingo',
] as const

export type DiaSemana = (typeof DIAS_SEMANA)[number]

export const DIAS_SEMANA_LABELS: Record<DiaSemana, string> = {
  segunda: 'Segunda',
  terca: 'Terça',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
  sabado: 'Sábado',
  domingo: 'Domingo',
}

export const TURNOS = ['manha', 'tarde', 'noite'] as const
export type Turno = (typeof TURNOS)[number]

export const TURNO_LABELS: Record<Turno, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
}

export const AREAS_ENEM = [
  'natureza',
  'matematica',
  'linguagens',
  'humanas',
  'outros',
] as const
export type AreaEnem = (typeof AREAS_ENEM)[number]

export const TIPOS_BLOCO = [
  'aula_oficial',
  'estudo',
  'simulado',
  'revisao',
  'descanso',
  'rotina',
  'foco',
  'bloqueado',
] as const
export type TipoBloco = (typeof TIPOS_BLOCO)[number]

export const TIPO_BLOCO_LABELS: Record<TipoBloco, string> = {
  aula_oficial: 'Aula Oficial',
  estudo: 'Estudo',
  simulado: 'Simulado',
  revisao: 'Revisão',
  descanso: 'Descanso',
  rotina: 'Rotina',
  foco: 'Foco',
  bloqueado: 'Bloqueado',
}

export const PRIORIDADES = [0, 1, 2] as const
export type Prioridade = (typeof PRIORIDADES)[number]

export const PRIORIDADE_LABELS: Record<Prioridade, string> = {
  0: 'Normal',
  1: 'Alta',
  2: 'Urgente',
}

// ============ TIME TYPES ============

export type TimeSlot = {
  inicio: string // HH:mm format
  fim: string
}

export type TurnoConfig = {
  label: string
  inicio: string
  fim: string
  slots: TimeSlot[]
}

export type DiaConfig = {
  temAula: boolean
  temVespertino?: boolean
  livre?: boolean
}

// ============ DATABASE ENTITIES ============

export const ESCOLAS = ['MARISTA', 'XTRI'] as const
export type Escola = string

export const ESCOLA_LABELS: Record<string, string> = {
  MARISTA: 'Colégio Marista de Natal',
  XTRI: 'Escola XTRI',
}

export type Aluno = {
  id: string
  matricula: string
  nome: string
  turma: string
  email: string | null
  escola: Escola
  escolaNome?: string | null
  fotoFilename: string | null
  createdAt: Date
}

export type Disciplina = {
  id: string
  codigo: string
  nome: string
  professor: string | null
  area: AreaEnem
  cor: string
}

export type HorarioOficial = {
  id: string
  turma: string
  diaSemana: DiaSemana
  horarioInicio: string
  horarioFim: string
  disciplina: string
  professor: string | null
  turno: Turno
}

export type Cronograma = {
  id: string
  alunoId: string
  semanaInicio: Date
  semanaFim: Date
  observacoes: string | null
  createdAt: Date
  updatedAt: Date
  status: 'ativo' | 'arquivado'
}

export type BlocoCronograma = {
  id: string
  cronogramaId: string
  diaSemana: DiaSemana
  horarioInicio: string
  horarioFim: string
  turno: Turno
  tipo: TipoBloco
  titulo: string
  descricao: string | null
  disciplinaCodigo: string | null
  cor: string | null
  prioridade: Prioridade
  concluido: boolean
  createdAt: Date
}

// ============ UI/STATE TYPES ============

export type CellPosition = {
  dia: DiaSemana
  turno: Turno
  slotIndex?: number
}

export type DragData = {
  blockId: string
  sourcePosition: CellPosition
}

export type BlockFormData = {
  tipo: TipoBloco
  titulo: string
  descricao: string
  disciplinaCodigo: string | null
  prioridade: Prioridade
  horarioInicio: string
  horarioFim: string
}
