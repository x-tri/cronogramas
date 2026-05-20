import { describe, expect, it } from 'vitest'

import {
  buildTurmaCandidates,
  DEFAULT_SCHOOL_YEAR,
  normalizeTurmaLabel,
} from './supabase-repository'

describe('supabase-repository schedule helpers', () => {
  it('normaliza espacos e caixa da turma', () => {
    expect(normalizeTurmaLabel('  Turma   300  ')).toBe('turma 300')
  })

  it('aceita turma numerica e gera variante com prefixo', () => {
    expect(buildTurmaCandidates('300')).toEqual(['300', 'Turma 300'])
  })

  it('aceita turma com prefixo e gera variante numerica', () => {
    expect(buildTurmaCandidates('Turma 301')).toEqual(['Turma 301', '301'])
  })

  it('aceita turma FACEX por serie e turno e gera alias compacto', () => {
    expect(buildTurmaCandidates('3ª SÉRIE AM')).toEqual(['3ª SÉRIE AM', 'Turma 3ª SÉRIE AM', '3AM'])
    expect(buildTurmaCandidates('3ª SÉRIE BM')).toEqual(['3ª SÉRIE BM', 'Turma 3ª SÉRIE BM', '3BM'])
  })

  it('mantem default do ano letivo alinhado ao app', () => {
    expect(DEFAULT_SCHOOL_YEAR).toBe(2026)
  })
})
