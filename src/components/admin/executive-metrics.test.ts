import { describe, expect, it } from 'vitest'

import { coveragePercent, median, normalizeSchoolKey } from './executive-metrics'

describe('coveragePercent', () => {
  it('calcula a cobertura atendidos/base em % pt-BR', () => {
    expect(coveragePercent(185, 3700)).toBe('5%')
    expect(coveragePercent(36, 96)).toBe('37,5%')
  })

  it('base zero ou desconhecida retorna null (não exibe)', () => {
    expect(coveragePercent(10, 0)).toBeNull()
  })
})

describe('median', () => {
  it('mediana de quantidade ímpar e par', () => {
    expect(median([36, 5, 200])).toBe(36)
    expect(median([10, 20, 30, 40])).toBe(25)
  })

  it('não é distorcida por outliers (motivação da Fase 2)', () => {
    // média seria 124, mediana conta a história real
    expect(median([10, 12, 350])).toBe(12)
  })

  it('lista vazia retorna null', () => {
    expect(median([])).toBeNull()
  })
})

describe('normalizeSchoolKey', () => {
  it('gera chave comparável entre nome e slug de escolas', () => {
    expect(normalizeSchoolKey('Química Fácil')).toBe('quimica-facil')
    expect(normalizeSchoolKey('  QUIMICA facil  ')).toBe('quimica-facil')
  })

  it('retorna null para valores sem chave útil', () => {
    expect(normalizeSchoolKey('')).toBeNull()
    expect(normalizeSchoolKey(null)).toBeNull()
  })
})
