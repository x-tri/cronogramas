import { describe, it, expect } from 'vitest'
import { createMockRepository } from '../data/mock-repository'
import { createStudentService } from './student-service'
import { ok, err, unwrapOr } from './result'

describe('StudentService', () => {
  const repository = createMockRepository()
  const service = createStudentService(repository)

  describe('validateMatricula', () => {
    it('should validate correct matricula', () => {
      const result = service.validateMatricula('214150129')
      expect(result.success).toBe(true)
    })

    it('should reject empty matricula', () => {
      const result = service.validateMatricula('')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should reject matricula with letters', () => {
      const result = service.validateMatricula('214150abc')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_MATRICULA')
      }
    })

    it('should reject too short matricula', () => {
      const result = service.validateMatricula('123')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('findByMatricula', () => {
    it('should find existing student', async () => {
      const result = await service.findByMatricula('214150129')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.matricula).toBe('214150129')
        expect(result.data.nome).toBe('Arthur Dantas Vitorino')
      }
    })

    it('should return error for non-existent student', async () => {
      const result = await service.findByMatricula('999999999')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('STUDENT_NOT_FOUND')
      }
    })

    it('should return error for invalid matricula', async () => {
      const result = await service.findByMatricula('abc')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_MATRICULA')
      }
    })
  })

  describe('findByTurma', () => {
    it('should find students by turma', async () => {
      const result = await service.findByTurma('A')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0)
        expect(result.data.every(s => s.turma === 'A')).toBe(true)
      }
    })
  })
})

describe('Result helpers', () => {
  describe('unwrapOr', () => {
    it('should return data on success', () => {
      const result = ok(42)
      expect(unwrapOr(result, 0)).toBe(42)
    })

    it('should return default on error', () => {
      const result = err(new Error('fail'))
      expect(unwrapOr(result, 0)).toBe(0)
    })
  })
})
