import { supabase } from '../../lib/supabase'
import type { SupabaseStudent } from '../../types/supabase'

export async function getStudentByMatricula(
  matricula: string,
): Promise<SupabaseStudent | null> {
  console.log('[getStudentByMatricula] Buscando student com matrícula:', matricula)

  // Tentar buscar exatamente como foi passado
  const { data, error } = await supabase
    .from('students')
    .select('*,school:schools(*)')
    .eq('matricula', matricula)
    .maybeSingle()

  if (data) {
    console.log('[getStudentByMatricula] Student encontrado:', data)
    return data
  }

  if (error) {
    console.error('[getStudentByMatricula] Error fetching student:', error)
  }

  // Se não encontrou, tentar com zeros à esquerda removidos
  const normalizedMatricula = matricula.trim().replace(/^0+/, '') || '0'
  if (normalizedMatricula !== matricula.trim()) {
    console.log(
      '[getStudentByMatricula] Tentando com matrícula normalizada:',
      normalizedMatricula,
    )
    const { data: normalizedData, error: normalizedError } = await supabase
      .from('students')
      .select('*')
      .eq('matricula', normalizedMatricula)
      .maybeSingle()

    if (normalizedData) {
      console.log(
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

  console.log(
    '[getStudentByMatricula] Student não encontrado para matrícula:',
    matricula,
  )
  return null
}
