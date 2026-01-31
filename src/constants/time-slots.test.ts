import { describe, it, expect } from 'vitest'
import {
  TURNOS_CONFIG,
  DIAS_CONFIG,
  getSlotIndex,
  getSlotByIndex,
  getTurnoFromTime,
  formatTimeRange,
} from './time-slots'

describe('time-slots', () => {
  describe('TURNOS_CONFIG', () => {
    it('should have correct structure for manha', () => {
      expect(TURNOS_CONFIG.manha).toHaveProperty('label', 'Manhã')
      expect(TURNOS_CONFIG.manha).toHaveProperty('inicio', '07:15')
      expect(TURNOS_CONFIG.manha).toHaveProperty('fim', '13:35')
      expect(TURNOS_CONFIG.manha.slots).toHaveLength(7)
    })

    it('should have correct structure for tarde', () => {
      expect(TURNOS_CONFIG.tarde).toHaveProperty('label', 'Tarde')
      expect(TURNOS_CONFIG.tarde).toHaveProperty('inicio', '14:35')
      expect(TURNOS_CONFIG.tarde).toHaveProperty('fim', '19:05')
      expect(TURNOS_CONFIG.tarde.slots).toHaveLength(5)
    })

    it('should have correct structure for noite', () => {
      expect(TURNOS_CONFIG.noite).toHaveProperty('label', 'Noite')
      expect(TURNOS_CONFIG.noite).toHaveProperty('inicio', '19:30')
      expect(TURNOS_CONFIG.noite).toHaveProperty('fim', '22:30')
      expect(TURNOS_CONFIG.noite.slots).toHaveLength(3)
    })

    it('should have valid slot times', () => {
      for (const [, config] of Object.entries(TURNOS_CONFIG)) {
        for (const slot of config.slots) {
          expect(slot.inicio).toMatch(/^\d{2}:\d{2}$/)
          expect(slot.fim).toMatch(/^\d{2}:\d{2}$/)
        }
      }
    })
  })

  describe('DIAS_CONFIG', () => {
    it('should have correct config for weekdays', () => {
      expect(DIAS_CONFIG.segunda.temAula).toBe(true)
      expect(DIAS_CONFIG.terca.temAula).toBe(true)
      expect(DIAS_CONFIG.terca.temVespertino).toBe(true)
      expect(DIAS_CONFIG.quarta.temAula).toBe(true)
      expect(DIAS_CONFIG.quinta.temAula).toBe(true)
      expect(DIAS_CONFIG.sexta.temAula).toBe(true)
    })

    it('should have correct config for weekend', () => {
      expect(DIAS_CONFIG.sabado.temAula).toBe(false)
      expect(DIAS_CONFIG.sabado.livre).toBe(true)
      expect(DIAS_CONFIG.domingo.temAula).toBe(false)
      expect(DIAS_CONFIG.domingo.livre).toBe(true)
    })
  })

  describe('getSlotIndex', () => {
    it('should return correct index for existing slot', () => {
      expect(getSlotIndex('manha', '07:15')).toBe(0)
      expect(getSlotIndex('manha', '08:05')).toBe(1)
      expect(getSlotIndex('manha', '13:35')).toBe(-1) // horario_fim, não está nos slots
    })

    it('should return -1 for non-existent slot', () => {
      expect(getSlotIndex('manha', '99:99')).toBe(-1)
    })
  })

  describe('getSlotByIndex', () => {
    it('should return correct slot for valid index', () => {
      const slot = getSlotByIndex('manha', 0)
      expect(slot).toEqual({ inicio: '07:15', fim: '08:05' })
    })

    it('should return null for invalid index', () => {
      expect(getSlotByIndex('manha', 99)).toBeNull()
      expect(getSlotByIndex('manha', -1)).toBeNull()
    })
  })

  describe('getTurnoFromTime', () => {
    it('should return manha for morning times', () => {
      expect(getTurnoFromTime('07:15')).toBe('manha')
      expect(getTurnoFromTime('10:00')).toBe('manha')
      expect(getTurnoFromTime('13:30')).toBe('manha')
    })

    it('should return tarde for afternoon times', () => {
      expect(getTurnoFromTime('14:35')).toBe('tarde')
      expect(getTurnoFromTime('16:00')).toBe('tarde')
      expect(getTurnoFromTime('19:00')).toBe('tarde')
    })

    it('should return noite for evening times', () => {
      expect(getTurnoFromTime('19:30')).toBe('noite')
      expect(getTurnoFromTime('21:00')).toBe('noite')
    })

    it('should return null for times outside all turnos', () => {
      expect(getTurnoFromTime('03:00')).toBeNull()
      expect(getTurnoFromTime('23:00')).toBeNull()
    })
  })

  describe('formatTimeRange', () => {
    it('should format time range correctly', () => {
      expect(formatTimeRange('07:15', '08:05')).toBe('07:15 - 08:05')
    })
  })
})
