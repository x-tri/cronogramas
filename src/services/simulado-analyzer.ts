import { supabase } from '../lib/supabase'
import { findExamForProject, getQuestionContents } from './exam-linker'
import type {
  SupabaseStudent,
  StudentAnswer,
  Exam,
  QuestionContent,
  WrongQuestion,
  SimuladoResult,
  TopicSummary,
} from '../types/supabase'

/**
 * Busca os erros REAIS do aluno linkando com os conteúdos da prova
 * 1. Busca o aluno na tabela 'projetos' (último projeto)
 * 2. Pega as respostas do aluno e compara com o gabarito da tabela 'exams'
 * 3. Retorna cada questão errada com o conteúdo real
 */
export async function getRealStudentErrors(
  matricula: string
): Promise<{ wrongQuestions: WrongQuestion[]; exam: Exam | null } | null> {
  console.log('[getRealStudentErrors] Buscando erros reais para matrícula:', matricula)
  
  try {
    // 1. Buscar projetos mais recentes
    const { data: projetos, error: projetoError } = await supabase
      .from('projetos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (projetoError || !projetos || projetos.length === 0) {
      console.log('[getRealStudentErrors] Nenhum projeto encontrado')
      return null
    }
    
    console.log(`[getRealStudentErrors] ${projetos.length} projetos encontrados`)
    
    // 2. Procurar o aluno no projeto mais recente
    for (const projeto of projetos) {
      const studentsArray = projeto.students as Array<{
        id?: string
        matricula?: string
        student_number?: string
        studentNumber?: string
        answers?: string[]
        wrong_questions?: number[] | Array<{question_number: number; topic?: string}>
        questoes_erradas?: number[] | Array<{questao: number; topico?: string}>
      }> | null
      
      if (!studentsArray || !Array.isArray(studentsArray)) continue
      
      // Encontrar o aluno
      const matriculaStr = String(matricula).trim()
      const matriculaNormalized = matriculaStr.replace(/^0+/, '') || '0'
      
      const studentData = studentsArray.find((s) => {
        const sMatricula = String(s.matricula ?? '').trim()
        const sStudentNumber = String(s.studentNumber ?? s.student_number ?? '').trim()
        const sId = String(s.id ?? '').trim()
        
        const idMatch = sId.match(/merged-(\d+)-\d+$/)
        const matriculaFromId = idMatch ? idMatch[1] : ''
        
        const sMatriculaNormalized = sMatricula.replace(/^0+/, '') || '0'
        const sStudentNumberNormalized = sStudentNumber.replace(/^0+/, '') || '0'
        
        return sMatricula === matriculaStr || 
               sStudentNumber === matriculaStr ||
               sMatriculaNormalized === matriculaNormalized ||
               sStudentNumberNormalized === matriculaNormalized ||
               matriculaFromId === matriculaStr
      })
      
      if (!studentData) continue
      
      console.log('[getRealStudentErrors] Aluno encontrado no projeto:', projeto.id)
      console.log('[getRealStudentErrors] Respostas:', studentData.answers?.length || 0)
      
      // 3. Verificar se tem lista de questões erradas detalhada
      const wrongQuestionsList = studentData.wrong_questions ?? studentData.questoes_erradas
      
      if (wrongQuestionsList && wrongQuestionsList.length > 0) {
        console.log('[getRealStudentErrors] Lista de erros encontrada:', wrongQuestionsList.length)
        
        // Converter para array de números
        let wrongQuestionNumbers: number[]
        
        if (typeof wrongQuestionsList[0] === 'number') {
          wrongQuestionNumbers = wrongQuestionsList as number[]
        } else {
          wrongQuestionNumbers = (wrongQuestionsList as Array<{question_number?: number; questao?: number}>)
            .map(q => q.question_number ?? q.questao ?? 0)
            .filter(n => n > 0)
        }
        
        // Buscar conteúdos da prova
        const examData = await getExamQuestionContents(projeto.id, wrongQuestionNumbers)
        
        return {
          wrongQuestions: examData.wrongQuestions,
          exam: examData.exam
        }
      }
      
      // 4. Se não tem lista detalhada, calcular comparando com gabarito
      if (studentData.answers && studentData.answers.length > 0) {
        console.log('[getRealStudentErrors] Calculando erros comparando com gabarito...')
        
        // Buscar exame correspondente - tentar por ID do projeto
        console.log('[getRealStudentErrors] Buscando exam com ID:', projeto.id)
        let { data: examData, error: examError } = await supabase
          .from('exams')
          .select('*')
          .eq('id', projeto.id)
          .maybeSingle()
        
        if (examError) {
          console.error('[getRealStudentErrors] Erro ao buscar exam:', examError)
        }
        
        // Se não encontrou, tentar buscar todos os exams e ver se algum tem o mesmo título
        if (!examData && projeto.nome) {
          console.log('[getRealStudentErrors] Tentando buscar exam por nome:', projeto.nome)
          const { data: examsByName } = await supabase
            .from('exams')
            .select('*')
            .ilike('title', `%${projeto.nome}%`)
            .limit(1)
          
          if (examsByName && examsByName.length > 0) {
            examData = examsByName[0]
            console.log('[getRealStudentErrors] Exam encontrado por nome:', examData.id)
          }
        }
        
        // Se ainda não encontrou, listar todos os exams disponíveis
        if (!examData) {
          console.log('[getRealStudentErrors] Não encontrou exam específico, listando todos...')
          const { data: allExams } = await supabase
            .from('exams')
            .select('id, title')
            .limit(10)
          
          console.log('[getRealStudentErrors] Exams disponíveis:', allExams)
        }
        
        if (examData) {
          console.log('[getRealStudentErrors] Exam encontrado:', examData.id)
          console.log('[getRealStudentErrors] Answer key:', examData.answer_key?.length || 0, 'respostas')
          console.log('[getRealStudentErrors] Question contents:', examData.question_contents?.length || 0, 'conteúdos')
          
          if (examData.answer_key) {
            const wrongQuestions = calculateWrongQuestions(
              studentData.answers,
              examData.answer_key,
              examData.question_contents as QuestionContent[] | null
            )
            
            console.log('[getRealStudentErrors] ✅ Calculados', wrongQuestions.length, 'erros reais!')
            
            return {
              wrongQuestions,
              exam: examData as Exam
            }
          } else {
            console.log('[getRealStudentErrors] ⚠️ Exam encontrado mas sem answer_key')
          }
        } else {
          console.log('[getRealStudentErrors] ⚠️ Nenhum exam encontrado')
        }
      }
    }
    
    console.log('[getRealStudentErrors] Aluno não encontrado em nenhum projeto')
    return null
  } catch (error) {
    console.error('[getRealStudentErrors] Erro:', error)
    return null
  }
}

/**
 * Busca os conteúdos das questões erradas na tabela exams
 */
