import { describe, it, expect } from 'vitest'
import {
  MatriculaInputSchema,
  CreateBlockInputSchema,
  validateMatricula,
  formatZodError,
} from './schemas'

describe('Validation Schemas', () => {
  describe('MatriculaInputSchema', () => {
    it('should validate correct matricula', () => {
      const result = MatriculaInputSchema.safeParse('214150129')
      expect(result.success).toBe(true)
    })

    it('should reject empty string', () => {
      const result = MatriculaInputSchema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('should reject matricula with letters', () => {
      const result = MatriculaInputSchema.safeParse('214150abc')
      expect(result.success).toBe(false)
    })

    it('should reject too short matricula', () => {
      const result = MatriculaInputSchema.safeParse('123')
      expect(result.success).toBe(false)
    })

    it('should reject too long matricula', () => {
      const result = MatriculaInputSchema.safeParse('123456789012345678901')
      expect(result.success).toBe(false)
    })
  })

  describe('CreateBlockInputSchema', () => {
    it('should validate correct block data', () => {
      const data = {
        cronogramaId: 'cron-123',
        diaSemana: 'segunda' as const,
        turno: 'manha' as const,
        slotIndex: 0,
        tipo: 'estudo' as const,
        titulo: 'Matemática',
      }

      const result = CreateBlockInputSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should validate blocked slot data', () => {
      const data = {
        cronogramaId: 'cron-123',
        diaSemana: 'segunda' as const,
        turno: 'manha' as const,
        slotIndex: 0,
        tipo: 'bloqueio' as const,
        titulo: 'Horário bloqueado',
      }

      const result = CreateBlockInputSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should reject invalid diaSemana', () => {
      const data = {
        cronogramaId: 'cron-123',
        diaSemana: 'invalid',
        turno: 'manha',
        slotIndex: 0,
        tipo: 'estudo',
        titulo: 'Matemática',
      }

      const result = CreateBlockInputSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should reject negative slotIndex', () => {
      const data = {
        cronogramaId: 'cron-123',
        diaSemana: 'segunda',
        turno: 'manha',
        slotIndex: -1,
        tipo: 'estudo',
        titulo: 'Matemática',
      }

      const result = CreateBlockInputSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should reject empty titulo', () => {
      const data = {
        cronogramaId: 'cron-123',
        diaSemana: 'segunda',
        turno: 'manha',
        slotIndex: 0,
        tipo: 'estudo',
        titulo: '',
      }

      const result = CreateBlockInputSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('validateMatricula helper', () => {
    it('should return success for valid matricula', () => {
      const result = validateMatricula('214150129')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('214150129')
      }
    })

    it('should return error for invalid matricula', () => {
      const result = validateMatricula('abc')
      expect(result.success).toBe(false)
    })
  })

  describe('formatZodError', () => {
    it('should format errors correctly', () => {
      const result = MatriculaInputSchema.safeParse('abc')
      if (!result.success) {
        const formatted = formatZodError(result.error)
        expect(formatted).toContain('Matrícula deve conter apenas números')
      }
    })
  })
})
