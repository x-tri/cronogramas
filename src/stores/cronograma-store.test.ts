import { describe, it, expect, beforeEach } from 'vitest'
import { useCronogramaStore } from './cronograma-store'
import { resetRepository, initializeRepository } from '../data/factory'
import { resetMockRepository } from '../data/mock-repository'

describe('useCronogramaStore', () => {
  beforeEach(() => {
    // Reset store
    useCronogramaStore.getState().reset()
    // Reset repository
    resetMockRepository()
    resetRepository()
    // Initialize repository for tests
    initializeRepository()
  })

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useCronogramaStore.getState()

      expect(state.currentStudent).toBeNull()
      expect(state.officialSchedule).toEqual([])
      expect(state.cronograma).toBeNull()
      expect(state.blocks).toEqual([])
      expect(state.isLoadingStudent).toBe(false)
      expect(state.isSaving).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('student actions', () => {
    it('should set student', () => {
      const store = useCronogramaStore.getState()
      const mockStudent = {
        id: '1',
        matricula: '214150129',
        nome: 'Test Student',
        turma: '2A',
        email: null,
        fotoFilename: null,
        escola: 'MARISTA' as const,
        createdAt: new Date(),
      }

      store.setStudent(mockStudent)

      expect(useCronogramaStore.getState().currentStudent).toEqual(mockStudent)
    })

    it('should set official schedule', () => {
      const store = useCronogramaStore.getState()
      const mockSchedule = [
        {
          id: '1',
          turma: '2A',
          diaSemana: 'segunda' as const,
          horarioInicio: '07:15',
          horarioFim: '08:05',
          disciplina: 'Matemática',
          professor: 'Prof. Test',
          turno: 'manha' as const,
        },
      ]

      store.setOfficialSchedule(mockSchedule)

      expect(useCronogramaStore.getState().officialSchedule).toEqual(mockSchedule)
    })
  })

  describe('cronograma actions', () => {
    it('should create and load a cronograma', async () => {
      const store = useCronogramaStore.getState()
      
      // Set student first
      store.setStudent({
        id: '214150129',
        matricula: '214150129',
        nome: 'Test',
        turma: '2A',
        email: null,
        escola: 'MARISTA' as const,
        fotoFilename: null,
        createdAt: new Date(),
      })

      const cronograma = await store.createCronograma(
        '214150129',
        new Date('2024-01-01'),
        new Date('2024-01-07')
      )

      expect(cronograma).toHaveProperty('id')
      expect(cronograma.alunoId).toBe('214150129')
      expect(useCronogramaStore.getState().cronograma).toEqual(cronograma)
    })

    it('should load cronograma versions', async () => {
      const store = useCronogramaStore.getState()
      
      store.setStudent({
        id: '214150129',
        matricula: '214150129',
        nome: 'Test',
        turma: '2A',
        email: null,
        fotoFilename: null,
        escola: 'MARISTA' as const,
        createdAt: new Date(),
      })

      await store.createCronograma(
        '214150129',
        new Date('2024-01-01'),
        new Date('2024-01-07')
      )

      await store.loadCronogramaVersions('214150129')

      expect(useCronogramaStore.getState().cronogramaVersions.length).toBeGreaterThan(0)
    })
  })

  describe('block actions', () => {
    beforeEach(async () => {
      const store = useCronogramaStore.getState()
      
      store.setStudent({
        id: '214150129',
        matricula: '214150129',
        nome: 'Test',
        turma: '2A',
        email: null,
        fotoFilename: null,
        escola: 'MARISTA' as const,
        createdAt: new Date(),
      })

      await store.createCronograma(
        '214150129',
        new Date('2024-01-01'),
        new Date('2024-01-07')
      )
    })

    it('should add a block', async () => {
      const store = useCronogramaStore.getState()
      const cronograma = store.cronograma!

      const blockData = {
        cronogramaId: cronograma.id,
        diaSemana: 'segunda' as const,
        horarioInicio: '07:15',
        horarioFim: '08:05',
        turno: 'manha' as const,
        tipo: 'estudo' as const,
        titulo: 'Matemática',
        descricao: null,
        disciplinaCodigo: null,
        cor: null,
        prioridade: 0 as const,
        concluido: false,
      }

      const block = await store.addBlock(blockData)

      expect(block).toHaveProperty('id')
      expect(useCronogramaStore.getState().blocks).toContainEqual(block)
    })

    it('should update a block', async () => {
      const store = useCronogramaStore.getState()
      const cronograma = store.cronograma!

      const block = await store.addBlock({
        cronogramaId: cronograma.id,
        diaSemana: 'segunda' as const,
        horarioInicio: '07:15',
        horarioFim: '08:05',
        turno: 'manha' as const,
        tipo: 'estudo' as const,
        titulo: 'Matemática',
        descricao: null,
        disciplinaCodigo: null,
        cor: null,
        prioridade: 0 as const,
        concluido: false,
      })

      const updated = await store.updateBlock(block.id, {
        titulo: 'Física',
        concluido: true,
      })

      expect(updated.titulo).toBe('Física')
      expect(updated.concluido).toBe(true)
    })

    it('should remove a block', async () => {
      const store = useCronogramaStore.getState()
      const cronograma = store.cronograma!

      const block = await store.addBlock({
        cronogramaId: cronograma.id,
        diaSemana: 'segunda' as const,
        horarioInicio: '07:15',
        horarioFim: '08:05',
        turno: 'manha' as const,
        tipo: 'estudo' as const,
        titulo: 'Matemática',
        descricao: null,
        disciplinaCodigo: null,
        cor: null,
        prioridade: 0 as const,
        concluido: false,
      })

      await store.removeBlock(block.id)

      expect(useCronogramaStore.getState().blocks).not.toContainEqual(block)
    })

    it('should move a block to different slot', async () => {
      const store = useCronogramaStore.getState()
      const cronograma = store.cronograma!

      const block = await store.addBlock({
        cronogramaId: cronograma.id,
        diaSemana: 'segunda' as const,
        horarioInicio: '07:15',
        horarioFim: '08:05',
        turno: 'manha' as const,
        tipo: 'estudo' as const,
        titulo: 'Matemática',
        descricao: null,
        disciplinaCodigo: null,
        cor: null,
        prioridade: 0 as const,
        concluido: false,
      })

      await store.moveBlock(block.id, 'terca', 'tarde', 0)

      const movedBlock = useCronogramaStore.getState().blocks.find(b => b.id === block.id)
      expect(movedBlock?.diaSemana).toBe('terca')
      expect(movedBlock?.turno).toBe('tarde')
    })
  })

  describe('loading states', () => {
    it('should set loading states', () => {
      const store = useCronogramaStore.getState()

      store.setLoadingStudent(true)
      expect(useCronogramaStore.getState().isLoadingStudent).toBe(true)

      store.setLoadingStudent(false)
      expect(useCronogramaStore.getState().isLoadingStudent).toBe(false)
    })

    it('should set saving state', () => {
      const store = useCronogramaStore.getState()

      store.setSaving(true)
      expect(useCronogramaStore.getState().isSaving).toBe(true)

      store.setSaving(false)
      expect(useCronogramaStore.getState().isSaving).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const store = useCronogramaStore.getState()

      store.setStudent({
        id: '1',
        matricula: '214150129',
        nome: 'Test',
        turma: '2A',
        email: null,
        fotoFilename: null,
        escola: 'MARISTA' as const,
        createdAt: new Date(),
      })
      store.setSaving(true)

      store.reset()

      const state = useCronogramaStore.getState()
      expect(state.currentStudent).toBeNull()
      expect(state.isSaving).toBe(false)
    })
  })
})
