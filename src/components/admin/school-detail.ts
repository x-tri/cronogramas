// Lógica pura do modal de detalhes da escola (Saúde das Escolas).

export interface SchoolStudentRow {
  readonly id: string
  readonly matricula: string
  readonly name: string | null
  readonly turma: string | null
}

export interface CronogramaRow {
  readonly aluno_id: string
  readonly updated_at: string
}

export interface Atendimento {
  readonly matricula: string
  readonly nome: string
  readonly turma: string
  readonly ultimoCronograma: string
}

/**
 * Cruza alunos da escola com cronogramas: só quem TEM cronograma é
 * atendimento, com a data do mais recente, ordenado do mais novo para o
 * mais antigo.
 */
export function buildAtendimentos(
  students: ReadonlyArray<SchoolStudentRow>,
  cronogramas: ReadonlyArray<CronogramaRow>,
): Atendimento[] {
  const latestByAluno = new Map<string, string>()
  for (const c of cronogramas) {
    const current = latestByAluno.get(c.aluno_id)
    if (!current || c.updated_at > current) {
      latestByAluno.set(c.aluno_id, c.updated_at)
    }
  }

  return students
    .map((s) => {
      const ultimoCronograma = latestByAluno.get(s.id) ?? latestByAluno.get(s.matricula)
      if (!ultimoCronograma) return null

      return {
        matricula: s.matricula,
        nome: s.name ?? s.matricula,
        turma: s.turma ?? '-',
        ultimoCronograma,
      }
    })
    .filter((atendimento): atendimento is Atendimento => atendimento !== null)
    .sort((a, b) => b.ultimoCronograma.localeCompare(a.ultimoCronograma))
}
