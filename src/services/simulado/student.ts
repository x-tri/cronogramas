import { simuladoSupabase as supabase } from '../../lib/simulado-supabase'
import {
  getCurrentProjectUser,
  isSchoolScopedProjectUser,
} from '../../lib/project-user'
import type { SupabaseStudent } from '../../types/supabase'
import { simuladoLog } from './logger'

export async function getStudentByMatricula(
  matricula: string,
): Promise<SupabaseStudent | null> {
  simuladoLog('[getStudentByMatricula] Buscando student com matrícula:', matricula)
  const projectUser = await getCurrentProjectUser()
  const scopedSchoolId = isSchoolScopedProjectUser(projectUser)
    ? projectUser?.schoolId ?? null
    : null

  // Tentar buscar exatamente como foi passado
  let exactQuery = supabase
    .from('students')
    .select('*,school:schools(*)')
    .eq('matricula', matricula)

  if (scopedSchoolId) {
    exactQuery = exactQuery.eq('school_id', scopedSchoolId)
  }

  const { data, error } = await exactQuery.maybeSingle()

  if (data) {
    simuladoLog('[getStudentByMatricula] Student encontrado:', data)
    return data
  }

  if (error) {
    console.error('[getStudentByMatricula] Error fetching student:', error)
  }

  // Se não encontrou, tentar com zeros à esquerda removidos
  const normalizedMatricula = matricula.trim().replace(/^0+/, '') || '0'
  if (normalizedMatricula !== matricula.trim()) {
    simuladoLog(
      '[getStudentByMatricula] Tentando com matrícula normalizada:',
      normalizedMatricula,
    )
    let normalizedQuery = supabase
      .from('students')
      .select('*,school:schools(*)')
      .eq('matricula', normalizedMatricula)

    if (scopedSchoolId) {
      normalizedQuery = normalizedQuery.eq('school_id', scopedSchoolId)
    }

    const { data: normalizedData, error: normalizedError } = await normalizedQuery.maybeSingle()

    if (normalizedData) {
      simuladoLog(
        '[getStudentByMatricula] Student encontrado com matrícula normalizada:',
        normalizedData,
      )
      return normalizedData
    }

    if (normalizedError) {
      console.error(
        '[getStudentByMatricula] Error fetching student with normalized matricula:',
        normalizedError,
      )
    }
  }

  simuladoLog(
    '[getStudentByMatricula] Student não encontrado para matrícula:',
    matricula,
  )
  return null
}
