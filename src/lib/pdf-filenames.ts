import type { Aluno } from '../types/domain'

function slugifyFilenamePart(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

function isoDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function shortDate(value: Date): string {
  return value.toLocaleDateString('pt-BR')
}

export function buildCronogramaPdfFilename(
  student: Pick<Aluno, 'nome' | 'matricula'>,
  weekStart: Date,
): string {
  const nome = slugifyFilenamePart(student.nome, 'aluno')
  const matricula = slugifyFilenamePart(student.matricula, 'sem-matricula')

  return `cronograma-${nome}-${matricula}-${isoDate(weekStart)}.pdf`
}

export function buildCronogramaPdfTitle(
  student: Pick<Aluno, 'nome' | 'matricula'>,
  weekStart: Date,
  weekEnd: Date,
): string {
  return `Cronograma de Estudos - ${student.nome} - ${shortDate(weekStart)} a ${shortDate(weekEnd)}`
}
