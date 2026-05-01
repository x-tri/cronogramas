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
  createAlunoXTRI: (aluno: Omit<Aluno, 'id' | 'createdAt' | 'escola'>) => Promise<Aluno>
}

export type ScheduleRepository = {
  /**
   * Carrega a grade oficial de uma turma.
   *
   * @param turma  Identificador da turma como salvo em `students.turma`
   *               (ex: 'A' para Marista; 'Turma 300' para Dom Bosco).
   * @param schoolId  Opcional. Quando fornecido, busca em `school_schedules`
   *                  filtrando por escola. Quando omitido, faz fallback no
   *                  mock por turma (legado Marista). Permite que escolas
   *                  com turmas homonimas (ex: 'A') nao colidam.
   * @param anoLetivo Opcional, default 2026.
   */
  getOfficialSchedule: (
    turma: string,
    schoolId?: string | null,
    anoLetivo?: number,
  ) => Promise<HorarioOficial[]>
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
  deleteCronograma: (id: string) => Promise<void>
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
