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
  alunoXTRIFromRow,
  alunoXTRIToRow,
} from '../types/supabase'
import type { AlunoXTRIRow } from '../types/supabase'
import { DISCIPLINAS, DISCIPLINAS_BY_CODE } from './mock-data/subjects'
import { getHorariosPorTurma } from './mock-data/schedules'
import { logRepository } from '../config/repository-config'
import {
  getCurrentProjectUser,
  isSchoolScopedProjectUser,
} from '../lib/project-user'
import { supabase } from '../lib/supabase'

// Garante sessão válida antes de writes — verifica com o servidor (evita clock skew)
async function assertSession(): Promise<void> {
  // getUser() faz requisição real ao servidor — detecta tokens expirados mesmo com
  // clock skew entre cliente e servidor (getSession() só usa relógio local)
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user || userError) {
    // Token expirado/inválido no servidor — tenta renovar
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshed.session) {
      throw new Error('Sessão expirada. Faça login novamente.')
    }
    // refreshSession() atualiza o cliente internamente — próxima request usa o novo token
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
        const projectUser = await getCurrentProjectUser()
        const scopedSchoolId = isSchoolScopedProjectUser(projectUser)
          ? projectUser?.schoolId ?? null
          : null

        // 1. Busca no Supabase (students) — fonte de verdade
        let studentQuery = supabase
          .from('students')
          .select('id, matricula, name, turma, school_id')
          .eq('matricula', matricula)
        
        if (scopedSchoolId) {
          studentQuery = studentQuery.eq('school_id', scopedSchoolId)
        }

        const { data: student } = await studentQuery.maybeSingle()

        if (student) {
          // Resolver nome da escola
          let escolaNome = 'Sem escola'
          if (student.school_id) {
            const { data: school } = await supabase
              .from('schools')
              .select('name')
              .eq('id', student.school_id)
              .maybeSingle()
            if (school) escolaNome = school.name
          }
          return {
            id: student.matricula,
            matricula: student.matricula,
            nome: student.name || 'Sem nome',
            turma: student.turma || '-',
            email: null,
            fotoFilename: `${student.matricula}.jpg`,
            escola: escolaNome,
            escolaId: student.school_id ?? null,
            createdAt: new Date(),
          }
        }

        // 2. Fallback: alunos_avulsos_cronograma
        if (scopedSchoolId) {
          return null
        }

        const { data: avulso } = await supabase
          .from('alunos_avulsos_cronograma')
          .select('*')
          .eq('matricula', matricula)
          .maybeSingle()

        if (avulso) {
          return alunoXTRIFromRow(avulso as AlunoXTRIRow)
        }

        return null
      },

      findByTurma: async (turma) => {
        const projectUser = await getCurrentProjectUser()
        const scopedSchoolId = isSchoolScopedProjectUser(projectUser)
          ? projectUser?.schoolId ?? null
          : null

        // Busca no Supabase primeiro
        let query = supabase
          .from('students')
          .select('matricula, name, turma, school_id')
          .eq('turma', turma)

        if (scopedSchoolId) {
          query = query.eq('school_id', scopedSchoolId)
        }

        const { data: dbStudents } = await query

        if (dbStudents && dbStudents.length > 0) {
          return dbStudents.map((s) => ({
            id: s.matricula,
            matricula: s.matricula,
            nome: s.name || 'Sem nome',
            turma: s.turma || '-',
            email: null,
            fotoFilename: `${s.matricula}.jpg`,
            escola: 'Supabase' as const,
            createdAt: new Date(),
          }))
        }

        return []
      },

      createAlunoXTRI: async (data) => {
        const row = alunoXTRIToRow(data)
        
        const { data: result, error } = await supabase
          .from('alunos_xtris')
          .insert(row)
          .select()
          .single()
        
        if (error) {
          throw new Error(`Failed to create aluno XTRI: ${error.message}`)
        }
        
        logRepository('Aluno XTRI criado no Supabase', { 
          id: result.id,
          matricula: result.matricula, 
          nome: result.nome 
        })
        
        return alunoXTRIFromRow(result as AlunoXTRIRow)
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
        await assertSession()

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
        await assertSession()

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
