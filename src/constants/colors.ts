import type { AreaEnem, TipoBloco } from '../types/domain'

export const CORES_AREAS: Record<AreaEnem, string> = {
  natureza: '#10B981', // Verde - Ciências da Natureza
  matematica: '#EF4444', // Vermelho - Matemática
  linguagens: '#3B82F6', // Azul - Linguagens
  humanas: '#F59E0B', // Amarelo - Humanas
  outros: '#8B5CF6', // Roxo - Outros
}

export const CORES_TIPOS: Record<TipoBloco, string> = {
  aula_oficial: '#6B7280', // Cinza - Não editável
  estudo: '#3B82F6', // Azul
  simulado: '#EF4444', // Vermelho
  revisao: '#F59E0B', // Amarelo
  descanso: '#10B981', // Verde
  rotina: '#8B5CF6', // Roxo
  foco: '#EC4899', // Rosa - Foco especial
}

export const CORES_PRIORIDADE: Record<number, string> = {
  0: '#6B7280', // Normal - Cinza
  1: '#F59E0B', // Alta - Amarelo
  2: '#EF4444', // Urgente - Vermelho
}

export function getBlockColor(
  tipo: TipoBloco,
  disciplinaArea?: AreaEnem | null,
  customCor?: string | null
): string {
  if (customCor) return customCor
  if (tipo === 'estudo' && disciplinaArea) return CORES_AREAS[disciplinaArea]
  return CORES_TIPOS[tipo]
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
