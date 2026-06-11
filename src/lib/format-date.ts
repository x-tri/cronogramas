// Formatação de datas pt-BR — fonte única (antes havia 10 cópias locais de
// formatDate em componentes, com 4 assinaturas divergentes e try/catch morto:
// new Date('lixo') não lança, renderizava "Invalid Date" na tela).
//
// Todas aceitam string ISO, Date, null ou undefined; entrada ausente ou
// inválida cai no fallback '—'.

const FALLBACK = '—'

function toValidDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function format(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = toValidDate(value)
  if (!date) return FALLBACK
  return date.toLocaleString('pt-BR', options)
}

/** 11/06/2026 */
export function formatDateShortBR(value: string | Date | null | undefined): string {
  return format(value, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** 11 de jun. de 2026 */
export function formatDateMediumBR(value: string | Date | null | undefined): string {
  return format(value, { day: '2-digit', month: 'short', year: 'numeric' })
}

/** 11/06/2026 14:30 */
export function formatDateTimeBR(value: string | Date | null | undefined): string {
  return format(value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 11 de jun. de 2026 14:30 */
export function formatDateTimeMediumBR(value: string | Date | null | undefined): string {
  return format(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 11/06 */
export function formatDayMonthBR(value: string | Date | null | undefined): string {
  return format(value, { day: '2-digit', month: '2-digit' })
}
