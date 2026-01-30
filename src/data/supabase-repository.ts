import { supabase } from '../lib/supabase'
import type { DataRepository } from './repository'
import type {
  CronogramaRow,
  BlocoCronogramaRow,
} from '../types/supabase'
import {
  cronogramaFromRow,
  cronogramaToRow,
  blocoFromRow,
  blocoToRow,
} from '../types/supabase'
import { ALL_STUDENTS } from './mock-data/students'
import { DISCIPLINAS, DISCIPLINAS_BY_CODE } from './mock-data/subjects'
import { getHorariosPorTurma } from './mock-data/schedules'
import type { Aluno } from '../types/domain'

export function createSupabaseRepository(): DataRepository {
  return {
    // Students still use mock data (would need separate Supabase table)
    students: {
      findByMatricula: async (matricula) => {
        const found = ALL_STUDENTS.find((s) => s.matricula === matricula)
        if (!found) return null

        const aluno: Aluno = {
          id: found.matricula,
          matricula: found.matricula,
          nome: found.nome,
          turma: found.turma,
          email: null,
          fotoFilename: `${found.matricula}.jpg`,
          createdAt: new Date(),
        }
        return aluno
      },

      findByTurma: async (turma) => {
        const students = ALL_STUDENTS.filter((s) => s.turma === turma)
        return students.map((s) => ({
          id: s.matricula,
          matricula: s.matricula,
          nome: s.nome,
          turma: s.turma,
          email: null,
          fotoFilename: `${s.matricula}.jpg`,
          createdAt: new Date(),
        }))
      },
    },

    // Schedules still use mock data (would need separate Supabase table)
    schedules: {
      getOfficialSchedule: async (turma) => {
        return getHorariosPorTurma(turma)
      },
    },

    // Cronogramas use Supabase
    cronogramas: {
      getCronograma: async (alunoId, weekStart) => {
        let query = supabase
          .from('cronogramas')
          .select('*')
          .eq('aluno_id', alunoId)
          .eq('status', 'ativo')

        // If weekStart provided, filter by week containing that date
        if (weekStart) {
          const weekStartStr = weekStart.toISOString().split('T')[0]
          query = query
            .lte('semana_inicio', weekStartStr)
            .gte('semana_fim', weekStartStr)
        }

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) {
          throw new Error(`Failed to get cronograma: ${error.message}`)
        }

        if (!data) {
          return null
        }

        return cronogramaFromRow(data as CronogramaRow)
      },

      getAllCronogramas: async (alunoId) => {
        const { data, error } = await supabase
          .from('cronogramas')
          .select('*')
          .eq('aluno_id', alunoId)
          .order('created_at', { ascending: false })

        if (error) {
          throw new Error(`Failed to get cronogramas: ${error.message}`)
        }

        return (data as CronogramaRow[]).map(cronogramaFromRow)
      },

      saveCronograma: async (cronogramaData) => {
        const row = cronogramaToRow(cronogramaData)

        const { data, error } = await supabase
          .from('cronogramas')
          .insert(row)
          .select()
          .single()

        if (error) {
          throw new Error(`Failed to save cronograma: ${error.message}`)
        }

        return cronogramaFromRow(data as CronogramaRow)
      },

      updateCronograma: async (id, updates) => {
        const updateData: Partial<CronogramaRow> = {}

        if (updates.observacoes !== undefined) {
          updateData.observacoes = updates.observacoes
        }
        if (updates.status !== undefined) {
          updateData.status = updates.status
        }
        if (updates.semanaInicio !== undefined) {
          updateData.semana_inicio = updates.semanaInicio
            .toISOString()
            .split('T')[0]
        }
        if (updates.semanaFim !== undefined) {
          updateData.semana_fim = updates.semanaFim.toISOString().split('T')[0]
        }

        const { data, error } = await supabase
          .from('cronogramas')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          throw new Error(`Failed to update cronograma: ${error.message}`)
        }

        return cronogramaFromRow(data as CronogramaRow)
      },
    },

    // Blocos use Supabase
    blocos: {
      getBlocos: async (cronogramaId) => {
        const { data, error } = await supabase
          .from('blocos_cronograma')
          .select('*')
          .eq('cronograma_id', cronogramaId)
          .order('created_at', { ascending: true })

        if (error) {
          throw new Error(`Failed to get blocos: ${error.message}`)
        }

        return (data as BlocoCronogramaRow[]).map(blocoFromRow)
      },

      createBloco: async (blocoData) => {
        const row = blocoToRow(blocoData)

        const { data, error } = await supabase
          .from('blocos_cronograma')
          .insert(row)
          .select()
          .single()

        if (error) {
          throw new Error(`Failed to create bloco: ${error.message}`)
        }

        return blocoFromRow(data as BlocoCronogramaRow)
      },

      updateBloco: async (id, updates) => {
        const updateData: Partial<BlocoCronogramaRow> = {}

        if (updates.diaSemana !== undefined) {
          updateData.dia_semana = updates.diaSemana
        }
        if (updates.horarioInicio !== undefined) {
          updateData.horario_inicio = updates.horarioInicio
        }
        if (updates.horarioFim !== undefined) {
          updateData.horario_fim = updates.horarioFim
        }
        if (updates.turno !== undefined) {
          updateData.turno = updates.turno
        }
        if (updates.tipo !== undefined) {
          updateData.tipo = updates.tipo
        }
        if (updates.titulo !== undefined) {
          updateData.titulo = updates.titulo
        }
        if (updates.descricao !== undefined) {
          updateData.descricao = updates.descricao
        }
        if (updates.disciplinaCodigo !== undefined) {
          updateData.disciplina_codigo = updates.disciplinaCodigo
        }
        if (updates.cor !== undefined) {
          updateData.cor = updates.cor
        }
        if (updates.prioridade !== undefined) {
          updateData.prioridade = updates.prioridade
        }
        if (updates.concluido !== undefined) {
          updateData.concluido = updates.concluido
        }

        const { data, error } = await supabase
          .from('blocos_cronograma')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          throw new Error(`Failed to update bloco: ${error.message}`)
        }

        return blocoFromRow(data as BlocoCronogramaRow)
      },

      deleteBloco: async (id) => {
        const { error } = await supabase
          .from('blocos_cronograma')
          .delete()
          .eq('id', id)

        if (error) {
          throw new Error(`Failed to delete bloco: ${error.message}`)
        }
      },
    },

    // Subjects still use mock data
    subjects: {
      getAllSubjects: async () => {
        return DISCIPLINAS
      },

      getSubjectByCode: async (codigo) => {
        return DISCIPLINAS_BY_CODE.get(codigo) ?? null
      },
    },
  }
}
