import { describe, expect, it } from 'vitest'

import {
  buildTurmaCandidates,
  DEFAULT_SCHOOL_YEAR,
  normalizeTurmaLabel,
  resolveScheduleSchoolId,
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

describe('resolveScheduleSchoolId (escopo por escola do mentor)', () => {
  // Incidente 2026-06-11: mentora do Dom Bosco via grade mock do Marista
  // quando o schoolId chegava nulo. Usuario escopado NUNCA pode cair no
  // fallback mock — sempre enxerga a propria escola.

  it('usuario escopado sem schoolId solicitado usa a escola do mentor', () => {
    expect(resolveScheduleSchoolId(null, 'dom-bosco-id')).toBe('dom-bosco-id')
  })

  it('usuario escopado com schoolId de OUTRA escola e forcado para a propria', () => {
    expect(resolveScheduleSchoolId('marista-id', 'dom-bosco-id')).toBe('dom-bosco-id')
  })

  it('usuario escopado com a propria escola mantem a escola', () => {
    expect(resolveScheduleSchoolId('dom-bosco-id', 'dom-bosco-id')).toBe('dom-bosco-id')
  })

  it('usuario sem escopo (super_admin) mantem o schoolId solicitado', () => {
    expect(resolveScheduleSchoolId('marista-id', null)).toBe('marista-id')
  })

  it('usuario sem escopo e sem schoolId permite fallback legado (null)', () => {
    expect(resolveScheduleSchoolId(null, null)).toBeNull()
  })
})