async function getExamQuestionContents(
  examId: string,
  wrongQuestionNumbers: number[]
): Promise<{ wrongQuestions: WrongQuestion[]; exam: Exam | null }> {
  console.log('[getExamQuestionContents] Buscando conteúdos para exame:', examId)
  
  const { data: examData, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .maybeSingle()
  
  if (error || !examData) {
    console.error('[getExamQuestionContents] Erro ao buscar exame:', error)
    // Retorna questões sem conteúdo detalhado
    return {
      wrongQuestions: wrongQuestionNumbers.map(qNum => ({
        questionNumber: qNum,
        topic: getDetailedTopicByQuestionNumber(qNum),
        studentAnswer: 'X',
        correctAnswer: '?',
      })),
      exam: null
    }
  }
  
  const questionContents = examData.question_contents as QuestionContent[] | null
  
  const wrongQuestions: WrongQuestion[] = wrongQuestionNumbers.map(qNum => {
    // Procurar o conteúdo específico da questão
    const content = questionContents?.find(qc => qc.questionNumber === qNum)
    
    return {
      questionNumber: qNum,
      topic: content?.content || getDetailedTopicByQuestionNumber(qNum),
      studentAnswer: 'X',
      correctAnswer: content?.answer || '?',
    }
  })
  
  console.log(`[getExamQuestionContents] ${wrongQuestions.length} questões com conteúdo carregado`)
  
  return {
    wrongQuestions,
    exam: examData as Exam
  }
}

/**
 * Calcula questões erradas comparando respostas do aluno com gabarito
 */
function calculateWrongQuestions(
  studentAnswers: string[],
  answerKey: string[],
  questionContents: QuestionContent[] | null
): WrongQuestion[] {
  const wrongQuestions: WrongQuestion[] = []
  
  for (let i = 0; i < Math.min(studentAnswers.length, answerKey.length); i++) {
    const studentAnswer = studentAnswers[i]
    const correctAnswer = answerKey[i]
    const questionNumber = i + 1
    
    // Se respondeu diferente do gabarito (e não deixou em branco)
    if (studentAnswer && studentAnswer !== correctAnswer) {
      const content = questionContents?.find(qc => qc.questionNumber === questionNumber)
      
      wrongQuestions.push({
        questionNumber,
        topic: content?.content || getDetailedTopicByQuestionNumber(questionNumber),
        studentAnswer,
        correctAnswer,
      })
    }
  }
  
  console.log(`[calculateWrongQuestions] ${wrongQuestions.length} erros calculados`)
  return wrongQuestions
}

/**
 * Função de diagnóstico para testar a conexão com a tabela student_answers
 * e verificar se existem dados para uma matrícula específica
 */
export async function diagnoseStudentAnswers(matricula: string): Promise<void> {
  console.log('========== DIAGNÓSTICO ==========')
  console.log('Matrícula buscada:', matricula)
  
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
    console.log('✅ Conexão com Supabase OK')
  } catch (e) {
    console.error('❌ Erro ao conectar com Supabase:', e)
    return
  }
  
  // 2. Verificar se existe tabela 'students' e buscar o aluno
  console.log('\n📋 VERIFICANDO TABELA students:')
  const { data: studentDataResult, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('matricula', matricula)
    .maybeSingle()
  
  studentData = studentDataResult as SupabaseStudent | null
  
  if (studentError) {
    console.error('❌ Erro ao buscar na tabela students:', studentError)
  } else if (studentData) {
    console.log('✅ Aluno encontrado na tabela students:')
    console.log('   - ID:', studentData.id)
    console.log('   - Nome:', studentData.name)
    console.log('   - Matrícula:', studentData.matricula)
    console.log('   - Sheet Code:', studentData.sheet_code)
    console.log('   - Turma:', studentData.turma)
    
    // Se tem sheet_code, buscar na student_answers
    if (studentData.sheet_code) {
      console.log('\n📋 BUSCANDO NA student_answers COM SHEET_CODE:', studentData.sheet_code)
      const { data: answersBySheetCode, error: sheetCodeError } = await supabase
        .from('student_answers')
        .select('id, student_number, exam_id, created_at')
        .eq('student_number', studentData.sheet_code)
      
      if (sheetCodeError) {
        console.error('❌ Erro ao buscar por sheet_code:', sheetCodeError)
      } else {
        console.log('🔍 Registros encontrados com sheet_code:', answersBySheetCode?.length || 0)
        if (answersBySheetCode && answersBySheetCode.length > 0) {
          console.log('Registros:', answersBySheetCode)
        }
      }
    }
  } else {
    console.log('❌ Aluno NÃO encontrado na tabela students com matrícula:', matricula)
    
    // Tentar buscar com matrícula normalizada
    const normalizedMatricula = matricula.trim().replace(/^0+/, '') || '0'
    if (normalizedMatricula !== matricula.trim()) {
      console.log('Tentando com matrícula normalizada:', normalizedMatricula)
      const { data: normStudent, error: normError } = await supabase
        .from('students')
        .select('*')
        .eq('matricula', normalizedMatricula)
        .maybeSingle()
      
      if (normError) {
        console.error('❌ Erro ao buscar com matrícula normalizada:', normError)
      } else if (normStudent) {
        studentData = normStudent as SupabaseStudent
        console.log('✅ Aluno encontrado com matrícula normalizada:')
        console.log('   - ID:', normStudent.id)
        console.log('   - Nome:', normStudent.name)
        console.log('   - Sheet Code:', normStudent.sheet_code)
      } else {
        console.log('❌ Aluno também não encontrado com matrícula normalizada')
      }
    }
  }
  
  // 3. Contar total de registros na tabela student_answers
  console.log('\n📋 VERIFICANDO TABELA student_answers:')
  const { count: totalCount, error: countError } = await supabase
    .from('student_answers')
    .select('*', { count: 'exact', head: true })
  
  if (countError) {
    console.error('❌ Erro ao contar registros:', countError)
  } else {
    console.log('📊 Total de registros:', totalCount)
  }
  
  // 4. Buscar registros para a matrícula (formato original)
  const { data: exactMatches, error: exactError } = await supabase
    .from('student_answers')
    .select('id, student_number, exam_id, created_at')
    .eq('student_number', matricula)
  
  if (exactError) {
    console.error('❌ Erro ao buscar matrícula exata:', exactError)
  } else {
    console.log('🔍 Registros com matrícula exata (', matricula, '):', exactMatches?.length || 0)
  }
  
  // 4.1 Verificar se existe coluna student_id na student_answers
  console.log('\n📋 Verificando estrutura da tabela student_answers:')
  try {
    const { data: sampleRecord } = await supabase
      .from('student_answers')
      .select('*')
      .limit(1)
      .single()
    
    if (sampleRecord) {
      console.log('   Colunas disponíveis:', Object.keys(sampleRecord).join(', '))
      
      // Se existe student_id, tentar buscar por ele
      if ('student_id' in sampleRecord && studentData?.id) {
        console.log('   Tentando buscar por student_id:', studentData.id)
        const { data: byStudentId } = await supabase
          .from('student_answers')
          .select('id, student_number, exam_id, created_at')
          .eq('student_id', studentData.id)
        
        console.log('   Registros encontrados com student_id:', byStudentId?.length || 0)
        if (byStudentId && byStudentId.length > 0) {
          console.log('   Registros:', byStudentId)
        }
      }
    }
  } catch (e) {
    console.log('   Não foi possível verificar estrutura:', e)
  }
  
  // 5. Mostrar alguns exemplos de student_number na tabela
  const { data: samples, error: samplesError } = await supabase
    .from('student_answers')
    .select('student_number, student_name')
    .limit(10)
  
  if (samplesError) {
    console.error('❌ Erro ao buscar amostras:', samplesError)
  } else {
    console.log('\n📝 Exemplos de student_number na tabela:')
    samples?.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.student_number} - ${s.student_name || 'Sem nome'}`)
    })
  }
  
  // 6. Verificar se existe a tabela 'projetos'
  console.log('\n📋 VERIFICANDO TABELA projetos:')
  try {
    const { count: projetosCount, error: projetosCountError } = await supabase
      .from('projetos')
      .select('*', { count: 'exact', head: true })
    
    if (projetosCountError) {
      console.log('⚠️ Erro na tabela projetos:', projetosCountError)
    } else {
      console.log('📊 Total de registros na tabela projetos:', projetosCount)
      
      // Buscar aluno na tabela projetos
      const { data: projetos, error: projetosError } = await supabase
        .from('projetos')
        .select('id, nome, students, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (!projetosError && projetos) {
        console.log('📝 Projetos encontrados:')
        for (const projeto of projetos) {
          console.log(`   Projeto: ${projeto.id} - ${projeto.nome || 'Sem nome'}`)
          const studentsArray = projeto.students as Array<{ 
            matricula?: string; 
            name?: string; 
            student_number?: string;
            id?: string;
          }> | null
          
          console.log(`   Total de alunos no projeto: ${studentsArray?.length || 0}`)
          
          // Mostrar os primeiros 3 alunos do projeto para entender o formato
          if (studentsArray && studentsArray.length > 0) {
            console.log('   Exemplos de alunos no projeto:')
            studentsArray.slice(0, 3).forEach((s, idx) => {
              console.log(`      ${idx + 1}. ID: ${s.id}, Matrícula: ${s.matricula}, Nome: ${s.name || 'N/A'}`)
            })
          }
          
          // Buscar a aluna específica
          const foundStudent = studentsArray?.find((s: { matricula?: string; student_number?: string; id?: string }) => {
            const matchMatricula = s.matricula === matricula
            const matchStudentNumber = s.student_number === matricula
            const matchId = s.id?.includes(matricula)
            return matchMatricula || matchStudentNumber || matchId
          })
          
                  if (foundStudent) {
            console.log(`   ✅ ✅ ✅ ALUNO ENCONTRADO NO PROJETO ${projeto.id}:`)
            console.log('   Dados completos (JSON):')
            console.log(JSON.stringify(foundStudent, null, 2))
            console.log('   TODOS os campos disponíveis:')
            console.log('   ', Object.keys(foundStudent).join(', '))
          } else {
            console.log(`   ❌ Aluno não encontrado neste projeto`)
          }
        }
      } else if (projetosError) {
        console.log('   Erro ao buscar projetos:', projetosError)
      }
    }
  } catch (e) {
    console.log('⚠️ Tabela projetos não acessível:', e)
  }
  
  console.log('\n========== FIM DO DIAGNÓSTICO ==========')
}

export async function getStudentByMatricula(
  matricula: string
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
    console.log('[getStudentByMatricula] Tentando com matrícula normalizada:', normalizedMatricula)
    const { data: normalizedData, error: normalizedError } = await supabase
      .from('students')
      .select('*')
      .eq('matricula', normalizedMatricula)
      .maybeSingle()
    
    if (normalizedData) {
      console.log('[getStudentByMatricula] Student encontrado com matrícula normalizada:', normalizedData)
      return normalizedData
    }
    
    if (normalizedError) {
      console.error('[getStudentByMatricula] Error fetching student with normalized matricula:', normalizedError)
    }
  }

  console.log('[getStudentByMatricula] Student não encontrado para matrícula:', matricula)
  return null
}

export async function getLatestSimuladoResult(
  sheetCode: string
): Promise<SimuladoResult | null> {
  // Normalizar o sheetCode para busca (remover zeros à esquerda para comparação flexível)
  const normalizedSheetCode = sheetCode.trim().replace(/^0+/, '') || '0'
  console.log('[getLatestSimuladoResult] Buscando student_answers para:', sheetCode, '(normalizado:', normalizedSheetCode + ')')
  
  // 1. Buscar TODAS as respostas recentes do aluno
  // Primeiro tentar buscar exatamente como foi passado
  let { data: answersData, error: answersError } = await supabase
    .from('student_answers')
    .select('*')
    .eq('student_number', sheetCode)
    .order('created_at', { ascending: false })
    .limit(10)
  
  // Se não encontrou, tentar com zeros à esquerda removidos
  if ((!answersData || answersData.length === 0) && normalizedSheetCode !== sheetCode.trim()) {
    console.log('[getLatestSimuladoResult] Não encontrado com formato original, tentando sem zeros à esquerda:', normalizedSheetCode)
    const { data: normalizedData, error: normalizedError } = await supabase
      .from('student_answers')
      .select('*')
      .eq('student_number', normalizedSheetCode)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (!normalizedError && normalizedData && normalizedData.length > 0) {
      answersData = normalizedData
      answersError = null
    }
  }

  if (answersError) {
    console.error('[getLatestSimuladoResult] Error fetching student answers:', answersError)
    return null
  }
  
  if (!answersData || answersData.length === 0) {
    console.log('[getLatestSimuladoResult] Nenhuma resposta encontrada para:', sheetCode)
    return null
  }
  
  console.log('[getLatestSimuladoResult] Encontradas', answersData.length, 'respostas')

  // 2. Buscar exames correspondentes
  const examIds = [...new Set(answersData.map((a) => a.exam_id))]
  const { data: examsData, error: examsError } = await supabase
    .from('exams')
    .select('id, title, question_contents')
    .in('id', examIds)

  if (examsError || !examsData) {
    console.error('Error fetching exams:', examsError)
    return null
  }

  // 3. Separar exames por dia (1-90 vs 91-180)
  const examsMap = new Map(examsData.map((e) => [e.id, e]))

  let day1Answer: StudentAnswer | null = null
  let day2Answer: StudentAnswer | null = null
  let day1Exam: Exam | null = null
  let day2Exam: Exam | null = null

  for (const answer of answersData) {
    const exam = examsMap.get(answer.exam_id)
    if (!exam?.question_contents?.length) continue

    const firstQ = (exam.question_contents as QuestionContent[])[0].questionNumber

    if (firstQ === 1 && !day1Answer) {
      day1Answer = answer as StudentAnswer
      day1Exam = exam as Exam
    } else if (firstQ === 91 && !day2Answer) {
      day2Answer = answer as StudentAnswer
      day2Exam = exam as Exam
    }

    if (day1Answer && day2Answer) break
  }

  // 4. Usar o mais recente como "principal" para scores/metadata
  const primaryAnswer = day2Answer || day1Answer
  const primaryExam = day2Exam || day1Exam

  if (!primaryAnswer || !primaryExam) return null

  // 5. Encontrar erros de AMBOS os dias separadamente
  const wrongQuestions: WrongQuestion[] = []

  // Erros do dia 1 (questões 1-90)
  if (day1Exam?.question_contents && day1Answer) {
    wrongQuestions.push(
      ...findWrongQuestionsForDay(day1Answer.answers, day1Exam.question_contents)
    )
  }

  // Erros do dia 2 (questões 91-180)
  if (day2Exam?.question_contents && day2Answer) {
    wrongQuestions.push(
      ...findWrongQuestionsForDay(day2Answer.answers, day2Exam.question_contents)
    )
  }

  // 6. Agrupar por tópico
  const topicsSummary = groupByTopic(wrongQuestions)

  return {
    exam: {
      ...primaryExam,
      title:
        [day1Exam?.title, day2Exam?.title].filter(Boolean).join(' + ') ||
        primaryExam.title,
    },
    studentAnswer: primaryAnswer,
    wrongQuestions,
    topicsSummary,
  }
}

// Helper que usa índice relativo ao primeiro questionNumber do dia
function findWrongQuestionsForDay(
  studentAnswers: string[],
  questionContents: QuestionContent[] | null
): WrongQuestion[] {
  if (!questionContents || questionContents.length === 0) return []

  const wrongQuestions: WrongQuestion[] = []
  const firstQuestionNumber = questionContents[0].questionNumber

  for (const question of questionContents) {
    // Índice relativo ao primeiro número da questão do dia
    const answerIndex = question.questionNumber - firstQuestionNumber
    const studentAnswer = studentAnswers[answerIndex] ?? ''
    const correctAnswer = question.answer

    // Se respondeu diferente do gabarito (e não deixou em branco)
    if (studentAnswer && studentAnswer !== correctAnswer) {
      wrongQuestions.push({
        questionNumber: question.questionNumber,
        topic: question.content,
        studentAnswer,
        correctAnswer,
      })
    }
  }

  return wrongQuestions
}

function groupByTopic(wrongQuestions: WrongQuestion[]): TopicSummary[] {
  const topicMap = new Map<string, { count: number; questions: number[] }>()

  for (const wq of wrongQuestions) {
    const existing = topicMap.get(wq.topic)
    if (existing) {
      existing.count++
      existing.questions.push(wq.questionNumber)
    } else {
      topicMap.set(wq.topic, {
        count: 1,
        questions: [wq.questionNumber],
      })
    }
  }

  return Array.from(topicMap.entries())
    .map(([topic, data]) => ({
      topic,
      count: data.count,
      questions: data.questions,
    }))
    .sort((a, b) => b.count - a.count) // Ordenar por mais erros
}

/**
 * Busca o resultado do simulado na tabela 'projetos'
 * A coluna 'students' é um array JSONB com os dados dos alunos
 */
export async function getSimuladoFromProjetos(
  matricula: string
): Promise<SimuladoResult | null> {
  console.log('[getSimuladoFromProjetos] Buscando projetos para matrícula:', matricula)
  
  // Buscar projetos que contêm o aluno com a matrícula especificada
  // Incluir campos tri_scores e tri_scores_by_area se existirem
  const { data, error } = await supabase
    .from('projetos')
    .select('id, nome, answer_key, question_contents, students, created_at, tri_scores, tri_scores_by_area')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getSimuladoFromProjetos] Error fetching from projetos:', error)
    return null
  }

  console.log('[getSimuladoFromProjetos] Total de projetos retornados:', data?.length || 0)
  
  if (!data || data.length === 0) {
    console.log('[getSimuladoFromProjetos] Nenhum projeto encontrado')
    return null
  }

  // Procurar o aluno dentro da coluna students (JSONB) de cada projeto
  for (const projeto of data) {
    const studentsArray = projeto.students as ProjetoStudent[] | null
    console.log(`[getSimuladoFromProjetos] Projeto ${projeto.id}: ${studentsArray?.length || 0} alunos`)
    
    if (!studentsArray || !Array.isArray(studentsArray)) {
      console.log(`[getSimuladoFromProjetos] Projeto ${projeto.id}: students não é array válido`)
      continue
    }

    // Log do primeiro aluno para verificar formato
    if (studentsArray.length > 0) {
      const firstStudent = studentsArray[0]
      console.log(`[getSimuladoFromProjetos] Exemplo de aluno no projeto - TODOS OS CAMPOS:`, 
        Object.keys(firstStudent).reduce((acc, key) => {
          acc[key] = firstStudent[key as keyof ProjetoStudent]
          return acc
        }, {} as Record<string, unknown>)
      )
    }

    // Busca flexível - converte para string e compara
    const matriculaStr = String(matricula).trim()
    const matriculaNormalized = matriculaStr.replace(/^0+/, '') || '0'
    
    const studentData = studentsArray.find((s) => {
      const sMatricula = String(s.matricula ?? '').trim()
      const sStudentNumber = String(s.student_number ?? '').trim()
      const sId = String(s.id ?? '').trim()
      
      // Extrair matrícula do id no formato "merged-{matricula}-{timestamp}"
      const idMatch = sId.match(/merged-(\d+)-\d+$/)
      const matriculaFromId = idMatch ? idMatch[1] : ''
      
      // Remove zeros à esquerda para comparação
      const sMatriculaNormalized = sMatricula.replace(/^0+/, '') || '0'
      const sStudentNumberNormalized = sStudentNumber.replace(/^0+/, '') || '0'
      const matriculaFromIdNormalized = matriculaFromId.replace(/^0+/, '') || '0'
      
      return sMatricula === matriculaStr || 
             sStudentNumber === matriculaStr ||
             sMatriculaNormalized === matriculaNormalized ||
             sStudentNumberNormalized === matriculaNormalized ||
             matriculaFromId === matriculaStr ||
             matriculaFromIdNormalized === matriculaNormalized
    })

    if (studentData) {
      console.log('[getSimuladoFromProjetos] Aluno encontrado no projeto:', projeto.id)
      console.log('[getSimuladoFromProjetos] === DADOS BRUTOS COMPLETOS ===')
      console.log(JSON.stringify(studentData, null, 2))
      console.log('[getSimuladoFromProjetos] === FIM DOS DADOS BRUTOS ===')
      console.log('[getSimuladoFromProjetos] Campos disponíveis:', Object.keys(studentData).join(', '))
      const result = await convertProjetoStudentToResult(studentData, projeto)
      console.log('[getSimuladoFromProjetos] Resultado convertido com sucesso:', !!result)
      return result
    }
  }

  console.log('[getSimuladoFromProjetos] Aluno não encontrado em nenhum projeto')
  return null
}

// Tipo para os dados do aluno dentro da coluna students JSONB
type ProjetoStudent = {
  id?: string // pode estar no formato "merged-{matricula}-{timestamp}"
  // Campos originais (para compatibilidade)
  matricula?: string
  student_number?: string
  name?: string
  nome?: string
  // Campos do projeto atual (Diagnóstica-MarRN)
  studentName?: string
  studentNumber?: string
  turma?: string
  answers?: string[] // respostas do aluno
  score?: number
  confidence?: number
  pageNumber?: number
  fezDia1?: boolean
  fezDia2?: boolean
  // Questões erradas pode ser array de números ou de objetos
  wrong_questions?: number[] | { question_number: number; topic?: string }[]
  questoes_erradas?: number[] | { questao: number; topico?: string }[]
  // Contadores (novos nomes)
  wrongAnswers?: number
  correctAnswers?: number
  // Contadores originais
  correct_answers?: number
  total_acertos?: number
  wrong_answers?: number
  total_erros?: number
  blank_answers?: number
  total_branco?: number
  // Notas por área (novo formato)
  areaScores?: {
    CH?: number
    CN?: number
    LC?: number
    MT?: number
  }
  areaCorrectAnswers?: {
    CH?: number
    CN?: number
    LC?: number
    MT?: number
  }
  // Notas TRI (vários formatos possíveis)
  triScore?: number
  tri_theta?: number
  tri_lc?: number
  tri_ch?: number
  tri_cn?: number
  tri_mt?: number
  nota_lc?: number
  nota_ch?: number
  nota_cn?: number
  nota_mt?: number
}

// Tipo para o projeto
 type Projeto = {
  id: string
  nome?: string
  title?: string
  simulado_nome?: string
  created_at: string
  students?: ProjetoStudent[]
  tri_scores?: {
    LC?: number
    CH?: number
    CN?: number
    MT?: number
  }
  tri_scores_by_area?: {
    LC?: number
    CH?: number
    CN?: number
    MT?: number
    Linguagens?: number
    Humanas?: number
    Natureza?: number
    Matematica?: number
  }
}

async function convertProjetoStudentToResult(
  studentData: ProjetoStudent,
  projeto: Projeto
): Promise<SimuladoResult> {
  console.log('[convertProjetoStudentToResult] Convertendo dados do aluno...')
  
  // Extrair matrícula do id no formato "merged-{matricula}-{timestamp}" ou usar campos disponíveis
  const idMatch = studentData.id?.match(/merged-(\d+)-\d+$/)
  const matriculaFromId = idMatch ? idMatch[1] : null
  const studentMatricula = 
    studentData.studentNumber ?? 
    studentData.student_number ?? 
    studentData.matricula ?? 
    matriculaFromId ?? ''
  
  // Extrair nome - tentar todos os campos possíveis
  const studentName = 
    studentData.studentName ?? 
    studentData.name ?? 
    studentData.nome ?? 
    null
  
  console.log('[convertProjetoStudentToResult] Matrícula:', studentMatricula, 'Nome:', studentName)
  console.log('[convertProjetoStudentToResult] Respostas disponíveis:', studentData.answers?.length || 0)

  // Extrair questões erradas - PRIORIDADE 1: Lista detalhada de questões erradas
  let wrongQuestions: WrongQuestion[] = []
  
  // Tentar usar wrong_questions ou questoes_erradas (lista detalhada)
  const detailedWrongQuestions = studentData.wrong_questions ?? studentData.questoes_erradas
  
  if (detailedWrongQuestions && detailedWrongQuestions.length > 0) {
    console.log('[convertProjetoStudentToResult] Usando lista detalhada de questões erradas:', detailedWrongQuestions.length)
    
    // Buscar conteúdos reais na tabela exams
    wrongQuestions = await getWrongQuestionsWithContents(detailedWrongQuestions, projeto.id)
  } else if (studentData.answers && studentData.answers.length > 0) {
    // NOVO: Buscar erros reais comparando com gabarito da tabela exams
    console.log('[convertProjetoStudentToResult] Buscando erros reais na tabela exams...')
    wrongQuestions = await getRealWrongQuestionsFromExam(
      studentData.answers, 
      projeto.id,
      projeto.nome || projeto.simulado_nome || projeto.title
    )
  }
  
  // Se não conseguiu buscar os erros reais, usar fallback
  if (wrongQuestions.length === 0) {
    console.log('[convertProjetoStudentToResult] Gerando questões individuais do resumo por área (fallback)')
    const areaCorrect = studentData.areaCorrectAnswers
    if (areaCorrect) {
      // LC: Questões 1-45
      const lcWrong = 45 - (areaCorrect.LC ?? 0)
      if (lcWrong > 0) {
        const lcQuestions = distributeErrorsInArea(1, 45, lcWrong, 'LC')
        wrongQuestions.push(...lcQuestions)
      }
      
      // CH: Questões 46-90
      const chWrong = 45 - (areaCorrect.CH ?? 0)
      if (chWrong > 0) {
        const chQuestions = distributeErrorsInArea(46, 90, chWrong, 'CH')
        wrongQuestions.push(...chQuestions)
      }
      
      // CN: Questões 91-135
      const cnWrong = 45 - (areaCorrect.CN ?? 0)
      if (cnWrong > 0) {
        const cnQuestions = distributeErrorsInArea(91, 135, cnWrong, 'CN')
        wrongQuestions.push(...cnQuestions)
      }
      
      // MT: Questões 136-180
      const mtWrong = 45 - (areaCorrect.MT ?? 0)
      if (mtWrong > 0) {
        const mtQuestions = distributeErrorsInArea(136, 180, mtWrong, 'MT')
        wrongQuestions.push(...mtQuestions)
      }
    }
  }
  
  console.log(`[convertProjetoStudentToResult] ${wrongQuestions.length} questões erradas processadas`)

  // Agrupar por tópico
  const topicsSummary = groupByTopic(wrongQuestions)

  // Contadores (normalizar diferentes nomes)
  const correctAnswers =
    studentData.correctAnswers ??
    studentData.correct_answers ?? 
    studentData.total_acertos ?? 0
  const wrongAnswers =
    studentData.wrongAnswers ??
    studentData.wrong_answers ?? 
    studentData.total_erros ?? 
    wrongQuestions.length
  const blankAnswers =
    studentData.blank_answers ?? 
    studentData.total_branco ?? 0

  // Notas (novo formato areaScores ou formato antigo)
  // Se areaScores tiver valores > 0, usar; senão tentar outros campos
  const hasValidAreaScores = studentData.areaScores && 
    (studentData.areaScores.LC || studentData.areaScores.CH || studentData.areaScores.CN || studentData.areaScores.MT)
  
  let triLC = hasValidAreaScores 
    ? (studentData.areaScores?.LC || null)
    : (studentData.tri_lc ?? studentData.nota_lc ?? null)
  let triCH = hasValidAreaScores 
    ? (studentData.areaScores?.CH || null)
    : (studentData.tri_ch ?? studentData.nota_ch ?? null)
  let triCN = hasValidAreaScores 
    ? (studentData.areaScores?.CN || null)
    : (studentData.tri_cn ?? studentData.nota_cn ?? null)
  let triMT = hasValidAreaScores 
    ? (studentData.areaScores?.MT || null)
    : (studentData.tri_mt ?? studentData.nota_mt ?? null)
  
  // ========== NOVO: Buscar notas TRI nos campos do projeto ==========
  if (!triLC && !triCH && !triCN && !triMT) {
    console.log('[convertProjetoStudentToResult] Buscando notas TRI nos campos do projeto...')
    console.log('[convertProjetoStudentToResult] ID do aluno:', studentData.id)
    
    // Verificar tri_scores (pode ser objeto com notas indexadas pelo ID do aluno)
    const triScores = (projeto as Record<string, unknown>).tri_scores
    const triScoresByArea = (projeto as Record<string, unknown>).tri_scores_by_area
    
    console.log('[convertProjetoStudentToResult] tri_scores:', triScores)
    console.log('[convertProjetoStudentToResult] tri_scores_by_area:', triScoresByArea)
    
    // Buscar pelo ID do aluno (formato: merged-{matricula}-{timestamp})
    const studentId = studentData.id
    if (studentId && triScoresByArea && typeof triScoresByArea === 'object') {
      const byArea = triScoresByArea as Record<string, Record<string, number>>
      const studentScores = byArea[studentId]
      if (studentScores) {
        triLC = studentScores.LC ?? studentScores.lc ?? studentScores.Linguagens ?? studentScores.linguagens ?? null
        triCH = studentScores.CH ?? studentScores.ch ?? studentScores.Humanas ?? studentScores.humanas ?? null
        triCN = studentScores.CN ?? studentScores.cn ?? studentScores.Natureza ?? studentScores.natureza ?? null
        triMT = studentScores.MT ?? studentScores.mt ?? studentScores.Matematica ?? studentScores.matematica ?? null
        console.log('[convertProjetoStudentToResult] ✅ Notas encontradas em tri_scores_by_area[' + studentId + ']:', { triLC, triCH, triCN, triMT })
      } else {
        console.log('[convertProjetoStudentToResult] ⚠️ ID do aluno não encontrado em tri_scores_by_area:', studentId)
        console.log('[convertProjetoStudentToResult] IDs disponíveis:', Object.keys(byArea).slice(0, 5))
      }
    }
    
    // Se ainda não encontrou, tentar tri_scores (nota geral)
    if ((!triLC && !triCH && !triCN && !triMT) && studentId && triScores && typeof triScores === 'object') {
      const scores = triScores as Record<string, number>
      const studentScore = scores[studentId]
      if (studentScore) {
        console.log('[convertProjetoStudentToResult] Nota geral encontrada em tri_scores[' + studentId + ']:', studentScore)
        // Se só temos a nota geral, não podemos separar por área
        // Mas podemos usar como tri_score geral se necessário
      } else {
        console.log('[convertProjetoStudentToResult] ⚠️ ID do aluno não encontrado em tri_scores:', studentId)
      }
    }
  }
  
  console.log('[convertProjetoStudentToResult] Notas finais:', {
    triLC, triCH, triCN, triMT,
    areaScores: studentData.areaScores,
    tri_lc: studentData.tri_lc,
    score: studentData.score,
  })

  // Criar objeto StudentAnswer compatível
  const studentAnswer: StudentAnswer = {
    id: projeto.id + '_' + studentMatricula,
    exam_id: projeto.id,
    student_number: studentMatricula,
    student_name: studentName,
    turma: studentData.turma ?? null,
    answers: studentData.answers ?? [],
    score: studentData.score ?? 0,
    correct_answers: correctAnswers,
    wrong_answers: wrongAnswers,
    blank_answers: blankAnswers,
    tri_score: null,
    tri_lc: triLC,
    tri_ch: triCH,
    tri_cn: triCN,
    tri_mt: triMT,
    created_at: projeto.created_at,
  }

  // Criar objeto Exam compatível
  const exam: Exam = {
    id: projeto.id,
    title:
      projeto.simulado_nome ??
      projeto.nome ??
      projeto.title ??
      'Simulado',
    answer_key: [],
    question_contents: null,
  }

  const result: SimuladoResult = {
    exam,
    studentAnswer,
    wrongQuestions,
    topicsSummary,
  }
  
  console.log('[convertProjetoStudentToResult] Resultado:', {
    examTitle: result.exam.title,
    studentName: result.studentAnswer.student_name,
    totalWrongQuestions: result.wrongQuestions.length,
    totalTopics: result.topicsSummary.length,
    topics: result.topicsSummary.map(t => ({ topic: t.topic, count: t.count })),
  })
  
  return result
}

// Helper: Busca conteúdos reais para lista de questões erradas
async function getWrongQuestionsWithContents(
  wrongQuestionsList: number[] | Array<{question_number?: number; questao?: number; topic?: string; topico?: string}>,
  examId: string
): Promise<WrongQuestion[]> {
  console.log('[getWrongQuestionsWithContents] Buscando conteúdos para', wrongQuestionsList.length, 'questões')
  
  // Converter para array de números
  let wrongQuestionNumbers: number[]
  
  if (typeof wrongQuestionsList[0] === 'number') {
    wrongQuestionNumbers = wrongQuestionsList as number[]
  } else {
    wrongQuestionNumbers = (wrongQuestionsList as Array<{question_number?: number; questao?: number}>)
      .map(q => q.question_number ?? q.questao ?? 0)
      .filter(n => n > 0)
  }
  
  // Buscar na tabela exams
  const { data: examData, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .maybeSingle()
  
  if (error || !examData) {
    console.error('[getWrongQuestionsWithContents] Erro ao buscar exam:', error)
    // Retorna sem conteúdos detalhados
    return wrongQuestionNumbers.map(qNum => ({
      questionNumber: qNum,
      topic: getDetailedTopicByQuestionNumber(qNum),
      studentAnswer: 'X',
      correctAnswer: '?',
    }))
  }
  
  const questionContents = examData.question_contents as QuestionContent[] | null
  
  return wrongQuestionNumbers.map(qNum => {
    const content = questionContents?.find(qc => qc.questionNumber === qNum)
    return {
      questionNumber: qNum,
      topic: content?.content || getDetailedTopicByQuestionNumber(qNum),
      studentAnswer: 'X',
      correctAnswer: content?.answer || '?',
    }
  })
}

// Helper: Calcula erros reais usando dados da própria tabela projetos
async function getRealWrongQuestionsFromExam(
  studentAnswers: string[],
  projetoId: string,
  projetoNome?: string
): Promise<WrongQuestion[]> {
  console.log('[getRealWrongQuestionsFromExam] Calculando erros reais...')
  console.log('[getRealWrongQuestionsFromExam] Projeto ID:', projetoId)
  
  // Buscar o projeto com question_contents e gabarito
  const { data: projeto, error } = await supabase
    .from('projetos')
    .select('id, nome, answer_key, question_contents')
    .eq('id', projetoId)
    .maybeSingle()
  
  if (error) {
    console.error('[getRealWrongQuestionsFromExam] Erro ao buscar projeto:', error)
    return []
  }
  
  if (!projeto) {
    console.log('[getRealWrongQuestionsFromExam] Projeto não encontrado:', projetoId)
    return []
  }
  
  console.log('[getRealWrongQuestionsFromExam] Projeto encontrado:', projeto.nome)
  
  // Pegar conteúdos das questões da coluna question_contents
  const questionContents = projeto.question_contents as Array<{
    questionNumber?: number
    numero?: number
    questao?: number
    content?: string
    conteudo?: string
    topic?: string
    topico?: string
  }> | null
  
  console.log('[getRealWrongQuestionsFromExam] Question contents disponível:', !!questionContents)
  console.log('[getRealWrongQuestionsFromExam] Question contents quantidade:', questionContents?.length || 0)
  
  // Pegar gabarito
  const answerKey = projeto.answer_key as string[] | null
  
  console.log('[getRealWrongQuestionsFromExam] Answer key disponível:', !!answerKey)
  console.log('[getRealWrongQuestionsFromExam] Answer key quantidade:', answerKey?.length || 0)
  
  if (!answerKey || answerKey.length === 0) {
    console.log('[getRealWrongQuestionsFromExam] ⚠️ Projeto sem gabarito')
    console.log('[getRealWrongQuestionsFromExam] Campos disponíveis:', Object.keys(projeto))
    return []
  }
  
  console.log('[getRealWrongQuestionsFromExam] ✅ Gabarito com', answerKey.length, 'respostas')
  
  const wrongQuestions: WrongQuestion[] = []
  
  for (let i = 0; i < Math.min(studentAnswers.length, answerKey.length); i++) {
    const studentAnswer = studentAnswers[i]
    const correctAnswer = answerKey[i]
    const questionNumber = i + 1
    
    // Se respondeu diferente do gabarito (e não deixou em branco)
    if (studentAnswer && studentAnswer !== correctAnswer) {
      // Buscar conteúdo específico da questão
      const content = questionContents?.find(qc => 
        (qc.questionNumber || qc.numero || qc.questao) === questionNumber
      )
      
      const topicText = content?.content || content?.conteudo || content?.topic || content?.topico
      
      wrongQuestions.push({
        questionNumber,
        topic: topicText || getDetailedTopicByQuestionNumber(questionNumber),
        studentAnswer,
        correctAnswer,
      })
    }
  }
  
  console.log('[getRealWrongQuestionsFromExam] ✅ Calculados', wrongQuestions.length, 'erros reais!')
  return wrongQuestions
}

// Helper: Distribui erros em questões específicas dentro de uma área
// Retorna um array de WrongQuestion com questões distribuídas
function distributeErrorsInArea(
  startQuestion: number,
  endQuestion: number,
  errorCount: number,
  areaCode: string
): WrongQuestion[] {
  const questions: WrongQuestion[] = []
  
  // Calcular o intervalo entre questões para distribuir uniformemente
  const totalQuestions = endQuestion - startQuestion + 1
  const step = Math.max(1, Math.floor(totalQuestions / Math.max(1, errorCount)))
  
  // Gerar questões distribuídas pela área
  for (let i = 0; i < errorCount; i++) {
    // Calcular número da questão (distribuído uniformemente)
    const questionOffset = Math.min(i * step, totalQuestions - 1)
    const questionNumber = startQuestion + questionOffset
    
    questions.push({
      questionNumber,
      topic: getDetailedTopicByQuestionNumber(questionNumber),
      studentAnswer: 'X',
      correctAnswer: '?',
    })
  }
  
  return questions
}

// Helper: Retorna o assunto DETALHADO baseado no número da questão (ENEM)
// Divide cada área em sub-áreas mais específicas
function getDetailedTopicByQuestionNumber(questionNumber: number): string {
  // === LINGUAGENS (Q1-45) ===
  if (questionNumber >= 1 && questionNumber <= 5) return `Q${questionNumber} - Interpretação de Texto`
  if (questionNumber >= 6 && questionNumber <= 10) return `Q${questionNumber} - Gramática (Morfologia)`
  if (questionNumber >= 11 && questionNumber <= 15) return `Q${questionNumber} - Gramática (Sintaxe)`
  if (questionNumber >= 16 && questionNumber <= 20) return `Q${questionNumber} - Semântica e Figuras de Linguagem`
  if (questionNumber >= 21 && questionNumber <= 25) return `Q${questionNumber} - Funções da Linguagem`
  if (questionNumber >= 26 && questionNumber <= 30) return `Q${questionNumber} - Literatura Brasileira`
  if (questionNumber >= 31 && questionNumber <= 35) return `Q${questionNumber} - Literatura Portuguesa e Universal`
  if (questionNumber >= 36 && questionNumber <= 40) return `Q${questionNumber} - Arte e Cultura`
  if (questionNumber >= 41 && questionNumber <= 45) return `Q${questionNumber} - Língua Estrangeira (Inglês/Espanhol)`
  
  // === HUMANAS (Q46-90) ===
  if (questionNumber >= 46 && questionNumber <= 50) return `Q${questionNumber} - História do Brasil (Colônia)`
  if (questionNumber >= 51 && questionNumber <= 55) return `Q${questionNumber} - História do Brasil (Império e República)`
  if (questionNumber >= 56 && questionNumber <= 60) return `Q${questionNumber} - História Geral (Antiguidade e Idade Média)`
  if (questionNumber >= 61 && questionNumber <= 65) return `Q${questionNumber} - História Geral (Idade Moderna e Contemporânea)`
  if (questionNumber >= 66 && questionNumber <= 70) return `Q${questionNumber} - Geografia (Natureza e Sociedade)`
  if (questionNumber >= 71 && questionNumber <= 75) return `Q${questionNumber} - Geografia (Espaço e Território)`
  if (questionNumber >= 76 && questionNumber <= 80) return `Q${questionNumber} - Geografia (Globalização e Regionalização)`
  if (questionNumber >= 81 && questionNumber <= 85) return `Q${questionNumber} - Sociologia (Estrutura Social)`
  if (questionNumber >= 86 && questionNumber <= 90) return `Q${questionNumber} - Filosofia e Pensamento Crítico`
  
  // === NATUREZA (Q91-135) ===
  if (questionNumber >= 91 && questionNumber <= 95) return `Q${questionNumber} - Biologia (Citologia)`
  if (questionNumber >= 96 && questionNumber <= 100) return `Q${questionNumber} - Biologia (Genética)`
  if (questionNumber >= 101 && questionNumber <= 105) return `Q${questionNumber} - Biologia (Ecologia e Evolução)`
  if (questionNumber >= 106 && questionNumber <= 110) return `Q${questionNumber} - Biologia (Fisiologia Humana)`
  if (questionNumber >= 111 && questionNumber <= 115) return `Q${questionNumber} - Química (Geral)`
  if (questionNumber >= 116 && questionNumber <= 120) return `Q${questionNumber} - Química (Orgânica)`
  if (questionNumber >= 121 && questionNumber <= 125) return `Q${questionNumber} - Física (Mecânica)`
  if (questionNumber >= 126 && questionNumber <= 130) return `Q${questionNumber} - Física (Eletromagnetismo)`
  if (questionNumber >= 131 && questionNumber <= 135) return `Q${questionNumber} - Física (Termodinâmica e Óptica)`
  
  // === MATEMÁTICA (Q136-180) ===
  if (questionNumber >= 136 && questionNumber <= 140) return `Q${questionNumber} - Matemática (Conjuntos e Funções)`
  if (questionNumber >= 141 && questionNumber <= 145) return `Q${questionNumber} - Matemática (Funções e Gráficos)`
  if (questionNumber >= 146 && questionNumber <= 150) return `Q${questionNumber} - Matemática (Progressões e Logaritmos)`
  if (questionNumber >= 151 && questionNumber <= 155) return `Q${questionNumber} - Geometria (Plana)`
  if (questionNumber >= 156 && questionNumber <= 160) return `Q${questionNumber} - Geometria (Espacial)`
  if (questionNumber >= 161 && questionNumber <= 165) return `Q${questionNumber} - Geometria Analítica`
  if (questionNumber >= 166 && questionNumber <= 170) return `Q${questionNumber} - Estatística e Probabilidade`
  if (questionNumber >= 171 && questionNumber <= 175) return `Q${questionNumber} - Matemática Financeira e Razões`
  if (questionNumber >= 176 && questionNumber <= 180) return `Q${questionNumber} - Análise Combinatória e Probabilidade`
  
  return `Q${questionNumber} - Tópico não identificado`
}

// Helper: Determina o tópico baseado no número da questão (padrão ENEM) - versão simplificada
function getTopicByQuestionNumber(questionNumber: number): string {
  if (questionNumber <= 45) return 'Linguagens'
  if (questionNumber <= 90) return 'Humanas'
  if (questionNumber <= 135) return 'Natureza'
  return 'Matemática'
}

/**
 * Busca as notas TRI da tabela student_answers
 * PRIORIDADE: Sempre buscar pela matrícula primeiro
 */
export async function getTRIScoresFromStudentAnswers(
  matricula: string,
  sheetCode?: string
): Promise<{ tri_lc: number | null; tri_ch: number | null; tri_cn: number | null; tri_mt: number | null } | null> {
  console.log('[getTRIScoresFromStudentAnswers] Buscando notas TRI - matrícula:', matricula, 'sheet_code:', sheetCode)
  
  if (!matricula && !sheetCode) {
    console.log('[getTRIScoresFromStudentAnswers] Nenhum identificador fornecido')
    return null
  }
  
  // ========== PRIORIDADE 1: Buscar pela matrícula (student_number) ==========
  if (matricula) {
    const normalizedMatricula = matricula.trim().replace(/^0+/, '') || '0'
    
    console.log('[getTRIScoresFromStudentAnswers] Tentativa 1: Buscando por matrícula:', matricula)
    
    // Tentar buscar como string (text)
    const { data, error } = await supabase
      .from('student_answers')
      .select('tri_lc, tri_ch, tri_cn, tri_mt, student_number, student_id, created_at, student_name')
      .eq('student_number', matricula)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    console.log('[getTRIScoresFromStudentAnswers] Resultado busca matrícula:', { encontrado: !!data, erro: error?.message })
    
    if (!error && data) {
      console.log('[getTRIScoresFromStudentAnswers] ✅ Notas TRI encontradas (matrícula):', {
        student_number: data.student_number,
        tri_lc: data.tri_lc, tri_ch: data.tri_ch, tri_cn: data.tri_cn, tri_mt: data.tri_mt,
      })
      return { tri_lc: data.tri_lc, tri_ch: data.tri_ch, tri_cn: data.tri_cn, tri_mt: data.tri_mt }
    }
    
    // Tentar com matrícula normalizada
    if (normalizedMatricula !== matricula.trim()) {
      console.log('[getTRIScoresFromStudentAnswers] Tentativa 1b: Buscando por matrícula normalizada:', normalizedMatricula)
      const { data: normData, error: normError } = await supabase
        .from('student_answers')
        .select('tri_lc, tri_ch, tri_cn, tri_mt, student_number, created_at, student_name')
        .eq('student_number', normalizedMatricula)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!normError && normData) {
        console.log('[getTRIScoresFromStudentAnswers] ✅ Notas TRI encontradas (matrícula normalizada)')
        return { tri_lc: normData.tri_lc, tri_ch: normData.tri_ch, tri_cn: normData.tri_cn, tri_mt: normData.tri_mt }
      }
    }
    
    // ========== TENTATIVA 2: Buscar pelo student_id ==========
    console.log('[getTRIScoresFromStudentAnswers] Tentativa 2: Buscando student_id na tabela students...')
    const { data: studentData } = await supabase
      .from('students')
      .select('id, matricula')
      .eq('matricula', matricula)
      .maybeSingle()
    
    if (studentData?.id) {
      console.log('[getTRIScoresFromStudentAnswers] Student ID encontrado:', studentData.id)
      const { data: triData, error: triError } = await supabase
        .from('student_answers')
        .select('tri_lc, tri_ch, tri_cn, tri_mt, student_id, created_at')
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!triError && triData) {
        console.log('[getTRIScoresFromStudentAnswers] ✅ Notas TRI encontradas (student_id):', {
          tri_lc: triData.tri_lc, tri_ch: triData.tri_ch, tri_cn: triData.tri_cn, tri_mt: triData.tri_mt,
        })
        return { tri_lc: triData.tri_lc, tri_ch: triData.tri_ch, tri_cn: triData.tri_cn, tri_mt: triData.tri_mt }
      }
    }
  }
  
  // ========== FALLBACK: Buscar pelo sheet_code (se matrícula não encontrou) ==========
  if (sheetCode) {
    const normalizedSheetCode = sheetCode.trim().replace(/^0+/, '') || '0'
    
    console.log('[getTRIScoresFromStudentAnswers] Tentativa 2: Buscando por sheet_code:', sheetCode)
    const { data, error } = await supabase
      .from('student_answers')
      .select('tri_lc, tri_ch, tri_cn, tri_mt, student_number, created_at')
      .eq('student_number', sheetCode)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (!error && data) {
      console.log('[getTRIScoresFromStudentAnswers] ✅ Notas TRI encontradas (sheet_code):', {
        tri_lc: data.tri_lc, tri_ch: data.tri_ch, tri_cn: data.tri_cn, tri_mt: data.tri_mt,
      })
      return { tri_lc: data.tri_lc, tri_ch: data.tri_ch, tri_cn: data.tri_cn, tri_mt: data.tri_mt }
    }
    
    // Tentar com sheet_code normalizado
    if (normalizedSheetCode !== sheetCode.trim()) {
      console.log('[getTRIScoresFromStudentAnswers] Tentativa 2b: Buscando por sheet_code normalizado:', normalizedSheetCode)
      const { data: normData, error: normError } = await supabase
        .from('student_answers')
        .select('tri_lc, tri_ch, tri_cn, tri_mt, student_number, created_at')
        .eq('student_number', normalizedSheetCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!normError && normData) {
        console.log('[getTRIScoresFromStudentAnswers] ✅ Notas TRI encontradas (sheet_code normalizado):', {
          tri_lc: normData.tri_lc, tri_ch: normData.tri_ch, tri_cn: normData.tri_cn, tri_mt: normData.tri_mt,
        })
        return { tri_lc: normData.tri_lc, tri_ch: normData.tri_ch, tri_cn: normData.tri_cn, tri_mt: normData.tri_mt }
      }
    }
  }
  
  // Debug: Buscar especificamente pela matrícula fornecida
  console.log('[getTRIScoresFromStudentAnswers] ⚠️ Nenhuma nota TRI encontrada. Buscando todos os registros da tabela...')
  
  // Buscar TODOS os registros para ver se a matrícula existe
  const { data: allRecords, error: countError } = await supabase
    .from('student_answers')
    .select('student_number, student_name, tri_lc, tri_ch, tri_cn, tri_mt, created_at')
  
  if (!countError && allRecords) {
    console.log('[getTRIScoresFromStudentAnswers] Total de registros na tabela:', allRecords.length)
    
    // Buscar especificamente pela matrícula
    const matchingRecord = allRecords.find(r => r.student_number === matricula)
    if (matchingRecord) {
      console.log('[getTRIScoresFromStudentAnswers] ✅ Registro encontrado para matrícula:', matricula, matchingRecord)
      return { 
        tri_lc: matchingRecord.tri_lc, 
        tri_ch: matchingRecord.tri_ch, 
        tri_cn: matchingRecord.tri_cn, 
        tri_mt: matchingRecord.tri_mt 
      }
    }
    
    // Mostrar alguns registros para debug
    console.log('[getTRIScoresFromStudentAnswers] Primeiros 10 registros:', allRecords.slice(0, 10).map(r => ({
      student_number: r.student_number,
      student_name: r.student_name,
      has_tri: !!(r.tri_lc || r.tri_ch || r.tri_cn || r.tri_mt)
    })))
    
    // Verificar se a matrícula existe em algum formato diferente
    const possibleMatches = allRecords.filter(r => 
      r.student_number?.includes(matricula) || 
      matricula.includes(r.student_number)
    )
    if (possibleMatches.length > 0) {
      console.log('[getTRIScoresFromStudentAnswers] Possíveis matches parciais:', possibleMatches)
    }
  }
  
  console.log('[getTRIScoresFromStudentAnswers] ❌ Matrícula', matricula, 'não encontrada na tabela student_answers')
  return null
}

export async function analyzeStudentSimulado(
  matricula: string
): Promise<SimuladoResult | null> {
  console.log('[SimuladoAnalyzer] Iniciando busca para matrícula:', matricula)
  
  // Normalizar matrícula para busca
  const normalizedMatricula = matricula.trim().replace(/^0+/, '') || '0'
  console.log('[SimuladoAnalyzer] Matrícula normalizada:', normalizedMatricula)
  
  // Buscar o aluno primeiro para obter o sheet_code (para buscar notas TRI depois)
  let student = await getStudentByMatricula(matricula)
  if (!student && normalizedMatricula !== matricula.trim()) {
    student = await getStudentByMatricula(normalizedMatricula)
  }
  
  // Buscar notas TRI da tabela student_answers - SEMPRE priorizar matrícula
  let triScores: { tri_lc: number | null; tri_ch: number | null; tri_cn: number | null; tri_mt: number | null } | null = null
  if (matricula) {
    console.log('[SimuladoAnalyzer] Buscando notas TRI pela matrícula:', matricula)
    triScores = await getTRIScoresFromStudentAnswers(matricula, student?.sheet_code)
    console.log('[SimuladoAnalyzer] Notas TRI retornadas:', triScores)
  } else {
    console.log('[SimuladoAnalyzer] Matrícula não fornecida')
  }
  
  // ===== NOVO: 0. Tentar buscar erros REAIS linkando com conteúdos da prova =====
  console.log('[SimuladoAnalyzer] === TENTATIVA 0: Buscando erros reais com conteúdos ===')
  const realErrors = await getRealStudentErrors(matricula)
  if (realErrors && realErrors.wrongQuestions.length > 0) {
    console.log('[SimuladoAnalyzer] ✅ Erros reais encontrados:', realErrors.wrongQuestions.length)
    
    // Montar o resultado completo
    const topicsSummary = groupByTopic(realErrors.wrongQuestions)
    
    // Criar um objeto de resultado compatível com notas TRI
    const result: SimuladoResult = {
      exam: realErrors.exam || {
        id: 'real-exam',
        title: 'Simulado - Erros Reais',
        answer_key: [],
        question_contents: null,
      },
      studentAnswer: {
        id: matricula,
        exam_id: realErrors.exam?.id || 'real-exam',
        student_number: matricula,
        student_name: student?.name ?? null,
        turma: student?.turma ?? null,
        answers: [],
        score: 0,
        correct_answers: 180 - realErrors.wrongQuestions.length,
        wrong_answers: realErrors.wrongQuestions.length,
        blank_answers: 0,
        tri_score: null,
        tri_lc: triScores?.tri_lc ?? null,
        tri_ch: triScores?.tri_ch ?? null,
        tri_cn: triScores?.tri_cn ?? null,
        tri_mt: triScores?.tri_mt ?? null,
        created_at: new Date().toISOString(),
      },
      wrongQuestions: realErrors.wrongQuestions,
      topicsSummary,
    }
    
    console.log('[SimuladoAnalyzer] ✅ Retornando resultado com erros reais e notas TRI!')
    return result
  }
  console.log('[SimuladoAnalyzer] ⚠️ Não encontrou erros reais, tentando outros métodos...')
  
  // 1. Tentar buscar da tabela PROJETOS (principal)
  console.log('[SimuladoAnalyzer] === TENTATIVA 1: Buscando na tabela projetos ===')
  let result = await getSimuladoFromProjetos(matricula)
  if (result) {
    console.log('[SimuladoAnalyzer] ✅ Encontrado na tabela projetos!')
    // Mesclar notas TRI se não estiverem presentes
    if (triScores && (!result.studentAnswer.tri_lc || !result.studentAnswer.tri_ch || !result.studentAnswer.tri_cn || !result.studentAnswer.tri_mt)) {
      result.studentAnswer.tri_lc = result.studentAnswer.tri_lc ?? triScores.tri_lc
      result.studentAnswer.tri_ch = result.studentAnswer.tri_ch ?? triScores.tri_ch
      result.studentAnswer.tri_cn = result.studentAnswer.tri_cn ?? triScores.tri_cn
      result.studentAnswer.tri_mt = result.studentAnswer.tri_mt ?? triScores.tri_mt
      console.log('[SimuladoAnalyzer] Notas TRI mescladas ao resultado da tabela projetos')
    }
    return result
  }
  console.log('[SimuladoAnalyzer] ⚠️ Não encontrado na tabela projetos com matrícula original')
  
  // Tentar com matrícula normalizada na tabela projetos
  if (normalizedMatricula !== matricula.trim()) {
    console.log('[SimuladoAnalyzer] Tentando buscar na tabela projetos com matrícula normalizada:', normalizedMatricula)
    result = await getSimuladoFromProjetos(normalizedMatricula)
    if (result) {
      console.log('[SimuladoAnalyzer] ✅ Encontrado na tabela projetos com matrícula normalizada!')
      // Mesclar notas TRI se não estiverem presentes
      if (triScores && (!result.studentAnswer.tri_lc || !result.studentAnswer.tri_ch || !result.studentAnswer.tri_cn || !result.studentAnswer.tri_mt)) {
        result.studentAnswer.tri_lc = result.studentAnswer.tri_lc ?? triScores.tri_lc
        result.studentAnswer.tri_ch = result.studentAnswer.tri_ch ?? triScores.tri_ch
        result.studentAnswer.tri_cn = result.studentAnswer.tri_cn ?? triScores.tri_cn
        result.studentAnswer.tri_mt = result.studentAnswer.tri_mt ?? triScores.tri_mt
        console.log('[SimuladoAnalyzer] Notas TRI mescladas ao resultado da tabela projetos')
      }
      return result
    }
    console.log('[SimuladoAnalyzer] ⚠️ Não encontrado na tabela projetos com matrícula normalizada')
  }

  // 2. Fallback: Tentar buscar simulado pela matrícula nas tabelas antigas
  console.log('[SimuladoAnalyzer] === TENTATIVA 2: Buscando nas tabelas antigas ===')
  result = await getLatestSimuladoResult(matricula)
  if (result) {
    console.log('[SimuladoAnalyzer] ✅ Encontrado nas tabelas antigas!')
    // Mesclar notas TRI se não estiverem presentes
    if (triScores && (!result.studentAnswer.tri_lc || !result.studentAnswer.tri_ch || !result.studentAnswer.tri_cn || !result.studentAnswer.tri_mt)) {
      result.studentAnswer.tri_lc = result.studentAnswer.tri_lc ?? triScores.tri_lc
      result.studentAnswer.tri_ch = result.studentAnswer.tri_ch ?? triScores.tri_ch
      result.studentAnswer.tri_cn = result.studentAnswer.tri_cn ?? triScores.tri_cn
      result.studentAnswer.tri_mt = result.studentAnswer.tri_mt ?? triScores.tri_mt
      console.log('[SimuladoAnalyzer] Notas TRI mescladas ao resultado das tabelas antigas')
    }
    return result
  }
  console.log('[SimuladoAnalyzer] ⚠️ Não encontrado nas tabelas antigas')

  // 3. Fallback final: buscar pelo sheet_code do aluno nas tabelas antigas
  console.log('[SimuladoAnalyzer] === TENTATIVA 3: Buscando pelo sheet_code ===')
  
  console.log('[SimuladoAnalyzer] Student encontrado:', student)
  if (student?.sheet_code) {
    console.log('[SimuladoAnalyzer] Tentando buscar pelo sheet_code:', student.sheet_code)
    result = await getLatestSimuladoResult(student.sheet_code)
    if (result) {
      console.log('[SimuladoAnalyzer] ✅ Encontrado pelo sheet_code!')
      // Mesclar notas TRI se não estiverem presentes
      if (triScores && (!result.studentAnswer.tri_lc || !result.studentAnswer.tri_ch || !result.studentAnswer.tri_cn || !result.studentAnswer.tri_mt)) {
        result.studentAnswer.tri_lc = result.studentAnswer.tri_lc ?? triScores.tri_lc
        result.studentAnswer.tri_ch = result.studentAnswer.tri_ch ?? triScores.tri_ch
        result.studentAnswer.tri_cn = result.studentAnswer.tri_cn ?? triScores.tri_cn
        result.studentAnswer.tri_mt = result.studentAnswer.tri_mt ?? triScores.tri_mt
        console.log('[SimuladoAnalyzer] Notas TRI mescladas ao resultado do sheet_code')
      }
      return result
    }
  }

  console.log('[SimuladoAnalyzer] ❌ Nenhum resultado encontrado para:', matricula)
  return result
}
