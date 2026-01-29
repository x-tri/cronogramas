import type { DiaSemana, HorarioOficial, Turno } from '../../types/domain'

// Example official schedule for turma A (3rd grade, morning classes)
// This would be loaded from the database in production
export const HORARIOS_OFICIAIS_A: HorarioOficial[] = [
  // Segunda - Manhã
  { id: '1', turma: 'A', diaSemana: 'segunda', horarioInicio: '07:15', horarioFim: '08:05', disciplina: 'Matemática 1', professor: 'EDUARDO JATOBÁ', turno: 'manha' },
  { id: '2', turma: 'A', diaSemana: 'segunda', horarioInicio: '08:05', horarioFim: '09:05', disciplina: 'Matemática 1', professor: 'EDUARDO JATOBÁ', turno: 'manha' },
  { id: '3', turma: 'A', diaSemana: 'segunda', horarioInicio: '09:05', horarioFim: '09:55', disciplina: 'Física 1', professor: 'CLAYBSON MOURA', turno: 'manha' },
  { id: '4', turma: 'A', diaSemana: 'segunda', horarioInicio: '09:55', horarioFim: '11:05', disciplina: 'Física 1', professor: 'CLAYBSON MOURA', turno: 'manha' },
  { id: '5', turma: 'A', diaSemana: 'segunda', horarioInicio: '11:05', horarioFim: '11:55', disciplina: 'Língua Portuguesa', professor: 'CARLOS LIMA', turno: 'manha' },
  { id: '6', turma: 'A', diaSemana: 'segunda', horarioInicio: '11:55', horarioFim: '12:45', disciplina: 'Língua Portuguesa', professor: 'CARLOS LIMA', turno: 'manha' },
  { id: '7', turma: 'A', diaSemana: 'segunda', horarioInicio: '12:45', horarioFim: '13:35', disciplina: 'História 1', professor: 'JOÃO MARIA', turno: 'manha' },

  // Terça - Manhã
  { id: '8', turma: 'A', diaSemana: 'terca', horarioInicio: '07:15', horarioFim: '08:05', disciplina: 'Química 1', professor: 'JUSSIE BEZERRA', turno: 'manha' },
  { id: '9', turma: 'A', diaSemana: 'terca', horarioInicio: '08:05', horarioFim: '09:05', disciplina: 'Química 1', professor: 'JUSSIE BEZERRA', turno: 'manha' },
  { id: '10', turma: 'A', diaSemana: 'terca', horarioInicio: '09:05', horarioFim: '09:55', disciplina: 'Biologia 1', professor: 'AUGUSTO', turno: 'manha' },
  { id: '11', turma: 'A', diaSemana: 'terca', horarioInicio: '09:55', horarioFim: '11:05', disciplina: 'Biologia 1', professor: 'AUGUSTO', turno: 'manha' },
  { id: '12', turma: 'A', diaSemana: 'terca', horarioInicio: '11:05', horarioFim: '11:55', disciplina: 'Geografia 1', professor: 'LÁZARO', turno: 'manha' },
  { id: '13', turma: 'A', diaSemana: 'terca', horarioInicio: '11:55', horarioFim: '12:45', disciplina: 'Geografia 1', professor: 'LÁZARO', turno: 'manha' },
  { id: '14', turma: 'A', diaSemana: 'terca', horarioInicio: '12:45', horarioFim: '13:35', disciplina: 'Inglês', professor: 'GUSTAVO', turno: 'manha' },

  // Terça - Tarde (vespertino)
  { id: '15', turma: 'A', diaSemana: 'terca', horarioInicio: '14:35', horarioFim: '15:25', disciplina: 'Matemática 2', professor: 'LEONADO ANSELMO', turno: 'tarde' },
  { id: '16', turma: 'A', diaSemana: 'terca', horarioInicio: '15:25', horarioFim: '16:15', disciplina: 'Matemática 2', professor: 'LEONADO ANSELMO', turno: 'tarde' },
  { id: '17', turma: 'A', diaSemana: 'terca', horarioInicio: '16:15', horarioFim: '17:25', disciplina: 'Física 2', professor: 'MARINALDO FERNANDES', turno: 'tarde' },

  // Quarta - Manhã
  { id: '18', turma: 'A', diaSemana: 'quarta', horarioInicio: '07:15', horarioFim: '08:05', disciplina: 'Biologia 2', professor: 'FORTUNATO', turno: 'manha' },
  { id: '19', turma: 'A', diaSemana: 'quarta', horarioInicio: '08:05', horarioFim: '09:05', disciplina: 'Biologia 2', professor: 'FORTUNATO', turno: 'manha' },
  { id: '20', turma: 'A', diaSemana: 'quarta', horarioInicio: '09:05', horarioFim: '09:55', disciplina: 'Química 2', professor: 'MAGNO', turno: 'manha' },
  { id: '21', turma: 'A', diaSemana: 'quarta', horarioInicio: '09:55', horarioFim: '11:05', disciplina: 'Química 2', professor: 'MAGNO', turno: 'manha' },
  { id: '22', turma: 'A', diaSemana: 'quarta', horarioInicio: '11:05', horarioFim: '11:55', disciplina: 'Literatura', professor: 'ANA CLAUDIA', turno: 'manha' },
  { id: '23', turma: 'A', diaSemana: 'quarta', horarioInicio: '11:55', horarioFim: '12:45', disciplina: 'Literatura', professor: 'ANA CLAUDIA', turno: 'manha' },
  { id: '24', turma: 'A', diaSemana: 'quarta', horarioInicio: '12:45', horarioFim: '13:35', disciplina: 'Filosofia', professor: 'JOAQUIM', turno: 'manha' },

  // Quinta - Manhã
  { id: '25', turma: 'A', diaSemana: 'quinta', horarioInicio: '07:15', horarioFim: '08:05', disciplina: 'História 2', professor: 'WELLINGTON', turno: 'manha' },
  { id: '26', turma: 'A', diaSemana: 'quinta', horarioInicio: '08:05', horarioFim: '09:05', disciplina: 'História 2', professor: 'WELLINGTON', turno: 'manha' },
  { id: '27', turma: 'A', diaSemana: 'quinta', horarioInicio: '09:05', horarioFim: '09:55', disciplina: 'Geografia 2', professor: 'SAMI', turno: 'manha' },
  { id: '28', turma: 'A', diaSemana: 'quinta', horarioInicio: '09:55', horarioFim: '11:05', disciplina: 'Geografia 2', professor: 'SAMI', turno: 'manha' },
  { id: '29', turma: 'A', diaSemana: 'quinta', horarioInicio: '11:05', horarioFim: '11:55', disciplina: 'Produção de Texto', professor: 'CARLOS LIMA', turno: 'manha' },
  { id: '30', turma: 'A', diaSemana: 'quinta', horarioInicio: '11:55', horarioFim: '12:45', disciplina: 'Produção de Texto', professor: 'CARLOS LIMA', turno: 'manha' },
  { id: '31', turma: 'A', diaSemana: 'quinta', horarioInicio: '12:45', horarioFim: '13:35', disciplina: 'Sociologia', professor: 'JOAQUIM', turno: 'manha' },

  // Sexta - Manhã
  { id: '32', turma: 'A', diaSemana: 'sexta', horarioInicio: '07:15', horarioFim: '08:05', disciplina: 'Biologia 3', professor: 'LUCIANO', turno: 'manha' },
  { id: '33', turma: 'A', diaSemana: 'sexta', horarioInicio: '08:05', horarioFim: '09:05', disciplina: 'Biologia 3', professor: 'LUCIANO', turno: 'manha' },
  { id: '34', turma: 'A', diaSemana: 'sexta', horarioInicio: '09:05', horarioFim: '09:55', disciplina: 'Matemática 3', professor: 'VICTOR', turno: 'manha' },
  { id: '35', turma: 'A', diaSemana: 'sexta', horarioInicio: '09:55', horarioFim: '11:05', disciplina: 'Matemática 3', professor: 'VICTOR', turno: 'manha' },
  { id: '36', turma: 'A', diaSemana: 'sexta', horarioInicio: '11:05', horarioFim: '11:55', disciplina: 'Arte', professor: 'FERNANDA', turno: 'manha' },
  { id: '37', turma: 'A', diaSemana: 'sexta', horarioInicio: '11:55', horarioFim: '12:45', disciplina: 'Educação Física', professor: 'DIEGO', turno: 'manha' },
  { id: '38', turma: 'A', diaSemana: 'sexta', horarioInicio: '12:45', horarioFim: '13:35', disciplina: 'Educação Física', professor: 'DIEGO', turno: 'manha' },
]

// Turma B has same schedule as A for simplicity (in production, would be different)
export const HORARIOS_OFICIAIS_B: HorarioOficial[] = HORARIOS_OFICIAIS_A.map(
  (h) => ({ ...h, id: `b-${h.id}`, turma: 'B' })
)

export const ALL_HORARIOS_OFICIAIS = [
  ...HORARIOS_OFICIAIS_A,
  ...HORARIOS_OFICIAIS_B,
]

export function getHorariosPorTurma(turma: string): HorarioOficial[] {
  return ALL_HORARIOS_OFICIAIS.filter((h) => h.turma === turma)
}

export function getHorariosPorDiaTurno(
  horarios: HorarioOficial[],
  dia: DiaSemana,
  turno: Turno
): HorarioOficial[] {
  return horarios.filter((h) => h.diaSemana === dia && h.turno === turno)
}
