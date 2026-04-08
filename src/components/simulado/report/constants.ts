// Constantes visuais compartilhadas pelos sub-componentes do relatorio

export const AREA_COLORS: Record<string, string> = {
  CN: '#10b981',
  CH: '#f97316',
  LC: '#3b82f6',
  MT: '#ef4444',
  RED: '#8b5cf6',
}

export const AREA_BG: Record<string, string> = {
  CN: 'bg-[#ecfdf5]',
  CH: 'bg-[#fff7ed]',
  LC: 'bg-[#eff6ff]',
  MT: 'bg-[#fef2f2]',
  RED: 'bg-[#f5f3ff]',
}

export const AREA_TEXT: Record<string, string> = {
  CN: 'text-[#10b981]',
  CH: 'text-[#f97316]',
  LC: 'text-[#3b82f6]',
  MT: 'text-[#ef4444]',
  RED: 'text-[#8b5cf6]',
}

export const AREA_BORDER: Record<string, string> = {
  CN: 'border-[#10b981]',
  CH: 'border-[#f97316]',
  LC: 'border-[#3b82f6]',
  MT: 'border-[#ef4444]',
  RED: 'border-[#8b5cf6]',
}

export const AREA_NOMES: Record<string, string> = {
  CN: 'Ciencias da Natureza',
  CH: 'Ciencias Humanas',
  LC: 'Linguagens e Codigos',
  MT: 'Matematica',
  RED: 'Redacao',
}

export const DIFICULDADE_LABEL: Record<string, string> = {
  muito_facil: 'Muito Facil',
  facil: 'Facil',
  medio: 'Medio',
  dificil: 'Dificil',
  muito_dificil: 'Muito Dificil',
}

export const DIFICULDADE_COLOR: Record<string, string> = {
  muito_facil: 'text-[#10b981]',
  facil: 'text-[#34d399]',
  medio: 'text-[#f59e0b]',
  dificil: 'text-[#ef4444]',
  muito_dificil: 'text-[#991b1b]',
}

export function formatNota(value: number | null | undefined): string {
  if (value == null) return '\u2014'
  return value.toFixed(1)
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '\u2014'
  return `${value.toFixed(1)}%`
}

export function getPrioridadeFromScore(score: number): {
  readonly label: string
  readonly classes: string
  readonly color: string
} {
  if (score >= 10) return { label: 'CRITICO', classes: 'text-[#991b1b] bg-[#fef2f2]', color: '#991b1b' }
  if (score >= 5) return { label: 'ALTA', classes: 'text-[#dc2626] bg-[#fef2f2]', color: '#dc2626' }
  if (score >= 2) return { label: 'MEDIA', classes: 'text-[#d97706] bg-[#fffbeb]', color: '#d97706' }
  return { label: 'BAIXA', classes: 'text-[#6b7280] bg-[#f9fafb]', color: '#6b7280' }
}

export function formatDificuldadeSimples(dificuldade: number): string {
  if (dificuldade < -0.5) return 'facil'
  if (dificuldade < 1.0) return 'medio'
  return 'dificil'
}
