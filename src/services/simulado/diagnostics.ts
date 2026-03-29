import { simuladoSupabase as supabase } from '../../lib/simulado-supabase'
import type { SupabaseStudent } from '../../types/supabase'
import { simuladoLog } from './logger'

/**
 * Função de diagnóstico para testar a conexão com a tabela student_answers
 * e verificar se existem dados para uma matrícula específica
 */
export async function diagnoseStudentAnswers(matricula: string): Promise<void> {
  simuladoLog('========== DIAGNÓSTICO ==========')
  simuladoLog('Matrícula buscada:', matricula)

  let studentData: SupabaseStudent | null = null

  // 1. Verificar conexão com Supabase
  try {
    const { error: healthError } = await supabase
      .from('student_answers')
      .select('count')
      .limit(1)

    if (healthError) {
      console.error('❌ Erro de conexão com Supabase:', healthError)
      return
    }
    simuladoLog('✅ Conexão com Supabase OK')
  } catch (e) {
    console.error('❌ Erro ao conectar com Supabase:', e)
    return
  }

  // 2. Verificar se existe tabela 'students' e buscar o aluno
  simuladoLog('\n📋 VERIFICANDO TABELA students:')
  const { data: studentDataResult, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('matricula', matricula)
    .maybeSingle()

  studentData = studentDataResult as SupabaseStudent | null

  if (studentError) {
    console.error('❌ Erro ao buscar na tabela students:', studentError)
  } else if (studentData) {
    simuladoLog('✅ Aluno encontrado na tabela students:')
    simuladoLog('   - ID:', studentData.id)
    simuladoLog('   - Nome:', studentData.name)
    simuladoLog('   - Matrícula:', studentData.matricula)
    simuladoLog('   - Sheet Code:', studentData.sheet_code)
    simuladoLog('   - Turma:', studentData.turma)

    // Se tem sheet_code, buscar na student_answers
    if (studentData.sheet_code) {
      simuladoLog(
        '\n📋 BUSCANDO NA student_answers COM SHEET_CODE:',
        studentData.sheet_code,
      )
      const { data: answersBySheetCode, error: sheetCodeError } = await supabase
        .from('student_answers')
        .select('id, student_number, exam_id, created_at')
        .eq('student_number', studentData.sheet_code)

      if (sheetCodeError) {
        console.error('❌ Erro ao buscar por sheet_code:', sheetCodeError)
      } else {
        simuladoLog(
          '🔍 Registros encontrados com sheet_code:',
          answersBySheetCode?.length || 0,
        )
        if (answersBySheetCode && answersBySheetCode.length > 0) {
          simuladoLog('Registros:', answersBySheetCode)
        }
      }
    }
  } else {
    simuladoLog(
      '❌ Aluno NÃO encontrado na tabela students com matrícula:',
      matricula,
    )

    // Tentar buscar com matrícula normalizada
    const normalizedMatricula = matricula.trim().replace(/^0+/, '') || '0'
    if (normalizedMatricula !== matricula.trim()) {
      simuladoLog('Tentando com matrícula normalizada:', normalizedMatricula)
      const { data: normStudent, error: normError } = await supabase
        .from('students')
        .select('*')
        .eq('matricula', normalizedMatricula)
        .maybeSingle()

      if (normError) {
        console.error('❌ Erro ao buscar com matrícula normalizada:', normError)
      } else if (normStudent) {
        studentData = normStudent as SupabaseStudent
        simuladoLog('✅ Aluno encontrado com matrícula normalizada:')
        simuladoLog('   - ID:', normStudent.id)
        simuladoLog('   - Nome:', normStudent.name)
        simuladoLog('   - Sheet Code:', normStudent.sheet_code)
      } else {
        simuladoLog('❌ Aluno também não encontrado com matrícula normalizada')
      }
    }
  }

  // 3. Contar total de registros na tabela student_answers
  simuladoLog('\n📋 VERIFICANDO TABELA student_answers:')
  const { count: totalCount, error: countError } = await supabase
    .from('student_answers')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('❌ Erro ao contar registros:', countError)
  } else {
    simuladoLog('📊 Total de registros:', totalCount)
  }

  // 4. Buscar registros para a matrícula (formato original)
  const { data: exactMatches, error: exactError } = await supabase
    .from('student_answers')
    .select('id, student_number, exam_id, created_at')
    .eq('student_number', matricula)

  if (exactError) {
    console.error('❌ Erro ao buscar matrícula exata:', exactError)
  } else {
    simuladoLog(
      '🔍 Registros com matrícula exata (',
      matricula,
      '):',
      exactMatches?.length || 0,
    )
  }

  // 4.1 Verificar se existe coluna student_id na student_answers
  simuladoLog('\n📋 Verificando estrutura da tabela student_answers:')
  try {
    const { data: sampleRecord } = await supabase
      .from('student_answers')
      .select('*')
      .limit(1)
      .single()

    if (sampleRecord) {
      simuladoLog('   Colunas disponíveis:', Object.keys(sampleRecord).join(', '))

      // Se existe student_id, tentar buscar por ele
      if ('student_id' in sampleRecord && studentData?.id) {
        simuladoLog('   Tentando buscar por student_id:', studentData.id)
        const { data: byStudentId } = await supabase
          .from('student_answers')
          .select('id, student_number, exam_id, created_at')
          .eq('student_id', studentData.id)

        simuladoLog('   Registros encontrados com student_id:', byStudentId?.length || 0)
        if (byStudentId && byStudentId.length > 0) {
          simuladoLog('   Registros:', byStudentId)
        }
      }
    }
  } catch (e) {
    simuladoLog('   Não foi possível verificar estrutura:', e)
  }

  // 5. Mostrar alguns exemplos de student_number na tabela
  const { data: samples, error: samplesError } = await supabase
    .from('student_answers')
    .select('student_number, student_name')
    .limit(10)

  if (samplesError) {
    console.error('❌ Erro ao buscar amostras:', samplesError)
  } else {
    simuladoLog('\n📝 Exemplos de student_number na tabela:')
    samples?.forEach((s, i) => {
      simuladoLog(`   ${i + 1}. ${s.student_number} - ${s.student_name || 'Sem nome'}`)
    })
  }

  // 6. Verificar se existe a tabela 'projetos'
  simuladoLog('\n📋 VERIFICANDO TABELA projetos:')
  try {
    const { count: projetosCount, error: projetosCountError } = await supabase
      .from('projetos')
      .select('*', { count: 'exact', head: true })

    if (projetosCountError) {
      simuladoLog('⚠️ Erro na tabela projetos:', projetosCountError)
    } else {
      simuladoLog('📊 Total de registros na tabela projetos:', projetosCount)

      // Buscar aluno na tabela projetos
      const { data: projetos, error: projetosError } = await supabase
        .from('projetos')
        .select('id, nome, students, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!projetosError && projetos) {
        simuladoLog('📝 Projetos encontrados:')
        for (const projeto of projetos) {
          simuladoLog(`   Projeto: ${projeto.id} - ${projeto.nome || 'Sem nome'}`)
          const studentsArray = projeto.students as Array<{
            matricula?: string
            name?: string
            student_number?: string
            id?: string
          }> | null

          simuladoLog(`   Total de alunos no projeto: ${studentsArray?.length || 0}`)

          // Mostrar os primeiros 3 alunos do projeto para entender o formato
          if (studentsArray && studentsArray.length > 0) {
            simuladoLog('   Exemplos de alunos no projeto:')
            studentsArray.slice(0, 3).forEach((s, idx) => {
              simuladoLog(
                `      ${idx + 1}. ID: ${s.id}, Matrícula: ${s.matricula}, Nome: ${s.name || 'N/A'}`,
              )
            })
          }

          // Buscar a aluna específica
          const foundStudent = studentsArray?.find(
            (s: { matricula?: string; student_number?: string; id?: string }) => {
              const matchMatricula = s.matricula === matricula
              const matchStudentNumber = s.student_number === matricula
              const matchId = s.id?.includes(matricula)
              return matchMatricula || matchStudentNumber || matchId
            },
          )

          if (foundStudent) {
            simuladoLog(`   ✅ ✅ ✅ ALUNO ENCONTRADO NO PROJETO ${projeto.id}:`)
            simuladoLog('   Dados completos (JSON):')
            simuladoLog(JSON.stringify(foundStudent, null, 2))
            simuladoLog('   TODOS os campos disponíveis:')
            simuladoLog('   ', Object.keys(foundStudent).join(', '))
          } else {
            simuladoLog('   ❌ Aluno não encontrado neste projeto')
          }
        }
      } else if (projetosError) {
        simuladoLog('   Erro ao buscar projetos:', projetosError)
      }
    }
  } catch (e) {
    simuladoLog('⚠️ Tabela projetos não acessível:', e)
  }

  simuladoLog('\n========== FIM DO DIAGNÓSTICO ==========')
}
