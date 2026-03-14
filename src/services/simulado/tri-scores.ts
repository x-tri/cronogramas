import { supabase } from '../../lib/supabase'

/**
 * Busca as notas TRI da tabela student_answers
 * PRIORIDADE: Sempre buscar pela matrícula primeiro
 */
export async function getTRIScoresFromStudentAnswers(
  matricula: string,
  sheetCode?: string,
): Promise<{
  tri_lc: number | null
  tri_ch: number | null
  tri_cn: number | null
  tri_mt: number | null
} | null> {
  console.log(
    '[getTRIScoresFromStudentAnswers] Buscando notas TRI - matrícula:',
    matricula,
    'sheet_code:',
    sheetCode,
  )

  if (!matricula && !sheetCode) {
    console.log('[getTRIScoresFromStudentAnswers] Nenhum identificador fornecido')
    return null
  }

  // ========== PRIORIDADE 1: Buscar pela matrícula (student_number) ==========
  if (matricula) {
    const normalizedMatricula = matricula.trim().replace(/^0+/, '') || '0'

    console.log(
      '[getTRIScoresFromStudentAnswers] Tentativa 1: Buscando por matrícula:',
      matricula,
    )

    // Tentar buscar como string (text)
    const { data, error } = await supabase
      .from('student_answers')
      .select(
        'tri_lc, tri_ch, tri_cn, tri_mt, student_number, student_id, created_at, student_name',
      )
      .eq('student_number', matricula)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log('[getTRIScoresFromStudentAnswers] Resultado busca matrícula:', {
      encontrado: !!data,
      erro: error?.message,
    })

    if (!error && data) {
      console.log(
        '[getTRIScoresFromStudentAnswers] ✅ Notas TRI encontradas (matrícula):',
        {
          student_number: data.student_number,
          tri_lc: data.tri_lc,
          tri_ch: data.tri_ch,
          tri_cn: data.tri_cn,
          tri_mt: data.tri_mt,
        },
      )
      return {
        tri_lc: data.tri_lc,
        tri_ch: data.tri_ch,
        tri_cn: data.tri_cn,
        tri_mt: data.tri_mt,
      }
    }

    // Se não encontrou, tentar com matrícula normalizada (sem zeros à esquerda)
    if (normalizedMatricula !== matricula.trim()) {
      console.log(
        '[getTRIScoresFromStudentAnswers] Tentativa 1b: Buscando por matrícula normalizada:',
        normalizedMatricula,
      )

      const { data: normalizedData, error: normalizedError } = await supabase
        .from('student_answers')
        .select(
          'tri_lc, tri_ch, tri_cn, tri_mt, student_number, student_id, created_at, student_name',
        )
        .eq('student_number', normalizedMatricula)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!normalizedError && normalizedData) {
        console.log(
          '[getTRIScoresFromStudentAnswers] ✅ Notas TRI encontradas (matrícula normalizada)',
        )
        return {
          tri_lc: normalizedData.tri_lc,
          tri_ch: normalizedData.tri_ch,
          tri_cn: normalizedData.tri_cn,
          tri_mt: normalizedData.tri_mt,
        }
      }
    }

    // ========== PRIORIDADE 2: Buscar student_id na tabela students e usar student_id ==========
    console.log(
      '[getTRIScoresFromStudentAnswers] Tentativa 2: Buscando student_id na tabela students...',
    )

    const { data: studentData } = await supabase
      .from('students')
      .select('id')
      .eq('matricula', matricula)
      .maybeSingle()

    if (studentData?.id) {
      console.log(
        '[getTRIScoresFromStudentAnswers] Student ID encontrado:',
        studentData.id,
      )

      const { data: byStudentId, error: studentIdError } = await supabase
        .from('student_answers')
        .select('tri_lc, tri_ch, tri_cn, tri_mt, student_number, student_id, created_at')
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!studentIdError && byStudentId) {
        console.log(
          '[getTRIScoresFromStudentAnswers] ✅ Notas TRI encontradas (student_id):',
          {
            student_number: byStudentId.student_number,
            student_id: byStudentId.student_id,
            tri_lc: byStudentId.tri_lc,
            tri_ch: byStudentId.tri_ch,
            tri_cn: byStudentId.tri_cn,
            tri_mt: byStudentId.tri_mt,
          },
        )
        return {
          tri_lc: byStudentId.tri_lc,
          tri_ch: byStudentId.tri_ch,
          tri_cn: byStudentId.tri_cn,
          tri_mt: byStudentId.tri_mt,
        }
      }
    }
  }

  // ========== FALLBACK: Buscar por sheet_code (apenas se matrícula falhou) ==========
  if (sheetCode) {
    console.log(
      '[getTRIScoresFromStudentAnswers] Tentativa 2: Buscando por sheet_code:',
      sheetCode,
    )

    const { data, error } = await supabase
      .from('student_answers')
      .select('tri_lc, tri_ch, tri_cn, tri_mt, student_number, created_at')
      .eq('student_number', sheetCode)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      console.log(
        '[getTRIScoresFromStudentAnswers] ✅ Notas TRI encontradas (sheet_code):',
        {
          student_number: data.student_number,
          tri_lc: data.tri_lc,
          tri_ch: data.tri_ch,
          tri_cn: data.tri_cn,
          tri_mt: data.tri_mt,
        },
      )
      return {
        tri_lc: data.tri_lc,
        tri_ch: data.tri_ch,
        tri_cn: data.tri_cn,
        tri_mt: data.tri_mt,
      }
    }

    // Tentar também com sheetCode sem zeros à esquerda
    const normalizedSheetCode = sheetCode.trim().replace(/^0+/, '') || '0'
    if (normalizedSheetCode !== sheetCode.trim()) {
      console.log(
        '[getTRIScoresFromStudentAnswers] Tentativa 2b: Buscando por sheet_code normalizado:',
        normalizedSheetCode,
      )

      const { data: normalizedData, error: normalizedError } = await supabase
        .from('student_answers')
        .select('tri_lc, tri_ch, tri_cn, tri_mt, student_number, created_at')
        .eq('student_number', normalizedSheetCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!normalizedError && normalizedData) {
        console.log(
          '[getTRIScoresFromStudentAnswers] ✅ Notas TRI encontradas (sheet_code normalizado):',
          normalizedData,
        )
        return {
          tri_lc: normalizedData.tri_lc,
          tri_ch: normalizedData.tri_ch,
          tri_cn: normalizedData.tri_cn,
          tri_mt: normalizedData.tri_mt,
        }
      }
    }
  }

  // ========== DEBUG: Se não encontrou, buscar TODOS para diagnosticar ==========
  console.log(
    '[getTRIScoresFromStudentAnswers] ⚠️ Nenhuma nota TRI encontrada. Buscando todos os registros da tabela...',
  )

  const { data: allRecords, error: allError } = await supabase
    .from('student_answers')
    .select('student_number, student_name, tri_lc, tri_ch, tri_cn, tri_mt')
    .limit(100)

  if (!allError && allRecords) {
    console.log(
      '[getTRIScoresFromStudentAnswers] Total de registros na tabela:',
      allRecords.length,
    )

    // Procurar matrícula exata nos registros
    const matchingRecord = allRecords.find((r) => r.student_number === matricula)
    if (matchingRecord) {
      console.log(
        '[getTRIScoresFromStudentAnswers] ✅ Registro encontrado para matrícula:',
        matricula,
        matchingRecord,
      )
      return {
        tri_lc: matchingRecord.tri_lc,
        tri_ch: matchingRecord.tri_ch,
        tri_cn: matchingRecord.tri_cn,
        tri_mt: matchingRecord.tri_mt,
      }
    }

    // Mostrar alguns registros para debug
    console.log(
      '[getTRIScoresFromStudentAnswers] Primeiros 10 registros:',
      allRecords.slice(0, 10).map((r) => ({
        student_number: r.student_number,
        student_name: r.student_name,
        has_tri: !!(r.tri_lc || r.tri_ch || r.tri_cn || r.tri_mt),
      })),
    )

    // Verificar se a matrícula existe em algum formato diferente
    const possibleMatches = allRecords.filter(
      (r) => r.student_number?.includes(matricula) || matricula.includes(r.student_number),
    )
    if (possibleMatches.length > 0) {
      console.log(
        '[getTRIScoresFromStudentAnswers] Possíveis matches parciais:',
        possibleMatches,
      )
    }
  }

  console.log(
    '[getTRIScoresFromStudentAnswers] ❌ Matrícula',
    matricula,
    'não encontrada na tabela student_answers',
  )
  return null
}
