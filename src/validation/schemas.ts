import { z } from 'zod'
import { DIAS_SEMANA, TURNOS, TIPOS_BLOCO, AREAS_ENEM } from '../types/domain'

// ============ ENUMS ============

export const DiaSemanaSchema = z.enum(DIAS_SEMANA)
export const TurnoSchema = z.enum(TURNOS)
export const TipoBlocoSchema = z.enum(TIPOS_BLOCO)
export const AreaEnemSchema = z.enum(AREAS_ENEM)
export const PrioridadeSchema = z.literal(0).or(z.literal(1)).or(z.literal(2))

// ============ ENTITY SCHEMAS ============

export const AlunoSchema = z.object({
  id: z.string().min(1, 'ID é obrigatório'),
  matricula: z.string().min(5, 'Matrícula deve ter no mínimo 5 caracteres'),
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  turma: z.string().min(1, 'Turma é obrigatória'),
  email: z.string().email('Email inválido').nullable(),
  fotoFilename: z.string().nullable(),
  createdAt: z.date(),
})

export const DisciplinaSchema = z.object({
  id: z.string(),
  codigo: z.string().min(1, 'Código é obrigatório'),
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  professor: z.string().nullable(),
  area: AreaEnemSchema,
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um hex válido'),
})

export const HorarioOficialSchema = z.object({
  id: z.string(),
  turma: z.string(),
  diaSemana: DiaSemanaSchema,
  horarioInicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato deve ser HH:mm'),
  horarioFim: z.string().regex(/^\d{2}:\d{2}$/, 'Formato deve ser HH:mm'),
  disciplina: z.string().min(1, 'Disciplina é obrigatória'),
  professor: z.string().nullable(),
  turno: TurnoSchema,
})

export const BlocoCronogramaSchema = z.object({
  id: z.string(),
  cronogramaId: z.string().min(1, 'ID do cronograma é obrigatório'),
  diaSemana: DiaSemanaSchema,
  horarioInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horarioFim: z.string().regex(/^\d{2}:\d{2}$/),
  turno: TurnoSchema,
  tipo: TipoBlocoSchema,
  titulo: z.string().min(1, 'Título é obrigatório').max(255, 'Título muito longo'),
  descricao: z.string().max(1000, 'Descrição muito longa').nullable(),
  disciplinaCodigo: z.string().nullable(),
  cor: z.string().nullable(),
  prioridade: PrioridadeSchema,
  concluido: z.boolean(),
  createdAt: z.date(),
})

export const CronogramaSchema = z.object({
  id: z.string(),
  alunoId: z.string().min(1, 'ID do aluno é obrigatório'),
  semanaInicio: z.date(),
  semanaFim: z.date(),
  observacoes: z.string().max(5000).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  status: z.enum(['ativo', 'arquivado']),
}).refine((data) => data.semanaFim >= data.semanaInicio, {
  message: 'Data fim deve ser após data início',
  path: ['semanaFim'],
})

// ============ INPUT SCHEMAS ============

export const MatriculaInputSchema = z
  .string()
  .min(1, 'Matrícula é obrigatória')
  .regex(/^\d+$/, 'Matrícula deve conter apenas números')
  .refine((val) => val.length >= 5 && val.length <= 20, {
    message: 'Matrícula deve ter entre 5 e 20 dígitos',
  })

export const CreateBlockInputSchema = z.object({
  cronogramaId: z.string().min(1, 'Cronograma é obrigatório'),
  diaSemana: DiaSemanaSchema,
  turno: TurnoSchema,
  slotIndex: z.number().int().min(0, 'Slot inválido'),
  tipo: TipoBlocoSchema,
  titulo: z.string().min(1, 'Título é obrigatório').max(255),
  descricao: z.string().max(1000).optional(),
  disciplinaCodigo: z.string().optional(),
  prioridade: PrioridadeSchema.optional(),
})

export const UpdateBlockInputSchema = z.object({
  titulo: z.string().min(1).max(255).optional(),
  descricao: z.string().max(1000).optional(),
  tipo: TipoBlocoSchema.optional(),
  prioridade: PrioridadeSchema.optional(),
  concluido: z.boolean().optional(),
  disciplinaCodigo: z.string().optional(),
  cor: z.string().optional(),
})

export const MoveBlockInputSchema = z.object({
  blockId: z.string().min(1),
  diaSemana: DiaSemanaSchema,
  turno: TurnoSchema,
  slotIndex: z.number().int().min(0),
})

// ============ TYPE EXPORTS ============

export type AlunoInput = z.input<typeof AlunoSchema>
export type AlunoOutput = z.infer<typeof AlunoSchema>

export type CreateBlockInput = z.input<typeof CreateBlockInputSchema>
export type UpdateBlockInput = z.input<typeof UpdateBlockInputSchema>
export type MoveBlockInput = z.input<typeof MoveBlockInputSchema>

// ============ VALIDATION HELPERS ============

export function validateMatricula(matricula: unknown) {
  return MatriculaInputSchema.safeParse(matricula)
}

export function validateCreateBlock(data: unknown) {
  return CreateBlockInputSchema.safeParse(data)
}

export function validateUpdateBlock(data: unknown) {
  return UpdateBlockInputSchema.safeParse(data)
}

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')
}
