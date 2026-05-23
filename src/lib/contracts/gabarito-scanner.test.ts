import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'

import {
  parseProjetoStudent,
  tryParseProjetoStudent,
} from './gabarito-scanner'

describe('parseProjetoStudent', () => {
  describe('formato moderno (pós 2026-03)', () => {
    it('aceita shape completo (INTEGRADO/Diagnóstica)', () => {
      // Reproduzido do JSONB real do Luis Felipe (matricula mascarada)
      const input = {
        id: 'merged-09.XXXX-X-1779481866448',
        studentNumber: '09.XXXX-X',
        studentName: 'mocked',
        turma: 'Terceirão',
        fezDia1: true,
        fezDia2: true,
        pageNumber: 5,
        correctAnswers: 103,
        wrongAnswers: 76,
        blankAnswers: 1,
        areaCorrectAnswers: { LC: 31, CH: 33, CN: 21, MT: 18 },
        areaScores: { LC: 0, CH: 0, CN: 0, MT: 0 },
        answers: Array(180).fill('A'),
        score: 0,
      }
      const result = parseProjetoStudent(input)
      expect(result.correctAnswers).toBe(103)
      expect(result.areaCorrectAnswers?.LC).toBe(31)
      expect(result.fezDia1).toBe(true)
    })

    it('aceita blankAnswers=null (projetos legacy sem o campo)', () => {
      const input = { studentNumber: '123', blankAnswers: null }
      const result = parseProjetoStudent(input)
      expect(result.blankAnswers).toBeNull()
    })
  })

  describe('variantes legacy', () => {
    it('aceita matricula+name (sem camelCase)', () => {
      const input = {
        matricula: '214150129',
        name: 'mocked',
        turma: 'C',
        correctAnswers: 50,
        wrongAnswers: 130,
      }
      const result = parseProjetoStudent(input)
      expect(result.matricula).toBe('214150129')
    })

    it('aceita student_number snake_case', () => {
      const input = { student_number: '214260280', nome: 'mocked' }
      expect(() => parseProjetoStudent(input)).not.toThrow()
    })

    it('aceita questoes_erradas como array de números', () => {
      const input = {
        studentNumber: '123',
        questoes_erradas: [1, 5, 42, 100],
      }
      const result = parseProjetoStudent(input)
      expect(result.questoes_erradas).toEqual([1, 5, 42, 100])
    })

    it('aceita questoes_erradas como array de objetos', () => {
      const input = {
        studentNumber: '123',
        questoes_erradas: [
          { questao: 1, topico: 'álgebra' },
          { questao: 5 },
        ],
      }
      expect(() => parseProjetoStudent(input)).not.toThrow()
    })
  })

  describe('falha barulhento quando contrato quebra', () => {
    it('lança quando nenhum identificador presente', () => {
      const input = { studentName: 'sem id', correctAnswers: 100 }
      expect(() => parseProjetoStudent(input)).toThrow(ZodError)
      try {
        parseProjetoStudent(input)
      } catch (e) {
        expect((e as ZodError).message).toMatch(/identificador ausente/)
      }
    })

    it('lança quando correctAnswers é string (type drift)', () => {
      const input = { studentNumber: '123', correctAnswers: '50' }
      expect(() => parseProjetoStudent(input)).toThrow(ZodError)
    })

    it('lança quando areaCorrectAnswers.LC é string', () => {
      const input = {
        studentNumber: '123',
        areaCorrectAnswers: { LC: '31' },
      }
      expect(() => parseProjetoStudent(input)).toThrow(ZodError)
    })

    it('lança quando answers é array de números (esperado strings)', () => {
      const input = {
        studentNumber: '123',
        answers: [1, 2, 3],
      }
      expect(() => parseProjetoStudent(input)).toThrow(ZodError)
    })

    it('lança em null/undefined', () => {
      expect(() => parseProjetoStudent(null)).toThrow()
      expect(() => parseProjetoStudent(undefined)).toThrow()
    })

    it('lança em primitivos', () => {
      expect(() => parseProjetoStudent('string')).toThrow()
      expect(() => parseProjetoStudent(42)).toThrow()
    })
  })

  describe('evolução compatível (passthrough)', () => {
    it('preserva campos novos não-tipados', () => {
      const input = {
        studentNumber: '123',
        futureScannerField: 'novo',
        anotherExtension: 42,
      }
      const result = parseProjetoStudent(input) as Record<string, unknown>
      expect(result.futureScannerField).toBe('novo')
      expect(result.anotherExtension).toBe(42)
    })
  })
})

describe('tryParseProjetoStudent', () => {
  it('retorna o valor em caso de sucesso', () => {
    const result = tryParseProjetoStudent({ studentNumber: '123' })
    expect(result?.studentNumber).toBe('123')
  })

  it('retorna null em caso de falha', () => {
    const result = tryParseProjetoStudent({ studentName: 'sem id' })
    expect(result).toBeNull()
  })

  it('nunca lança', () => {
    expect(() => tryParseProjetoStudent(null)).not.toThrow()
    expect(() => tryParseProjetoStudent({})).not.toThrow()
    expect(() =>
      tryParseProjetoStudent({ correctAnswers: 'tipo errado' }),
    ).not.toThrow()
  })
})
