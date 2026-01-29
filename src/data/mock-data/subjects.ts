import type { AreaEnem, Disciplina } from '../../types/domain'
import { CORES_AREAS } from '../../constants/colors'

type DisciplinaInput = {
  codigo: string
  nome: string
  professor: string
  area: AreaEnem
}

const DISCIPLINAS_RAW: DisciplinaInput[] = [
  // Ciências da Natureza
  { codigo: 'BIO1', nome: 'Biologia 1', professor: 'AUGUSTO', area: 'natureza' },
  { codigo: 'BIO2', nome: 'Biologia 2', professor: 'FORTUNATO', area: 'natureza' },
  { codigo: 'BIO3', nome: 'Biologia 3', professor: 'LUCIANO', area: 'natureza' },
  { codigo: 'FIS1', nome: 'Física 1', professor: 'CLAYBSON MOURA', area: 'natureza' },
  { codigo: 'FIS2', nome: 'Física 2', professor: 'MARINALDO FERNANDES', area: 'natureza' },
  { codigo: 'QUIM1', nome: 'Química 1', professor: 'JUSSIE BEZERRA', area: 'natureza' },
  { codigo: 'QUIM2', nome: 'Química 2', professor: 'MAGNO', area: 'natureza' },

  // Matemática
  { codigo: 'MAT1', nome: 'Matemática 1', professor: 'EDUARDO JATOBÁ', area: 'matematica' },
  { codigo: 'MAT2', nome: 'Matemática 2', professor: 'LEONADO ANSELMO', area: 'matematica' },
  { codigo: 'MAT3', nome: 'Matemática 3', professor: 'VICTOR', area: 'matematica' },

  // Linguagens
  { codigo: 'LPORT', nome: 'Língua Portuguesa', professor: 'CARLOS LIMA', area: 'linguagens' },
  { codigo: 'LITE', nome: 'Literatura', professor: 'ANA CLAUDIA', area: 'linguagens' },
  { codigo: 'PRODTEXTO', nome: 'Produção de Texto', professor: 'CARLOS LIMA', area: 'linguagens' },
  { codigo: 'ING', nome: 'Inglês', professor: 'GUSTAVO', area: 'linguagens' },
  { codigo: 'ARTE', nome: 'Arte', professor: 'FERNANDA', area: 'linguagens' },

  // Humanas
  { codigo: 'HIST1', nome: 'História 1', professor: 'JOÃO MARIA', area: 'humanas' },
  { codigo: 'HIST2', nome: 'História 2', professor: 'WELLINGTON', area: 'humanas' },
  { codigo: 'GEOG1', nome: 'Geografia 1', professor: 'LÁZARO', area: 'humanas' },
  { codigo: 'GEOG2', nome: 'Geografia 2', professor: 'SAMI', area: 'humanas' },
  { codigo: 'FILO', nome: 'Filosofia', professor: 'JOAQUIM', area: 'humanas' },
  { codigo: 'SOCI', nome: 'Sociologia', professor: 'JOAQUIM', area: 'humanas' },

  // Outros
  { codigo: 'EDFIS', nome: 'Educação Física', professor: 'DIEGO', area: 'outros' },
]

export const DISCIPLINAS: Disciplina[] = DISCIPLINAS_RAW.map((d) => ({
  ...d,
  id: d.codigo,
  cor: CORES_AREAS[d.area],
}))

export const DISCIPLINAS_BY_CODE = new Map(
  DISCIPLINAS.map((d) => [d.codigo, d])
)

export const DISCIPLINAS_BY_AREA = DISCIPLINAS.reduce(
  (acc, d) => {
    if (!acc[d.area]) acc[d.area] = []
    acc[d.area].push(d)
    return acc
  },
  {} as Record<AreaEnem, Disciplina[]>
)
