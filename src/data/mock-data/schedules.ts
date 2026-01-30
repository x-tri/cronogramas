import type { DiaSemana, HorarioOficial, Turno } from '../../types/domain'

// Horários oficiais PRÉ 2026 - Extraídos do PDF oficial do Colégio Marista

// Helper to create schedule entries
function h(
  id: string,
  turma: string,
  dia: DiaSemana,
  inicio: string,
  fim: string,
  turno: Turno,
  disciplina: string,
  professor: string
): HorarioOficial {
  return { id, turma, diaSemana: dia, horarioInicio: inicio, horarioFim: fim, turno, disciplina, professor }
}

// ==================== TURMA A ====================
export const HORARIOS_OFICIAIS_A: HorarioOficial[] = [
  // SEGUNDA - Manhã
  h('a-seg-1', 'A', 'segunda', '07:15', '08:05', 'manha', 'Biologia 3', 'LUCIANO'),
  h('a-seg-2', 'A', 'segunda', '08:05', '09:05', 'manha', 'Geografia 2', 'SAMI'),
  h('a-seg-3', 'A', 'segunda', '09:05', '09:55', 'manha', 'Física 2', 'MARINALDO FERNANDES'),
  h('a-seg-4', 'A', 'segunda', '09:55', '11:05', 'manha', 'Física 2', 'MARINALDO FERNANDES'),
  h('a-seg-5', 'A', 'segunda', '11:05', '11:55', 'manha', 'História 1', 'JOÃO MARIA'),
  h('a-seg-6', 'A', 'segunda', '11:55', '12:45', 'manha', 'Educação Física', 'DIEGO'),
  h('a-seg-7', 'A', 'segunda', '12:45', '13:35', 'manha', 'Física 1', 'CLAYBSON MOURA'),

  // TERÇA - Manhã
  h('a-ter-1', 'A', 'terca', '07:15', '08:05', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
  h('a-ter-2', 'A', 'terca', '08:05', '09:05', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
  h('a-ter-3', 'A', 'terca', '09:05', '09:55', 'manha', 'Inglês', 'GUSTAVO'),
  h('a-ter-4', 'A', 'terca', '09:55', '11:05', 'manha', 'Biologia 2', 'FORTUNATO'),
  h('a-ter-5', 'A', 'terca', '11:05', '11:55', 'manha', 'Biologia 1', 'AUGUSTO'),
  h('a-ter-6', 'A', 'terca', '11:55', '12:45', 'manha', 'Geografia 1', 'LÁZARO'),
  h('a-ter-7', 'A', 'terca', '12:45', '13:35', 'manha', 'Física 2', 'MARINALDO FERNANDES'),
  // TERÇA - Tarde (Vespertino)
  h('a-ter-8', 'A', 'terca', '14:35', '15:25', 'tarde', 'Sociologia', 'JOAQUIM'),
  h('a-ter-9', 'A', 'terca', '15:25', '16:15', 'tarde', 'Literatura', 'ANA CLAUDIA'),
  h('a-ter-10', 'A', 'terca', '16:15', '17:25', 'tarde', 'Biologia 3', 'LUCIANO'),
  h('a-ter-11', 'A', 'terca', '17:25', '18:15', 'tarde', 'Produção de Texto', 'CARLOS LIMA'),
  h('a-ter-12', 'A', 'terca', '18:15', '19:05', 'tarde', 'Produção de Texto', 'CARLOS LIMA'),

  // QUARTA - Manhã
  h('a-qua-1', 'A', 'quarta', '07:15', '08:05', 'manha', 'Biologia 2', 'FORTUNATO'),
  h('a-qua-2', 'A', 'quarta', '08:05', '09:05', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('a-qua-3', 'A', 'quarta', '09:05', '09:55', 'manha', 'História 2', 'WELLINGTON'),
  h('a-qua-4', 'A', 'quarta', '09:55', '11:05', 'manha', 'Matemática 3', 'VICTOR'),
  h('a-qua-5', 'A', 'quarta', '11:05', '11:55', 'manha', 'Produção de Texto', 'CARLOS LIMA'),
  h('a-qua-6', 'A', 'quarta', '11:55', '12:45', 'manha', 'Física 1', 'CLAYBSON MOURA'),
  h('a-qua-7', 'A', 'quarta', '12:45', '13:35', 'manha', 'Química 2', 'MAGNO'),

  // QUINTA - Manhã
  h('a-qui-1', 'A', 'quinta', '07:15', '08:05', 'manha', 'Química 2', 'MAGNO'),
  h('a-qui-2', 'A', 'quinta', '08:05', '09:05', 'manha', 'Geografia 2', 'SAMI'),
  h('a-qui-3', 'A', 'quinta', '09:05', '09:55', 'manha', 'Arte', 'FERNANDA'),
  h('a-qui-4', 'A', 'quinta', '09:55', '11:05', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('a-qui-5', 'A', 'quinta', '11:05', '11:55', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('a-qui-6', 'A', 'quinta', '11:55', '12:45', 'manha', 'História 2', 'WELLINGTON'),
  h('a-qui-7', 'A', 'quinta', '12:45', '13:35', 'manha', 'Química 1', 'JUSSIE BEZERRA'),

  // SEXTA - Manhã
  h('a-sex-1', 'A', 'sexta', '07:15', '08:05', 'manha', 'Literatura', 'ANA CLAUDIA'),
  h('a-sex-2', 'A', 'sexta', '08:05', '09:05', 'manha', 'Filosofia', 'JOAQUIM'),
  h('a-sex-3', 'A', 'sexta', '09:05', '09:55', 'manha', 'Matemática 2', 'LEONADO ANSELMO'),
  h('a-sex-4', 'A', 'sexta', '09:55', '11:05', 'manha', 'Matemática 2', 'LEONADO ANSELMO'),
  h('a-sex-5', 'A', 'sexta', '11:05', '11:55', 'manha', 'Língua Portuguesa', 'CARLOS LIMA'),
  h('a-sex-6', 'A', 'sexta', '11:55', '12:45', 'manha', 'Língua Portuguesa', 'CARLOS LIMA'),
  h('a-sex-7', 'A', 'sexta', '12:45', '13:35', 'manha', 'Geografia 1', 'LÁZARO'),
]

// ==================== TURMA B ====================
export const HORARIOS_OFICIAIS_B: HorarioOficial[] = [
  // SEGUNDA - Manhã
  h('b-seg-1', 'B', 'segunda', '07:15', '08:05', 'manha', 'Geografia 2', 'SAMI'),
  h('b-seg-2', 'B', 'segunda', '08:05', '09:05', 'manha', 'Biologia 3', 'LUCIANO'),
  h('b-seg-3', 'B', 'segunda', '09:05', '09:55', 'manha', 'Física 1', 'CLAYBSON MOURA'),
  h('b-seg-4', 'B', 'segunda', '09:55', '11:05', 'manha', 'História 1', 'JOÃO MARIA'),
  h('b-seg-5', 'B', 'segunda', '11:05', '11:55', 'manha', 'Física 2', 'MARINALDO FERNANDES'),
  h('b-seg-6', 'B', 'segunda', '11:55', '12:45', 'manha', 'Física 2', 'MARINALDO FERNANDES'),
  h('b-seg-7', 'B', 'segunda', '12:45', '13:35', 'manha', 'Educação Física', 'DIEGO'),

  // TERÇA - Manhã
  h('b-ter-1', 'B', 'terca', '07:15', '08:05', 'manha', 'Inglês', 'GUSTAVO'),
  h('b-ter-2', 'B', 'terca', '08:05', '09:05', 'manha', 'Biologia 1', 'AUGUSTO'),
  h('b-ter-3', 'B', 'terca', '09:05', '09:55', 'manha', 'Geografia 1', 'LÁZARO'),
  h('b-ter-4', 'B', 'terca', '09:55', '11:05', 'manha', 'Língua Portuguesa', 'CARLOS LIMA'),
  h('b-ter-5', 'B', 'terca', '11:05', '11:55', 'manha', 'Geografia 1', 'LÁZARO'),
  h('b-ter-6', 'B', 'terca', '11:55', '12:45', 'manha', 'Biologia 2', 'FORTUNATO'),
  h('b-ter-7', 'B', 'terca', '12:45', '13:35', 'manha', 'Arte', 'FERNANDA'),
  // TERÇA - Tarde (Vespertino)
  h('b-ter-8', 'B', 'terca', '14:35', '15:25', 'tarde', 'Literatura', 'ANA CLAUDIA'),
  h('b-ter-9', 'B', 'terca', '15:25', '16:15', 'tarde', 'Biologia 3', 'LUCIANO'),
  h('b-ter-10', 'B', 'terca', '16:15', '17:25', 'tarde', 'Produção de Texto', 'CARLOS LIMA'),
  h('b-ter-11', 'B', 'terca', '17:25', '18:15', 'tarde', 'Biologia 2', 'FORTUNATO'),
  h('b-ter-12', 'B', 'terca', '18:15', '19:05', 'tarde', 'Física 2', 'MARINALDO FERNANDES'),

  // QUARTA - Manhã
  h('b-qua-1', 'B', 'quarta', '07:15', '08:05', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('b-qua-2', 'B', 'quarta', '08:05', '09:05', 'manha', 'Sociologia', 'JOAQUIM'),
  h('b-qua-3', 'B', 'quarta', '09:05', '09:55', 'manha', 'Produção de Texto', 'CARLOS LIMA'),
  h('b-qua-4', 'B', 'quarta', '09:55', '11:05', 'manha', 'Produção de Texto', 'CARLOS LIMA'),
  h('b-qua-5', 'B', 'quarta', '11:05', '11:55', 'manha', 'Química 2', 'MAGNO'),
  h('b-qua-6', 'B', 'quarta', '11:55', '12:45', 'manha', 'Matemática 3', 'VICTOR'),
  h('b-qua-7', 'B', 'quarta', '12:45', '13:35', 'manha', 'Física 1', 'CLAYBSON MOURA'),

  // QUINTA - Manhã
  h('b-qui-1', 'B', 'quinta', '07:15', '08:05', 'manha', 'Matemática 2', 'LEONADO ANSELMO'),
  h('b-qui-2', 'B', 'quinta', '08:05', '09:05', 'manha', 'Matemática 2', 'LEONADO ANSELMO'),
  h('b-qui-3', 'B', 'quinta', '09:05', '09:55', 'manha', 'Química 2', 'MAGNO'),
  h('b-qui-4', 'B', 'quinta', '09:55', '11:05', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
  h('b-qui-5', 'B', 'quinta', '11:05', '11:55', 'manha', 'História 2', 'WELLINGTON'),
  h('b-qui-6', 'B', 'quinta', '11:55', '12:45', 'manha', 'Língua Portuguesa', 'CARLOS LIMA'),
  h('b-qui-7', 'B', 'quinta', '12:45', '13:35', 'manha', 'História 2', 'WELLINGTON'),

  // SEXTA - Manhã
  h('b-sex-1', 'B', 'sexta', '07:15', '08:05', 'manha', 'Filosofia', 'JOAQUIM'),
  h('b-sex-2', 'B', 'sexta', '08:05', '09:05', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('b-sex-3', 'B', 'sexta', '09:05', '09:55', 'manha', 'Literatura', 'ANA CLAUDIA'),
  h('b-sex-4', 'B', 'sexta', '09:55', '11:05', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
  h('b-sex-5', 'B', 'sexta', '11:05', '11:55', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('b-sex-6', 'B', 'sexta', '11:55', '12:45', 'manha', 'Geografia 2', 'SAMI'),
  h('b-sex-7', 'B', 'sexta', '12:45', '13:35', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
]

// ==================== TURMA C ====================
export const HORARIOS_OFICIAIS_C: HorarioOficial[] = [
  // SEGUNDA - Manhã
  h('c-seg-1', 'C', 'segunda', '07:15', '08:05', 'manha', 'Educação Física', 'DIEGO'),
  h('c-seg-2', 'C', 'segunda', '08:05', '09:05', 'manha', 'Física 2', 'MARINALDO FERNANDES'),
  h('c-seg-3', 'C', 'segunda', '09:05', '09:55', 'manha', 'História 1', 'JOÃO MARIA'),
  h('c-seg-4', 'C', 'segunda', '09:55', '11:05', 'manha', 'Física 1', 'CLAYBSON MOURA'),
  h('c-seg-5', 'C', 'segunda', '11:05', '11:55', 'manha', 'Produção de Texto', 'CARLOS LIMA'),
  h('c-seg-6', 'C', 'segunda', '11:55', '12:45', 'manha', 'Produção de Texto', 'CARLOS LIMA'),
  h('c-seg-7', 'C', 'segunda', '12:45', '13:35', 'manha', 'Química 1', 'JUSSIE BEZERRA'),

  // TERÇA - Manhã
  h('c-ter-1', 'C', 'terca', '07:15', '08:05', 'manha', 'Língua Portuguesa', 'CARLOS LIMA'),
  h('c-ter-2', 'C', 'terca', '08:05', '09:05', 'manha', 'Língua Portuguesa', 'CARLOS LIMA'),
  h('c-ter-3', 'C', 'terca', '09:05', '09:55', 'manha', 'Biologia 2', 'FORTUNATO'),
  h('c-ter-4', 'C', 'terca', '09:55', '11:05', 'manha', 'Biologia 1', 'AUGUSTO'),
  h('c-ter-5', 'C', 'terca', '11:05', '11:55', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('c-ter-6', 'C', 'terca', '11:55', '12:45', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('c-ter-7', 'C', 'terca', '12:45', '13:35', 'manha', 'Filosofia', 'JOAQUIM'),
  // TERÇA - Tarde (Vespertino)
  h('c-ter-8', 'C', 'terca', '14:35', '15:25', 'tarde', 'Física 2', 'MARINALDO FERNANDES'),
  h('c-ter-9', 'C', 'terca', '15:25', '16:15', 'tarde', 'Física 2', 'MARINALDO FERNANDES'),
  h('c-ter-10', 'C', 'terca', '16:15', '17:25', 'tarde', 'Sociologia', 'JOAQUIM'),
  h('c-ter-11', 'C', 'terca', '17:25', '18:15', 'tarde', 'Biologia 3', 'LUCIANO'),
  h('c-ter-12', 'C', 'terca', '18:15', '19:05', 'tarde', 'Biologia 3', 'LUCIANO'),

  // QUARTA - Manhã
  h('c-qua-1', 'C', 'quarta', '07:15', '08:05', 'manha', 'História 2', 'WELLINGTON'),
  h('c-qua-2', 'C', 'quarta', '08:05', '09:05', 'manha', 'Biologia 2', 'FORTUNATO'),
  h('c-qua-3', 'C', 'quarta', '09:05', '09:55', 'manha', 'Física 1', 'CLAYBSON MOURA'),
  h('c-qua-4', 'C', 'quarta', '09:55', '11:05', 'manha', 'História 2', 'WELLINGTON'),
  h('c-qua-5', 'C', 'quarta', '11:05', '11:55', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
  h('c-qua-6', 'C', 'quarta', '11:55', '12:45', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
  h('c-qua-7', 'C', 'quarta', '12:45', '13:35', 'manha', 'Matemática 3', 'VICTOR'),

  // QUINTA - Manhã
  h('c-qui-1', 'C', 'quinta', '07:15', '08:05', 'manha', 'Geografia 2', 'SAMI'),
  h('c-qui-2', 'C', 'quinta', '08:05', '09:05', 'manha', 'Arte', 'FERNANDA'),
  h('c-qui-3', 'C', 'quinta', '09:05', '09:55', 'manha', 'Matemática 2', 'LEONADO ANSELMO'),
  h('c-qui-4', 'C', 'quinta', '09:55', '11:05', 'manha', 'Química 2', 'MAGNO'),
  h('c-qui-5', 'C', 'quinta', '11:05', '11:55', 'manha', 'Produção de Texto', 'CARLOS LIMA'),
  h('c-qui-6', 'C', 'quinta', '11:55', '12:45', 'manha', 'Química 2', 'MAGNO'),
  h('c-qui-7', 'C', 'quinta', '12:45', '13:35', 'manha', 'Geografia 1', 'LÁZARO'),

  // SEXTA - Manhã
  h('c-sex-1', 'C', 'sexta', '07:15', '08:05', 'manha', 'Inglês', 'GUSTAVO'),
  h('c-sex-2', 'C', 'sexta', '08:05', '09:05', 'manha', 'Literatura', 'ANA CLAUDIA'),
  h('c-sex-3', 'C', 'sexta', '09:05', '09:55', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('c-sex-4', 'C', 'sexta', '09:55', '11:05', 'manha', 'Literatura', 'ANA CLAUDIA'),
  h('c-sex-5', 'C', 'sexta', '11:05', '11:55', 'manha', 'Matemática 2', 'LEONADO ANSELMO'),
  h('c-sex-6', 'C', 'sexta', '11:55', '12:45', 'manha', 'Geografia 1', 'LÁZARO'),
  h('c-sex-7', 'C', 'sexta', '12:45', '13:35', 'manha', 'Geografia 2', 'SAMI'),
]

// ==================== TURMA D ====================
export const HORARIOS_OFICIAIS_D: HorarioOficial[] = [
  // SEGUNDA - Manhã
  h('d-seg-1', 'D', 'segunda', '07:15', '08:05', 'manha', 'História 1', 'JOÃO MARIA'),
  h('d-seg-2', 'D', 'segunda', '08:05', '09:05', 'manha', 'Educação Física', 'DIEGO'),
  h('d-seg-3', 'D', 'segunda', '09:05', '09:55', 'manha', 'Geografia 2', 'SAMI'),
  h('d-seg-4', 'D', 'segunda', '09:55', '11:05', 'manha', 'Biologia 3', 'LUCIANO'),
  h('d-seg-5', 'D', 'segunda', '11:05', '11:55', 'manha', 'Física 1', 'CLAYBSON MOURA'),
  h('d-seg-6', 'D', 'segunda', '11:55', '12:45', 'manha', 'Física 1', 'CLAYBSON MOURA'),
  h('d-seg-7', 'D', 'segunda', '12:45', '13:35', 'manha', 'Arte', 'FERNANDA'),

  // TERÇA - Manhã
  h('d-ter-1', 'D', 'terca', '07:15', '08:05', 'manha', 'Geografia 1', 'LÁZARO'),
  h('d-ter-2', 'D', 'terca', '08:05', '09:05', 'manha', 'Inglês', 'GUSTAVO'),
  h('d-ter-3', 'D', 'terca', '09:05', '09:55', 'manha', 'Biologia 1', 'AUGUSTO'),
  h('d-ter-4', 'D', 'terca', '09:55', '11:05', 'manha', 'Geografia 1', 'LÁZARO'),
  h('d-ter-5', 'D', 'terca', '11:05', '11:55', 'manha', 'Biologia 2', 'FORTUNATO'),
  h('d-ter-6', 'D', 'terca', '11:55', '12:45', 'manha', 'Filosofia', 'JOAQUIM'),
  h('d-ter-7', 'D', 'terca', '12:45', '13:35', 'manha', 'Biologia 2', 'FORTUNATO'),
  // TERÇA - Tarde (Vespertino)
  h('d-ter-8', 'D', 'terca', '14:35', '15:25', 'tarde', 'Produção de Texto', 'CARLOS LIMA'),
  h('d-ter-9', 'D', 'terca', '15:25', '16:15', 'tarde', 'Produção de Texto', 'CARLOS LIMA'),
  h('d-ter-10', 'D', 'terca', '16:15', '17:25', 'tarde', 'Física 2', 'MARINALDO FERNANDES'),
  h('d-ter-11', 'D', 'terca', '17:25', '18:15', 'tarde', 'Física 2', 'MARINALDO FERNANDES'),
  h('d-ter-12', 'D', 'terca', '18:15', '19:05', 'tarde', 'Literatura', 'ANA CLAUDIA'),

  // QUARTA - Manhã
  h('d-qua-1', 'D', 'quarta', '07:15', '08:05', 'manha', 'Sociologia', 'JOAQUIM'),
  h('d-qua-2', 'D', 'quarta', '08:05', '09:05', 'manha', 'Produção de Texto', 'CARLOS LIMA'),
  h('d-qua-3', 'D', 'quarta', '09:05', '09:55', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('d-qua-4', 'D', 'quarta', '09:55', '11:05', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('d-qua-5', 'D', 'quarta', '11:05', '11:55', 'manha', 'Matemática 3', 'VICTOR'),
  h('d-qua-6', 'D', 'quarta', '11:55', '12:45', 'manha', 'Química 2', 'MAGNO'),
  h('d-qua-7', 'D', 'quarta', '12:45', '13:35', 'manha', 'Biologia 3', 'LUCIANO'),

  // QUINTA - Manhã
  h('d-qui-1', 'D', 'quinta', '07:15', '08:05', 'manha', 'Física 2', 'MARINALDO FERNANDES'),
  h('d-qui-2', 'D', 'quinta', '08:05', '09:05', 'manha', 'História 2', 'WELLINGTON'),
  h('d-qui-3', 'D', 'quinta', '09:05', '09:55', 'manha', 'Geografia 2', 'SAMI'),
  h('d-qui-4', 'D', 'quinta', '09:55', '11:05', 'manha', 'História 2', 'WELLINGTON'),
  h('d-qui-5', 'D', 'quinta', '11:05', '11:55', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
  h('d-qui-6', 'D', 'quinta', '11:55', '12:45', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
  h('d-qui-7', 'D', 'quinta', '12:45', '13:35', 'manha', 'Química 2', 'MAGNO'),

  // SEXTA - Manhã
  h('d-sex-1', 'D', 'sexta', '07:15', '08:05', 'manha', 'Língua Portuguesa', 'CARLOS LIMA'),
  h('d-sex-2', 'D', 'sexta', '08:05', '09:05', 'manha', 'Língua Portuguesa', 'CARLOS LIMA'),
  h('d-sex-3', 'D', 'sexta', '09:05', '09:55', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
  h('d-sex-4', 'D', 'sexta', '09:55', '11:05', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('d-sex-5', 'D', 'sexta', '11:05', '11:55', 'manha', 'Literatura', 'ANA CLAUDIA'),
  h('d-sex-6', 'D', 'sexta', '11:55', '12:45', 'manha', 'Matemática 2', 'LEONADO ANSELMO'),
  h('d-sex-7', 'D', 'sexta', '12:45', '13:35', 'manha', 'Matemática 2', 'LEONADO ANSELMO'),
]

// ==================== TURMA E ====================
export const HORARIOS_OFICIAIS_E: HorarioOficial[] = [
  // SEGUNDA - Manhã
  h('e-seg-1', 'E', 'segunda', '07:15', '08:05', 'manha', 'Física 2', 'MARINALDO FERNANDES'),
  h('e-seg-2', 'E', 'segunda', '08:05', '09:05', 'manha', 'História 1', 'JOÃO MARIA'),
  h('e-seg-3', 'E', 'segunda', '09:05', '09:55', 'manha', 'Biologia 3', 'LUCIANO'),
  h('e-seg-4', 'E', 'segunda', '09:55', '11:05', 'manha', 'Geografia 2', 'SAMI'),
  h('e-seg-5', 'E', 'segunda', '11:05', '11:55', 'manha', 'Educação Física', 'DIEGO'),
  h('e-seg-6', 'E', 'segunda', '11:55', '12:45', 'manha', 'Matemática 2', 'LEONADO ANSELMO'),
  h('e-seg-7', 'E', 'segunda', '12:45', '13:35', 'manha', 'Física 2', 'MARINALDO FERNANDES'),

  // TERÇA - Manhã
  h('e-ter-1', 'E', 'terca', '07:15', '08:05', 'manha', 'Biologia 1', 'AUGUSTO'),
  h('e-ter-2', 'E', 'terca', '08:05', '09:05', 'manha', 'Geografia 1', 'LÁZARO'),
  h('e-ter-3', 'E', 'terca', '09:05', '09:55', 'manha', 'Língua Portuguesa', 'CARLOS LIMA'),
  h('e-ter-4', 'E', 'terca', '09:55', '11:05', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('e-ter-5', 'E', 'terca', '11:05', '11:55', 'manha', 'Sociologia', 'JOAQUIM'),
  h('e-ter-6', 'E', 'terca', '11:55', '12:45', 'manha', 'Física 2', 'MARINALDO FERNANDES'),
  h('e-ter-7', 'E', 'terca', '12:45', '13:35', 'manha', 'Geografia 1', 'LÁZARO'),
  // TERÇA - Tarde (Vespertino)
  h('e-ter-8', 'E', 'terca', '14:35', '15:25', 'tarde', 'Biologia 3', 'LUCIANO'),
  h('e-ter-9', 'E', 'terca', '15:25', '16:15', 'tarde', 'Filosofia', 'JOAQUIM'),
  h('e-ter-10', 'E', 'terca', '16:15', '17:25', 'tarde', 'Literatura', 'ANA CLAUDIA'),
  h('e-ter-11', 'E', 'terca', '17:25', '18:15', 'tarde', 'Literatura', 'ANA CLAUDIA'),
  h('e-ter-12', 'E', 'terca', '18:15', '19:05', 'tarde', 'Biologia 2', 'FORTUNATO'),

  // QUARTA - Manhã
  h('e-qua-1', 'E', 'quarta', '07:15', '08:05', 'manha', 'Produção de Texto', 'CARLOS LIMA'),
  h('e-qua-2', 'E', 'quarta', '08:05', '09:05', 'manha', 'História 2', 'WELLINGTON'),
  h('e-qua-3', 'E', 'quarta', '09:05', '09:55', 'manha', 'Matemática 3', 'VICTOR'),
  h('e-qua-4', 'E', 'quarta', '09:55', '11:05', 'manha', 'Física 1', 'CLAYBSON MOURA'),
  h('e-qua-5', 'E', 'quarta', '11:05', '11:55', 'manha', 'Física 1', 'CLAYBSON MOURA'),
  h('e-qua-6', 'E', 'quarta', '11:55', '12:45', 'manha', 'Língua Portuguesa', 'CARLOS LIMA'),
  h('e-qua-7', 'E', 'quarta', '12:45', '13:35', 'manha', 'Química 1', 'JUSSIE BEZERRA'),

  // QUINTA - Manhã
  h('e-qui-1', 'E', 'quinta', '07:15', '08:05', 'manha', 'Biologia 2', 'FORTUNATO'),
  h('e-qui-2', 'E', 'quinta', '08:05', '09:05', 'manha', 'Química 2', 'MAGNO'),
  h('e-qui-3', 'E', 'quinta', '09:05', '09:55', 'manha', 'História 2', 'WELLINGTON'),
  h('e-qui-4', 'E', 'quinta', '09:55', '11:05', 'manha', 'Geografia 2', 'SAMI'),
  h('e-qui-5', 'E', 'quinta', '11:05', '11:55', 'manha', 'Química 2', 'MAGNO'),
  h('e-qui-6', 'E', 'quinta', '11:55', '12:45', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),
  h('e-qui-7', 'E', 'quinta', '12:45', '13:35', 'manha', 'Matemática 1', 'EDUARDO JATOBÁ'),

  // SEXTA - Manhã
  h('e-sex-1', 'E', 'sexta', '07:15', '08:05', 'manha', 'Matemática 2', 'LEONADO ANSELMO'),
  h('e-sex-2', 'E', 'sexta', '08:05', '09:05', 'manha', 'Inglês', 'GUSTAVO'),
  h('e-sex-3', 'E', 'sexta', '09:05', '09:55', 'manha', 'Produção de Texto', 'CARLOS LIMA'),
  h('e-sex-4', 'E', 'sexta', '09:55', '11:05', 'manha', 'Produção de Texto', 'CARLOS LIMA'),
  h('e-sex-5', 'E', 'sexta', '11:05', '11:55', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
  h('e-sex-6', 'E', 'sexta', '11:55', '12:45', 'manha', 'Química 1', 'JUSSIE BEZERRA'),
  h('e-sex-7', 'E', 'sexta', '12:45', '13:35', 'manha', 'Arte', 'FERNANDA'),
]

// All schedules combined
export const ALL_HORARIOS_OFICIAIS = [
  ...HORARIOS_OFICIAIS_A,
  ...HORARIOS_OFICIAIS_B,
  ...HORARIOS_OFICIAIS_C,
  ...HORARIOS_OFICIAIS_D,
  ...HORARIOS_OFICIAIS_E,
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
