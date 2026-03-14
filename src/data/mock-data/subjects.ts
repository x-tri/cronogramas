import type { AreaEnem, Disciplina } from '../../types/domain'
import { CORES_AREAS } from '../../constants/colors'

type DisciplinaInput = {
  codigo: string
  nome: string
  area: AreaEnem
}

const DISCIPLINAS_RAW: DisciplinaInput[] = [
  // Ciências da Natureza
  { codigo: 'BIO',   nome: 'Biologia',          area: 'natureza' },
  { codigo: 'FIS',   nome: 'Física',             area: 'natureza' },
  { codigo: 'QUIM',  nome: 'Química',            area: 'natureza' },

  // Matemática
  { codigo: 'MAT',   nome: 'Matemática',         area: 'matematica' },

  // Linguagens
  { codigo: 'LPORT', nome: 'Língua Portuguesa',  area: 'linguagens' },
  { codigo: 'LITE',  nome: 'Literatura',         area: 'linguagens' },
  { codigo: 'PRODTEXTO', nome: 'Produção de Texto', area: 'linguagens' },
  { codigo: 'ING',   nome: 'Inglês',             area: 'linguagens' },
  { codigo: 'ARTE',  nome: 'Arte',               area: 'linguagens' },

  // Humanas
  { codigo: 'HIST',  nome: 'História',           area: 'humanas' },
  { codigo: 'GEOG',  nome: 'Geografia',          area: 'humanas' },
  { codigo: 'FILO',  nome: 'Filosofia',          area: 'humanas' },
  { codigo: 'SOCI',  nome: 'Sociologia',         area: 'humanas' },

  // Outros
  { codigo: 'EDFIS', nome: 'Educação Física',    area: 'outros' },
  { codigo: 'REDAC', nome: 'Redação',            area: 'outros' },
]

export const DISCIPLINAS: Disciplina[] = DISCIPLINAS_RAW.map((d) => ({
  ...d,
  id: d.codigo,
  professor: '',
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
