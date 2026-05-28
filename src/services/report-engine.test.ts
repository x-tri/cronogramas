import { describe, it, expect } from 'vitest'
import { pickBestCurso } from './report-engine'
import type { CursoEncontrado } from '../types/report'

function makeCurso(overrides: Partial<CursoEncontrado> = {}): CursoEncontrado {
  return {
    id: 1,
    codigo: 1,
    nome: 'Direito',
    universidade: 'Universidade Federal do Rio Grande do Norte',
    campus: null,
    cidade: null,
    estado: 'RN',
    grau: null,
    turno: null,
    ...overrides,
  }
}

describe('pickBestCurso', () => {
  it('retorna o primeiro quando curso não tem campus nem turno (backward compat)', () => {
    const caico = makeCurso({ id: 1, campus: 'Campus de Caicó' })
    const natal = makeCurso({ id: 2, campus: 'Campus de Natal' })
    expect(pickBestCurso([caico, natal], { nome: 'Direito', universidade: 'UFRN', estado: 'RN' }))
      .toBe(caico)
  })

  it('prefere o campus certo quando o primeiro resultado é o campus errado', () => {
    const caico = makeCurso({ id: 1, campus: 'Campus de Caicó', turno: 'Matutino' })
    const natal = makeCurso({ id: 2, campus: 'Campus de Natal', turno: 'Matutino' })
    const result = pickBestCurso([caico, natal], {
      nome: 'Direito',
      universidade: 'UFRN',
      estado: 'RN',
      campus: 'Campus de Natal',
    })
    expect(result.campus).toBe('Campus de Natal')
  })

  it('prefere o turno certo quando o primeiro resultado é o turno errado', () => {
    const integral = makeCurso({ id: 1, campus: 'Campus de Natal', turno: 'Integral' })
    const matutino = makeCurso({ id: 2, campus: 'Campus de Natal', turno: 'Matutino' })
    const result = pickBestCurso([integral, matutino], {
      nome: 'Direito',
      universidade: 'UFRN',
      estado: 'RN',
      turno: 'Matutino',
    })
    expect(result.turno).toBe('Matutino')
  })

  it('exige match de campus E turno quando ambos estão informados', () => {
    const caicoMatutino = makeCurso({ id: 1, campus: 'Campus de Caicó', turno: 'Matutino' })
    const natalIntegral = makeCurso({ id: 2, campus: 'Campus de Natal', turno: 'Integral' })
    const natalMatutino = makeCurso({ id: 3, campus: 'Campus de Natal', turno: 'Matutino' })
    const result = pickBestCurso([caicoMatutino, natalIntegral, natalMatutino], {
      nome: 'Direito',
      universidade: 'UFRN',
      estado: 'RN',
      campus: 'Campus de Natal',
      turno: 'Matutino',
    })
    expect(result.id).toBe(3)
  })

  it('cai no primeiro quando nenhum row bate com o campus informado', () => {
    const caico = makeCurso({ id: 1, campus: 'Campus de Caicó' })
    const currais = makeCurso({ id: 2, campus: 'Campus de Currais Novos' })
    const result = pickBestCurso([caico, currais], {
      nome: 'Direito',
      universidade: 'UFRN',
      estado: 'RN',
      campus: 'Campus de Natal',
    })
    expect(result).toBe(caico)
  })
})
