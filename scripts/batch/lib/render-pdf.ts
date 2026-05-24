/**
 * Renderização dos PDFs por aluno (Stage 4).
 *
 * Lê o plano gerado na Stage 2 e produz 2 PDFs por aluno:
 *   - cronograma.pdf : grade kanban semanal (reutiliza SchedulePdfDocument)
 *   - relatorio.pdf  : tópicos a estudar (RelatorioPdf custom do batch)
 *
 * Os PDFs vão em out/<matricula>/cronograma.pdf e out/<matricula>/relatorio.pdf.
 * O zip final é montado pelo script principal via `zip` CLI.
 */

import { writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { pdf } from '@react-pdf/renderer'

import { SchedulePdfDocument } from '../../../src/components/pdf/schedule-pdf-document'
import type { ScheduledBlock } from './distribute'
import type { Aluno, BlocoCronograma } from '../../../src/types/domain'

export interface AlunoRenderInput {
  readonly matricula: string
  readonly studentName: string | null
  readonly turma: string | null
  readonly scheduledBlocks: readonly ScheduledBlock[]
}

export interface RenderOptions {
  readonly outFilePath: string
  readonly weekStart: string
  readonly weekEnd: string
  readonly schoolName: string
  readonly simuladoTitle: string
}

const FALLBACK_NAME = 'Aluno sem nome'

/**
 * Normaliza nome do aluno para uso em filename:
 * - Remove acentos (NFD + strip combining marks)
 * - Remove caracteres não-alfanuméricos exceto espaço
 * - Trim + converte espaços em hífen
 * - Mantém capitalização original
 * Fallback: usa matricula se nome ficar vazio.
 */
export function sanitizeForFilename(
  studentName: string | null,
  matricula: string,
): string {
  const base = (studentName ?? '').trim()
  if (!base) return matricula.replace(/[^a-zA-Z0-9_\-.]/g, '_')
  const cleaned = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return cleaned || matricula.replace(/[^a-zA-Z0-9_\-.]/g, '_')
}

function buildAluno(input: AlunoRenderInput, schoolName: string): Aluno {
  return {
    id: input.matricula, // suficiente — não persistido aqui
    matricula: input.matricula,
    nome: input.studentName ?? FALLBACK_NAME,
    turma: input.turma ?? '-',
    email: null,
    escola: 'XTRI',
    escolaNome: schoolName,
    fotoFilename: null,
    createdAt: new Date(),
  }
}

function blocksToBlocoCronograma(
  blocks: readonly ScheduledBlock[],
  cronogramaId: string,
): BlocoCronograma[] {
  return blocks.map((b, i) => ({
    id: `${cronogramaId}-${i}`,
    cronogramaId,
    diaSemana: b.diaSemana,
    horarioInicio: b.horarioInicio,
    horarioFim: b.horarioFim,
    turno: b.turno,
    tipo: 'revisao',
    titulo: b.titulo,
    descricao: b.descricao,
    disciplinaCodigo: null,
    cor: b.cor,
    prioridade: b.prioridade,
    concluido: false,
    createdAt: new Date(),
  }))
}

export async function renderCronograma(
  input: AlunoRenderInput,
  opts: RenderOptions,
): Promise<string> {
  const aluno = buildAluno(input, opts.schoolName)
  const cronogramaId = `batch-${input.matricula}`
  const blocks = blocksToBlocoCronograma(input.scheduledBlocks, cronogramaId)

  const doc = createElement(SchedulePdfDocument, {
    student: aluno,
    weekStart: new Date(opts.weekStart),
    weekEnd: new Date(opts.weekEnd),
    officialSchedule: [], // sem grade oficial: usa default TURNOS_CONFIG
    blocks,
    examTitle: opts.simuladoTitle,
    triScores: null,
  })
  const buffer = await pdf(doc).toBuffer()
  await writeStreamToFile(buffer, opts.outFilePath)
  return opts.outFilePath
}

// `pdf().toBuffer()` no @react-pdf/renderer v4 retorna um stream em alguns
// builds. Acomodamos os dois casos.
async function writeStreamToFile(value: unknown, path: string): Promise<void> {
  if (Buffer.isBuffer(value)) {
    writeFileSync(path, value)
    return
  }
  const stream = value as NodeJS.ReadableStream
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  }
  writeFileSync(path, Buffer.concat(chunks))
}
