import { describe, it, expect, beforeEach } from 'vitest'
import { createMockRepository, resetMockRepository } from './mock-repository'

describe('MockRepository', () => {
  let repository: ReturnType<typeof createMockRepository>

  beforeEach(() => {
    resetMockRepository()
    repository = createMockRepository()
  })

  describe('students', () => {
    it('should find student by matricula', async () => {
      const student = await repository.students.findByMatricula('214150129')

      expect(student).toBeDefined()
      expect(student?.matricula).toBe('214150129')
      expect(student?.nome).toBe('Arthur Dantas Vitorino')
      expect(student?.turma).toBe('A')
    })

    it('should return null for non-existent matricula', async () => {
      const student = await repository.students.findByMatricula('999999999')

      expect(student).toBeNull()
    })

    it('should find students by turma', async () => {
      const students = await repository.students.findByTurma('A')

      expect(students.length).toBeGreaterThan(0)
      expect(students.every(s => s.turma === 'A')).toBe(true)
    })
  })

  describe('schedules', () => {
    it('should get official schedule for turma', async () => {
      const schedule = await repository.schedules.getOfficialSchedule('A')

      expect(schedule.length).toBeGreaterThan(0)
      expect(schedule[0]).toHaveProperty('diaSemana')
      expect(schedule[0]).toHaveProperty('disciplina')
      expect(schedule[0]).toHaveProperty('turno')
    })
  })

  describe('cronogramas', () => {
    it('should create a cronograma', async () => {
      const data = {
        alunoId: '214150129',
        semanaInicio: new Date('2024-01-01'),
        semanaFim: new Date('2024-01-07'),
        observacoes: null,
        status: 'ativo' as const,
      }

      const cronograma = await repository.cronogramas.saveCronograma(data)

      expect(cronograma).toHaveProperty('id')
      expect(cronograma.alunoId).toBe(data.alunoId)
      expect(cronograma.status).toBe('ativo')
    })

    it('should get a cronograma by alunoId', async () => {
      const data = {
        alunoId: '214150129',
        semanaInicio: new Date('2024-01-01'),
        semanaFim: new Date('2024-01-07'),
        observacoes: null,
        status: 'ativo' as const,
      }

      await repository.cronogramas.saveCronograma(data)
      const found = await repository.cronogramas.getCronograma('214150129')

      expect(found).toBeDefined()
      expect(found?.alunoId).toBe('214150129')
    })

    it('should get cronograma for specific week', async () => {
      const data = {
        alunoId: '214150129',
        semanaInicio: new Date('2024-01-01'),
        semanaFim: new Date('2024-01-07'),
        observacoes: null,
        status: 'ativo' as const,
      }

      await repository.cronogramas.saveCronograma(data)
      const found = await repository.cronogramas.getCronograma(
        '214150129',
        new Date('2024-01-03')
      )

      expect(found).toBeDefined()
    })

    it('should return null for week outside range', async () => {
      const data = {
        alunoId: '214150129',
        semanaInicio: new Date('2024-01-01'),
        semanaFim: new Date('2024-01-07'),
        observacoes: null,
        status: 'ativo' as const,
      }

      await repository.cronogramas.saveCronograma(data)
      const found = await repository.cronogramas.getCronograma(
        '214150129',
        new Date('2024-02-01')
      )

      expect(found).toBeNull()
    })

    it('should get all cronogramas for aluno', async () => {
      const data1 = {
        alunoId: '214150129',
        semanaInicio: new Date('2024-01-01'),
        semanaFim: new Date('2024-01-07'),
        observacoes: null,
        status: 'ativo' as const,
      }
      const data2 = {
        alunoId: '214150129',
        semanaInicio: new Date('2024-01-08'),
        semanaFim: new Date('2024-01-14'),
        observacoes: null,
        status: 'ativo' as const,
      }

      await repository.cronogramas.saveCronograma(data1)
      await repository.cronogramas.saveCronograma(data2)

      const all = await repository.cronogramas.getAllCronogramas('214150129')

      expect(all.length).toBe(2)
    })

    it('should update cronograma', async () => {
      const data = {
        alunoId: '214150129',
        semanaInicio: new Date('2024-01-01'),
        semanaFim: new Date('2024-01-07'),
        observacoes: null,
        status: 'ativo' as const,
      }

      const created = await repository.cronogramas.saveCronograma(data)
      const updated = await repository.cronogramas.updateCronograma(created.id, {
        observacoes: 'Observação atualizada',
      })

      expect(updated.observacoes).toBe('Observação atualizada')
    })

    it('should throw error when updating non-existent cronograma', async () => {
      await expect(
        repository.cronogramas.updateCronograma('non-existent', {
          observacoes: 'test',
        })
      ).rejects.toThrow('Cronograma non-existent not found')
    })
  })

  describe('blocos', () => {
    let cronogramaId: string

    beforeEach(async () => {
      const cronograma = await repository.cronogramas.saveCronograma({
        alunoId: '214150129',
        semanaInicio: new Date('2024-01-01'),
        semanaFim: new Date('2024-01-07'),
        observacoes: null,
        status: 'ativo',
      })
      cronogramaId = cronograma.id
    })

    it('should create a bloco', async () => {
      const blocoData = {
        cronogramaId,
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

      const bloco = await repository.blocos.createBloco(blocoData)

      expect(bloco).toHaveProperty('id')
      expect(bloco.titulo).toBe('Matemática')
      expect(bloco.tipo).toBe('estudo')
    })

    it('should get blocos by cronogramaId', async () => {
      const blocoData = {
        cronogramaId,
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

      await repository.blocos.createBloco(blocoData)
      await repository.blocos.createBloco({
        ...blocoData,
        titulo: 'Física',
      })

      const blocos = await repository.blocos.getBlocos(cronogramaId)

      expect(blocos.length).toBe(2)
    })

    it('should update a bloco', async () => {
      const blocoData = {
        cronogramaId,
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

      const created = await repository.blocos.createBloco(blocoData)
      const updated = await repository.blocos.updateBloco(created.id, {
        titulo: 'Matemática Avançada',
        concluido: true,
      })

      expect(updated.titulo).toBe('Matemática Avançada')
      expect(updated.concluido).toBe(true)
    })

    it('should delete a bloco', async () => {
      const blocoData = {
        cronogramaId,
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

      const created = await repository.blocos.createBloco(blocoData)
      await repository.blocos.deleteBloco(created.id)

      const blocos = await repository.blocos.getBlocos(cronogramaId)
      expect(blocos.length).toBe(0)
    })

    it('should throw error when updating non-existent bloco', async () => {
      await expect(
        repository.blocos.updateBloco('non-existent', { titulo: 'test' })
      ).rejects.toThrow('Bloco non-existent not found')
    })
  })

  describe('subjects', () => {
    it('should get all subjects', async () => {
      const subjects = await repository.subjects.getAllSubjects()

      expect(subjects.length).toBeGreaterThan(0)
      expect(subjects[0]).toHaveProperty('codigo')
      expect(subjects[0]).toHaveProperty('nome')
      expect(subjects[0]).toHaveProperty('area')
    })

    it('should get subject by code', async () => {
      const subject = await repository.subjects.getSubjectByCode('MAT')

      expect(subject).toBeDefined()
      expect(subject?.codigo).toBe('MAT')
    })

    it('should return null for non-existent subject code', async () => {
      const subject = await repository.subjects.getSubjectByCode('XXX')

      expect(subject).toBeNull()
    })
  })
})
