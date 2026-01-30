import type {
  Aluno,
  BlocoCronograma,
  Cronograma,
  Disciplina,
  HorarioOficial,
} from '../types/domain'

export type StudentRepository = {
  findByMatricula: (matricula: string) => Promise<Aluno | null>
  findByTurma: (turma: string) => Promise<Aluno[]>
}

export type ScheduleRepository = {
  getOfficialSchedule: (turma: string) => Promise<HorarioOficial[]>
}

export type CronogramaRepository = {
  getCronograma: (alunoId: string, weekStart?: Date) => Promise<Cronograma | null>
  getAllCronogramas: (alunoId: string) => Promise<Cronograma[]>
  saveCronograma: (
    cronograma: Omit<Cronograma, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<Cronograma>
  updateCronograma: (
    id: string,
    updates: Partial<Cronograma>
  ) => Promise<Cronograma>
}

export type BlocoRepository = {
  getBlocos: (cronogramaId: string) => Promise<BlocoCronograma[]>
  createBloco: (
    bloco: Omit<BlocoCronograma, 'id' | 'createdAt'>
  ) => Promise<BlocoCronograma>
  updateBloco: (
    id: string,
    updates: Partial<BlocoCronograma>
  ) => Promise<BlocoCronograma>
  deleteBloco: (id: string) => Promise<void>
}

export type SubjectRepository = {
  getAllSubjects: () => Promise<Disciplina[]>
  getSubjectByCode: (codigo: string) => Promise<Disciplina | null>
}

export type DataRepository = {
  students: StudentRepository
  schedules: ScheduleRepository
  cronogramas: CronogramaRepository
  blocos: BlocoRepository
  subjects: SubjectRepository
}
