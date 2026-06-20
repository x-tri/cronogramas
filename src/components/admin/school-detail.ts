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

export interface MentorAttributionRow {
  readonly studentKey: string
  readonly mentorUserId: string | null
  readonly createdAt: string
  readonly mentorNome?: string | null
}

export interface MentorUserRow {
  readonly auth_uid: string | null
  readonly email: string | null
  readonly name: string | null
}

export interface Atendimento {
  readonly matricula: string
  readonly nome: string
  readonly turma: string
  readonly ultimoCronograma: string
  readonly mentorNome: string | null
}

function mentorDisplayName(user: MentorUserRow): string | null {
  const name = user.name?.trim()
  if (name) return name

  const email = user.email?.trim()
  if (!email) return null
  return email.split('@')[0] || email
}

export function buildMentorByStudent(
  attributions: ReadonlyArray<MentorAttributionRow>,
  mentorUsers: ReadonlyArray<MentorUserRow>,
): Map<string, string> {
  const mentorByUserId = new Map<string, string>()
  for (const user of mentorUsers) {
    if (!user.auth_uid) continue
    const displayName = mentorDisplayName(user)
    if (displayName) {
      mentorByUserId.set(user.auth_uid, displayName)
    }
  }

  const latestByStudent = new Map<string, { createdAt: string; mentorNome: string }>()
  for (const attribution of attributions) {
    const studentKey = attribution.studentKey.trim()
    const directName = attribution.mentorNome?.trim()
    const mentorNome =
      directName ||
      (attribution.mentorUserId ? mentorByUserId.get(attribution.mentorUserId) : null)
    if (!studentKey || !mentorNome) continue

    const current = latestByStudent.get(studentKey)
    if (!current || attribution.createdAt > current.createdAt) {
      latestByStudent.set(studentKey, {
        createdAt: attribution.createdAt,
        mentorNome,
      })
    }
  }

  return new Map(
    Array.from(latestByStudent.entries()).map(([studentKey, value]) => [
      studentKey,
      value.mentorNome,
    ]),
  )
}

/**
 * Cruza alunos da escola com cronogramas: só quem TEM cronograma é
 * atendimento, com a data do mais recente, ordenado do mais novo para o
 * mais antigo.
 */
export function buildAtendimentos(
  students: ReadonlyArray<SchoolStudentRow>,
  cronogramas: ReadonlyArray<CronogramaRow>,
  mentorByStudent: ReadonlyMap<string, string> = new Map(),
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
        mentorNome: mentorByStudent.get(s.id) ?? mentorByStudent.get(s.matricula) ?? null,
      }
    })
    .filter((atendimento): atendimento is Atendimento => atendimento !== null)
    .sort((a, b) => b.ultimoCronograma.localeCompare(a.ultimoCronograma))
}
