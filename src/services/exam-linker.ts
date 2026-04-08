import { supabase } from '../lib/supabase'
import type { Exam } from '../types/supabase'
import {
  type QuestionContentLike,
  resolveQuestionTopic,
} from './simulado/question-topic'

type NormalizedQuestionContent = {
  questionNumber: number
  content: string
  answer: string
}

const normalizeQuestionContent = (
  question: QuestionContentLike,
): NormalizedQuestionContent => ({
  questionNumber: question.questionNumber ?? question.numero ?? question.questao ?? 0,
  content: resolveQuestionTopic(
    question,
    question.questionNumber ?? question.numero ?? question.questao ?? 0,
  ),
  answer: question.answer ?? question.resposta ?? question.gabarito ?? '',
})

/**
 * Diagnostica e busca o exam correto linkado com o projeto
 * Analisa diferentes possibilidades de relacionamento
 */

export async function findExamForProject(projetoId: string, projetoNome?: string): Promise<{
  exam: Exam | null
  method: string
  error?: string
}> {
  console.log('[findExamForProject] Buscando exam para projeto:', projetoId, projetoNome)

  // MÉTODO 1: Buscar por ID exato
  console.log('[findExamForProject] Método 1: Buscando por ID...')
  const { data: examById } = await supabase
    .from('exams')
    .select('*')
    .eq('id', projetoId)
    .maybeSingle()

  if (examById) {
    console.log('[findExamForProject] ✅ Encontrado por ID!')
      return { exam: examById as Exam, method: 'id' }
  }

  // MÉTODO 2: Buscar por nome do projeto (simulado_nome)
  if (projetoNome) {
    console.log('[findExamForProject] Método 2: Buscando por nome:', projetoNome)
    const { data: examsByName } = await supabase
      .from('exams')
      .select('*')
      .ilike('title', `%${projetoNome}%`)
      .limit(5)

    if (examsByName && examsByName.length > 0) {
      console.log('[findExamForProject] ✅ Encontrado por nome!')
      return { exam: examsByName[0] as Exam, method: 'name' }
    }

    // MÉTODO 3: Buscar por similaridade (sem case sensitive)
    console.log('[findExamForProject] Método 3: Buscando por similaridade...')
    const nomeNormalizado = projetoNome.toLowerCase().replace(/[^a-z0-9]/g, '')
    const { data: allExams } = await supabase
      .from('exams')
      .select('id, title')
      .limit(50)

    if (allExams) {
      const similarExam = allExams.find(e => {
        const titleNormalizado = (e.title || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        return titleNormalizado.includes(nomeNormalizado) || 
               nomeNormalizado.includes(titleNormalizado)
      })

      if (similarExam) {
        const { data: fullExam } = await supabase
          .from('exams')
          .select('*')
          .eq('id', similarExam.id)
          .maybeSingle()

        if (fullExam) {
          console.log('[findExamForProject] ✅ Encontrado por similaridade!')
          return { exam: fullExam as Exam, method: 'similarity' }
        }
      }
    }
  }

  // MÉTODO 4: Listar todos os exams e verificar campos disponíveis
  console.log('[findExamForProject] Método 4: Analisando estrutura...')
  const { data: sampleExams, error: sampleError } = await supabase
    .from('exams')
    .select('*')
    .limit(3)

  if (sampleError) {
    return { exam: null, method: 'none', error: `Erro ao buscar exams: ${sampleError.message}` }
  }

  if (!sampleExams || sampleExams.length === 0) {
    return { exam: null, method: 'none', error: 'Nenhum exam encontrado na tabela' }
  }

  console.log('[findExamForProject] Exams disponíveis:', sampleExams.map(e => ({
    id: e.id,
    title: e.title,
    keys: Object.keys(e)
  })))

  // Verificar se há campos que possam linkar com projeto
  const firstExam = sampleExams[0]
  const possibleLinkFields = ['project_id', 'projeto_id', 'simulado_id', 'exam_id', 'prova_id']
  const foundFields = possibleLinkFields.filter(f => f in firstExam)

  if (foundFields.length > 0) {
    console.log('[findExamForProject] Campos de link encontrados:', foundFields)
    
    for (const field of foundFields) {
      const { data: linkedExam } = await supabase
        .from('exams')
        .select('*')
        .eq(field, projetoId)
        .maybeSingle()

      if (linkedExam) {
        console.log(`[findExamForProject] ✅ Encontrado por campo ${field}!`)
          return { exam: linkedExam as Exam, method: field }
      }
    }
  }

  // MÉTODO 5: Verificar se há tabela de relacionamento
  console.log('[findExamForProject] Método 5: Verificando tabelas de relacionamento...')
  const possibleRelationTables = ['project_exams', 'projeto_exams', 'simulado_exams', 'prova_exams']
  
  for (const tableName of possibleRelationTables) {
    const { data: relationData, error: relationError } = await supabase
      .from(tableName)
      .select('*')
      .eq('projeto_id', projetoId)
      .limit(1)

    if (!relationError && relationData && relationData.length > 0) {
      console.log(`[findExamForProject] ✅ Relação encontrada na tabela ${tableName}!`)
      const examId = relationData[0].exam_id || relationData[0].exams_id
      if (examId) {
        const { data: linkedExam } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .maybeSingle()

        if (linkedExam) {
          return { exam: linkedExam as Exam, method: `relation_table:${tableName}` }
        }
      }
    }
  }

  return { 
    exam: null, 
    method: 'none', 
    error: 'Não foi possível encontrar um exam linkado com este projeto'
  }
}

/**
 * Busca os conteúdos das questões de forma flexível
 * Suporta diferentes estruturas de dados
 */
export async function getQuestionContents(examId: string): Promise<{
  contents: NormalizedQuestionContent[] | null
  method: string
}> {
  console.log('[getQuestionContents] Buscando conteúdos para exam:', examId)

  const { data: exam, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .maybeSingle()

  if (error || !exam) {
    return { contents: null, method: 'error' }
  }

  // Verificar campos possíveis
  console.log('[getQuestionContents] Campos disponíveis:', Object.keys(exam))

  // MÉTODO 1: Campo question_contents (array JSONB)
  if (exam.question_contents && Array.isArray(exam.question_contents)) {
    console.log('[getQuestionContents] ✅ Usando question_contents')
    return { 
      contents: exam.question_contents.map((q: QuestionContentLike) =>
        normalizeQuestionContent(q)
      ),
      method: 'question_contents'
    }
  }

  // MÉTODO 2: Campo contents (array JSONB)
  if (exam.contents && Array.isArray(exam.contents)) {
    console.log('[getQuestionContents] ✅ Usando contents')
    return { 
      contents: exam.contents.map((q: QuestionContentLike) =>
        normalizeQuestionContent(q)
      ),
      method: 'contents'
    }
  }

  // MÉTODO 3: Tabela separada de questões
  console.log('[getQuestionContents] Método 3: Buscando em tabela separada...')
  const possibleTables = ['questions', 'questoes', 'exam_questions', 'prova_questoes']
  
  for (const tableName of possibleTables) {
    const { data: questions, error: questionsError } = await supabase
      .from(tableName)
      .select('*')
      .eq('exam_id', examId)
      .order('question_number', { ascending: true })

    if (!questionsError && questions && questions.length > 0) {
      console.log(`[getQuestionContents] ✅ Encontrado na tabela ${tableName}!`)
      return {
        contents: questions.map((q: QuestionContentLike) =>
          normalizeQuestionContent(q)
        ),
        method: `table:${tableName}`
      }
    }
  }

  return { contents: null, method: 'none' }
}
