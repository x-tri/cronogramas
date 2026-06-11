import { describe, expect, it } from 'vitest'

import {
  formatDateMediumBR,
  formatDateShortBR,
  formatDateTimeBR,
  formatDateTimeMediumBR,
  formatDayMonthBR,
} from './format-date'

// Sem offset de fuso: interpretado como hora LOCAL em qualquer máquina —
// o teste passa igual no runner do CI (UTC) e em dev (UTC-3).
const ISO = '2026-06-11T14:30:00'

describe('format-date', () => {
  it('formatDateShortBR: dd/mm/aaaa', () => {
    expect(formatDateShortBR(ISO)).toBe('11/06/2026')
  })

  it('formatDateMediumBR: dd mmm. aaaa', () => {
    expect(formatDateMediumBR(ISO)).toMatch(/^11 de jun\.? de 2026$|^11 jun\.? 2026$/)
  })

  it('formatDateTimeBR: data + hora', () => {
    expect(formatDateTimeBR(ISO)).toContain('11/06/2026')
    expect(formatDateTimeBR(ISO)).toMatch(/14:30/)
  })

  it('formatDateTimeMediumBR: data abreviada + hora', () => {
    const out = formatDateTimeMediumBR(ISO)
    expect(out).toMatch(/jun/)
    expect(out).toMatch(/14:30/)
  })

  it('formatDayMonthBR: dd/mm', () => {
    expect(formatDayMonthBR(new Date(ISO))).toBe('11/06')
  })

  it('aceita Date além de string ISO', () => {
    expect(formatDateShortBR(new Date(ISO))).toBe('11/06/2026')
  })

  // Antes: new Date('lixo') não lança — os try/catch das 10 cópias eram
  // código morto e a tela mostrava "Invalid Date". Agora: fallback '—'.
  it('null, undefined e data inválida caem no fallback —', () => {
    expect(formatDateShortBR(null)).toBe('—')
    expect(formatDateShortBR(undefined)).toBe('—')
    expect(formatDateShortBR('nao-e-data')).toBe('—')
    expect(formatDateTimeBR(null)).toBe('—')
  })
})
