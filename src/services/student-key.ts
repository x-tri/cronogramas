function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
}

export function normalizeStudentIdentifier(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (/^\d+$/.test(trimmed)) {
    return trimmed.replace(/^0+/, '') || '0'
  }

  return trimmed
}

export function buildStudentKey(params: {
  matricula?: string | null
  studentId?: string | null
  isAvulso?: boolean
}): string {
  if (params.isAvulso && params.studentId && isUuid(params.studentId)) {
    return `avulso:${params.studentId}`
  }

  if (params.matricula) {
    return normalizeStudentIdentifier(params.matricula)
  }

  if (params.studentId) {
    return normalizeStudentIdentifier(params.studentId)
  }

  throw new Error('Nao foi possivel montar a chave canonica do aluno.')
}

export function parseStudentKey(studentKey: string): {
  kind: 'avulso' | 'matricula'
  value: string
} {
  if (studentKey.startsWith('avulso:')) {
    return {
      kind: 'avulso',
      value: studentKey.slice('avulso:'.length),
    }
  }

  return {
    kind: 'matricula',
    value: studentKey,
  }
}

export function buildStudentNumberCandidates(studentKey: string): string[] {
  const parsed = parseStudentKey(studentKey)
  if (parsed.kind === 'avulso') return []

  const normalized = normalizeStudentIdentifier(parsed.value)
  return [...new Set([parsed.value, normalized].filter(Boolean))]
}
