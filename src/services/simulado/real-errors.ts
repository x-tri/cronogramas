import { simuladoSupabase as supabase } from '../../lib/simulado-supabase'
import type {
  Exam,
  QuestionContent,
  WrongQuestion,
} from '../../types/supabase'
import {
  calculateWrongQuestions,
  getDetailedTopicByQuestionNumber,
} from './helpers'
import { simuladoLog } from './logger'

/**
 * Busca os erros REAIS do aluno linkando com os conteúdos da prova
 * 1. Busca o aluno na tabela 'projetos' (último projeto)
 * 2. Pega as respostas do aluno e compara com o gabarito da tabela 'exams'
 * 3. Retorna cada questão errada com o conteúdo real
 */
export async function getRealStudentErrors(
  matricula: string,
): Promise<{ wrongQuestions: WrongQuestion[]; exam: Exam | null } | null> {
  simuladoLog('[getRealStudentErrors] Buscando erros reais para matrícula:', matricula)

  try {
    // 1. Buscar projetos mais recentes
    const { data: projetos, error: projetoError } = await supabase
      .from('projetos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (projetoError || !projetos || projetos.length === 0) {
      simuladoLog('[getRealStudentErrors] Nenhum projeto encontrado')
      return null
    }

    simuladoLog(`[getRealStudentErrors] ${projetos.length} projetos encontrados`)

    // 2. Procurar o aluno no projeto mais recente
    for (const projeto of projetos) {
      const studentsArray = projeto.students as Array<{
        id?: string
        matricula?: string
        student_number?: string
        studentNumber?: string
        answers?: string[]
        wrong_questions?: number[] | Array<{ question_number: number; topic?: string }>
        questoes_erradas?: number[] | Array<{ questao: number; topico?: string }>
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

        return (
          sMatricula === matriculaStr ||
          sStudentNumber === matriculaStr ||
          sMatriculaNormalized === matriculaNormalized ||
          sStudentNumberNormalized === matriculaNormalized ||
          matriculaFromId === matriculaStr
        )
      })

      if (!studentData) continue

      simuladoLog('[getRealStudentErrors] Aluno encontrado no projeto:', projeto.id)
      simuladoLog(
        '[getRealStudentErrors] Respostas:',
        studentData.answers?.length || 0,
      )

      // 3. Verificar se tem lista de questões erradas detalhada
      const wrongQuestionsList = studentData.wrong_questions ?? studentData.questoes_erradas

      if (wrongQuestionsList && wrongQuestionsList.length > 0) {
        simuladoLog(
          '[getRealStudentErrors] Lista de erros encontrada:',
          wrongQuestionsList.length,
        )

        // Converter para array de números
        let wrongQuestionNumbers: number[]

        if (typeof wrongQuestionsList[0] === 'number') {
          wrongQuestionNumbers = wrongQuestionsList as number[]
        } else {
          wrongQuestionNumbers = (
            wrongQuestionsList as Array<{ question_number?: number; questao?: number }>
          )
            .map((q) => q.question_number ?? q.questao ?? 0)
            .filter((n) => n > 0)
        }

        // Buscar conteúdos da prova
        const examData = await getExamQuestionContents(projeto.id, wrongQuestionNumbers)

        return {
          wrongQuestions: examData.wrongQuestions,
          exam: examData.exam,
        }
      }

      // 4. Se não tem lista detalhada, calcular comparando com gabarito
      if (studentData.answers && studentData.answers.length > 0) {
        simuladoLog('[getRealStudentErrors] Calculando erros comparando com gabarito...')

        // Buscar exame correspondente - tentar por ID do projeto
        simuladoLog('[getRealStudentErrors] Buscando exam com ID:', projeto.id)
        const { data: examById, error: examError } = await supabase
          .from('exams')
          .select('*')
          .eq('id', projeto.id)
          .maybeSingle()
        let examData = examById

        if (examError) {
          console.error('[getRealStudentErrors] Erro ao buscar exam:', examError)
        }

        // Se não encontrou, tentar buscar todos os exams e ver se algum tem o mesmo título
        if (!examData && projeto.nome) {
          simuladoLog(
            '[getRealStudentErrors] Tentando buscar exam por nome:',
            projeto.nome,
          )
          const { data: examsByName } = await supabase
            .from('exams')
            .select('*')
            .ilike('title', `%${projeto.nome}%`)
            .limit(1)

          if (examsByName && examsByName.length > 0) {
            examData = examsByName[0]
            simuladoLog('[getRealStudentErrors] Exam encontrado por nome:', examData.id)
          }
        }

        // Se ainda não encontrou, listar todos os exams disponíveis
        if (!examData) {
          simuladoLog(
            '[getRealStudentErrors] Não encontrou exam específico, listando todos...',
          )
          const { data: allExams } = await supabase
            .from('exams')
            .select('id, title')
            .limit(10)

          simuladoLog('[getRealStudentErrors] Exams disponíveis:', allExams)
        }

        if (examData) {
          simuladoLog('[getRealStudentErrors] Exam encontrado:', examData.id)
          simuladoLog(
            '[getRealStudentErrors] Answer key:',
            examData.answer_key?.length || 0,
            'respostas',
          )
          simuladoLog(
            '[getRealStudentErrors] Question contents:',
            examData.question_contents?.length || 0,
            'conteúdos',
          )

          if (examData.answer_key) {
            const wrongQuestions = calculateWrongQuestions(
              studentData.answers,
              examData.answer_key,
              examData.question_contents as QuestionContent[] | null,
            )

            simuladoLog(
              '[getRealStudentErrors] ✅ Calculados',
              wrongQuestions.length,
              'erros reais!',
            )

            return {
              wrongQuestions,
              exam: examData as Exam,
            }
          } else {
            simuladoLog('[getRealStudentErrors] ⚠️ Exam encontrado mas sem answer_key')
          }
        } else {
          simuladoLog('[getRealStudentErrors] ⚠️ Nenhum exam encontrado')
        }
      }
    }

    simuladoLog('[getRealStudentErrors] Aluno não encontrado em nenhum projeto')
    return null
  } catch (error) {
    console.error('[getRealStudentErrors] Erro:', error)
    return null
  }
}

// Helper para buscar conteúdos das questões
async function getExamQuestionContents(
  examId: string,
  wrongQuestionNumbers: number[],
): Promise<{ wrongQuestions: WrongQuestion[]; exam: Exam | null }> {
  simuladoLog('[getExamQuestionContents] Buscando conteúdos para exame:', examId)

  const { data: examData, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .maybeSingle()

  if (error || !examData) {
    console.error('[getExamQuestionContents] Erro ao buscar exame:', error)
    // Retorna sem conteúdo detalhado
    return {
      wrongQuestions: wrongQuestionNumbers.map((qNum) => ({
        questionNumber: qNum,
        topic: getDetailedTopicByQuestionNumber(qNum),
        studentAnswer: 'X',
        correctAnswer: '?',
      })),
      exam: null,
    }
  }

  const questionContents = examData.question_contents as QuestionContent[] | null

  const wrongQuestions = wrongQuestionNumbers.map((qNum) => {
    const content = questionContents?.find((qc) => qc.questionNumber === qNum)
    return {
      questionNumber: qNum,
      topic: content?.content || getDetailedTopicByQuestionNumber(qNum),
      studentAnswer: 'X',
      correctAnswer: content?.answer || '?',
    }
  })

  simuladoLog(
    `[getExamQuestionContents] ${wrongQuestions.length} questões com conteúdo carregado`,
  )

  return {
    wrongQuestions,
    exam: examData as Exam,
  }
}
