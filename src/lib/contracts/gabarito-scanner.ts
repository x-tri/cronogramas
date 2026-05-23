import { z } from 'zod'

/**
 * Contrato com o sistema sibling de impressão de gabaritos (fora deste repo).
 *
 * O scanner grava em `projetos.students[]` no Supabase SIMULADO. Este app é
 * cliente desses dados — não controla o produtor. Esta camada de boundary
 * existe para que mudanças de schema no scanner produzam erro **barulhento**
 * em vez de bug silencioso.
 *
 * Estratégia:
 * - Aceita variantes (moderna e legacy) que existem no banco hoje
 * - Tipos rigorosos: número é número, não string
 * - Refinement: identificador obrigatório (matricula OU studentNumber OU student_number)
 * - `.passthrough()`: extras permitidos (scanner pode adicionar campos sem quebrar)
 *
 * Quando o scanner muda o schema de forma incompatível, `parseProjetoStudent`
 * lança ZodError com o caminho do campo problemático.
 */

const areaScoresSchema = z
  .object({
    LC: z.number().optional(),
    CH: z.number().optional(),
    CN: z.number().optional(),
    MT: z.number().optional(),
  })
  .passthrough()

export const projetoStudentSchema = z
  .object({
    id: z.string().optional(),

    // Identificadores (pelo menos um obrigatório — ver refine abaixo)
    matricula: z.string().optional(),
    studentNumber: z.string().optional(),
    student_number: z.string().optional(),

    // Nome (variantes históricas)
    studentName: z.string().optional(),
    name: z.string().optional(),
    nome: z.string().optional(),

    turma: z.string().optional(),

    // Respostas brutas (180 itens em ENEM completo; menor para parciais)
    answers: z.array(z.string()).optional(),
    pageNumber: z.number().int().optional(),

    fezDia1: z.boolean().optional(),
    fezDia2: z.boolean().optional(),

    // Totais (camelCase novo + snake_case legacy)
    correctAnswers: z.number().int().optional(),
    correct_answers: z.number().int().optional(),
    total_acertos: z.number().int().optional(),
    wrongAnswers: z.number().int().optional(),
    wrong_answers: z.number().int().optional(),
    total_erros: z.number().int().optional(),
    blankAnswers: z.number().int().nullable().optional(),
    blank_answers: z.number().int().optional(),
    total_branco: z.number().int().optional(),
    score: z.number().optional(),

    // Por área
    areaCorrectAnswers: areaScoresSchema.optional(),
    areaScores: areaScoresSchema.optional(),

    // TRI (vários formatos coexistem)
    triScore: z.number().optional(),
    tri_theta: z.number().optional(),
    tri_lc: z.number().optional(),
    tri_ch: z.number().optional(),
    tri_cn: z.number().optional(),
    tri_mt: z.number().optional(),
    nota_lc: z.number().nullable().optional(),
    nota_ch: z.number().nullable().optional(),
    nota_cn: z.number().nullable().optional(),
    nota_mt: z.number().nullable().optional(),

    // Questões erradas — formato muda por versão de scanner
    wrong_questions: z
      .union([
        z.array(z.number().int()),
        z.array(
          z.object({
            question_number: z.number().int(),
            topic: z.string().optional(),
          }).passthrough(),
        ),
      ])
      .optional(),
    questoes_erradas: z
      .union([
        z.array(z.number().int()),
        z.array(
          z.object({
            questao: z.number().int(),
            topico: z.string().optional(),
          }).passthrough(),
        ),
      ])
      .optional(),

    confidence: z.number().optional(),
  })
  .passthrough()
  .refine(
    (data) => Boolean(data.matricula || data.studentNumber || data.student_number),
    {
      message:
        'projeto.students[]: identificador ausente (precisa matricula, studentNumber ou student_number)',
    },
  )

export type ProjetoStudent = z.infer<typeof projetoStudentSchema>

/**
 * Parse + valida 1 item de `projetos.students[]` do SIMULADO.
 *
 * @throws {z.ZodError} quando o formato diverge. A mensagem aponta o campo
 * problemático e o tipo esperado, permitindo diagnóstico imediato em vez de
 * bug silencioso.
 */
export function parseProjetoStudent(input: unknown): ProjetoStudent {
  return projetoStudentSchema.parse(input)
}

/**
 * Variante safe: retorna null em vez de throw.
 *
 * Útil em loops onde 1 aluno mal-formado não deve abortar o processamento
 * dos outros. O parser principal (`parseProjetoStudent`) deve ser usado em
 * pontos de entrada onde a falha individual indica regressão de produto.
 */
export function tryParseProjetoStudent(input: unknown): ProjetoStudent | null {
  const result = projetoStudentSchema.safeParse(input)
  return result.success ? result.data : null
}
