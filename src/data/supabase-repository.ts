import type { DataRepository } from './repository'
import type {
  CronogramaRow,
  BlocoCronogramaRow,
} from '../types/supabase'
import type { Aluno } from '../types/domain'
import {
  cronogramaFromRow,
  cronogramaToRow,
  blocoFromRow,
  blocoToRow,
} from '../types/supabase'
import { ALL_STUDENTS } from './mock-data/students'
import { DISCIPLINAS, DISCIPLINAS_BY_CODE } from './mock-data/subjects'
import { getHorariosPorTurma } from './mock-data/schedules'
import { logRepository } from '../config/repository-config'
import { supabase } from '../lib/supabase'

// Supabase client é inicializado lazy no próprio módulo supabase.ts
const XTRI_STUDENTS_STORAGE_KEY = 'xtri-alunos-xtris'

type PersistedAlunoXTRI = Omit<Aluno, 'createdAt'> & {
  createdAt: string
}

function loadPersistedXTRIStudents(): PersistedAlunoXTRI[] {
  try {
    const raw = localStorage.getItem(XTRI_STUDENTS_STORAGE_KEY)
    if (!raw) return []

    return JSON.parse(raw) as PersistedAlunoXTRI[]
  } catch (error) {
    console.error('[Supabase] Erro ao carregar alunos XTRI do localStorage:', error)
    return []
  }
}

function savePersistedXTRIStudents(students: PersistedAlunoXTRI[]): void {
  try {
    localStorage.setItem(XTRI_STUDENTS_STORAGE_KEY, JSON.stringify(students))
  } catch (error) {
    console.error('[Supabase] Erro ao salvar alunos XTRI no localStorage:', error)
  }
}

function mapPersistedXTRIStudent(student: PersistedAlunoXTRI): Aluno {
  return {
    ...student,
    createdAt: new Date(student.createdAt),
  }
}

export function createSupabaseRepository(): DataRepository {
  logRepository('Inicializando Supabase repository')

  // Verifica se está configurado no momento da criação
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  
  if (!url || !key) {
    throw new Error(
      'Supabase repository cannot be created: VITE_SUPABASE_URL and VITE_SUPABASE_KEY must be set'
    )
  }

  const repo: DataRepository = {
    students: {
      findByMatricula: async (matricula) => {
        // Busca nos alunos MARISTA (mock)
        const found = ALL_STUDENTS.find((s) => s.matricula === matricula)
        if (found) {
          const aluno: Aluno = {
            id: found.matricula,
            matricula: found.matricula,
            nome: found.nome,
            turma: found.turma,
            email: null,
            fotoFilename: `${found.matricula}.jpg`,
            escola: 'MARISTA',
            createdAt: new Date(),
          }
          return aluno
        }
        
        // Busca nos alunos XTRI persistidos localmente.
        const persistedStudents = loadPersistedXTRIStudents()
        const foundXTRI = persistedStudents.find((student) => student.matricula === matricula)
        if (foundXTRI) {
          return mapPersistedXTRIStudent(foundXTRI)
        }
        
        return null
      },

      findByTurma: async (turma) => {
        // TODO: Migrar para Supabase quando tabela existir
        const students = ALL_STUDENTS.filter((s) => s.turma === turma)
        return students.map((s) => ({
          id: s.matricula,
          matricula: s.matricula,
          nome: s.nome,
          turma: s.turma,
          email: null,
          fotoFilename: `${s.matricula}.jpg`,
          escola: 'MARISTA' as const,
          createdAt: new Date(),
        }))
      },

      createAlunoXTRI: async (data) => {
        const aluno: Aluno = {
          id: crypto.randomUUID(),
          matricula: data.matricula,
          nome: data.nome,
          turma: data.turma,
          email: data.email,
          fotoFilename: data.fotoFilename,
          escola: 'XTRI',
          createdAt: new Date(),
        }

        const persistedStudents = loadPersistedXTRIStudents()
        persistedStudents.push({
          ...aluno,
          createdAt: aluno.createdAt.toISOString(),
        })
        savePersistedXTRIStudents(persistedStudents)

        logRepository('Aluno XTRI criado localmente (modo Supabase)', {
          id: aluno.id,
          matricula: aluno.matricula,
          nome: aluno.nome,
        })

        return aluno
      },
    },

    schedules: {
      getOfficialSchedule: async (turma) => {
        // TODO: Migrar para Supabase quando tabela existir
        return getHorariosPorTurma(turma)
      },
    },

    cronogramas: {
      getCronograma: async (alunoId, weekStart) => {
        
        
        let query = supabase
          .from('cronogramas')
          .select('*')
          .eq('aluno_id', alunoId)
          .eq('status', 'ativo')

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

        if (!data) return null

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

        logRepository('Cronograma criado no Supabase', { id: data.id })
        return cronogramaFromRow(data as CronogramaRow)
      },

      deleteCronograma: async (id) => {
        const { error } = await supabase
          .from('cronogramas')
          .delete()
          .eq('id', id)

        if (error) {
          throw new Error(`Failed to delete cronograma: ${error.message}`)
        }

        logRepository('Cronograma deletado no Supabase', { id })
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

        logRepository('Bloco criado no Supabase', { id: data.id })
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

    subjects: {
      getAllSubjects: async () => {
        // TODO: Migrar para Supabase quando tabela existir
        return DISCIPLINAS
      },

      getSubjectByCode: async (codigo) => {
        // TODO: Migrar para Supabase quando tabela existir
        return DISCIPLINAS_BY_CODE.get(codigo) ?? null
      },
    },
  }

  return repo
}
