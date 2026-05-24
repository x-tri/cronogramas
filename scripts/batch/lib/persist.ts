/**
 * Persist Stage 3: grava cronograma + blocos em PRIMARY para cada aluno.
 *
 * Política: SKIP se já existir cronograma para (aluno_id=matricula, semana_inicio).
 *
 * Estratégia: 1 query por aluno (anonymous DO block) com cronograma + bulk
 * insert dos blocos em uma única transação implícita. Se algo falhar, postgres
 * rola tudo back automaticamente — atomicidade por aluno.
 */

import { execFileSync } from 'node:child_process'

import type { ScheduledBlock } from './distribute'

export interface AlunoPersistInput {
  readonly matricula: string
  readonly studentName: string | null
  readonly scheduledBlocks: readonly ScheduledBlock[]
}

export interface PersistOptions {
  readonly weekStart: string
  readonly weekEnd: string
}

export interface PersistResult {
  readonly matricula: string
  readonly result: 'created' | 'skipped' | 'failed' | 'empty'
  readonly blocosCriados?: number
  readonly reason?: string
}

function runSql(sql: string): unknown {
  const out = execFileSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '--agent', 'yes', '--output', 'json', sql],
    { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
  )
  return JSON.parse(out)
}

/**
 * SQL-safe escape para tags PostgreSQL $tag$...$tag$ — usado pra envolver
 * strings com apóstrofos sem precisar duplicá-los.
 *
 * Gera tag aleatória curta que com altíssima probabilidade NÃO existe na
 * string sendo envolvida (chance de colisão ~0).
 */
function pgString(value: string): string {
  const tag = `t${Math.random().toString(36).slice(2, 8)}`
  // Hardening: se por algum motivo o tag aparecer, retry com outro
  if (value.includes(`$${tag}$`)) return pgString(value)
  return `$${tag}$${value}$${tag}$`
}

export function persistAluno(
  input: AlunoPersistInput,
  opts: PersistOptions,
): PersistResult {
  if (input.scheduledBlocks.length === 0) {
    return { matricula: input.matricula, result: 'empty' }
  }

  // 1. Check existence
  const checkSql = `SELECT count(*)::int AS n FROM cronogramas WHERE aluno_id = ${pgString(input.matricula)} AND semana_inicio = '${opts.weekStart}'::date;`
  const checkResult = runSql(checkSql) as { rows: Array<{ n: number }> }
  if (checkResult.rows[0]?.n > 0) {
    return { matricula: input.matricula, result: 'skipped', reason: 'cronograma já existe' }
  }

  // 2. Build atomic transaction (DO block — postgres roda em transaction implícita)
  const blocosValues = input.scheduledBlocks
    .map((b) =>
      [
        `v_cronograma_id`,
        `'${b.diaSemana}'`,
        `'${b.horarioInicio}'`,
        `'${b.horarioFim}'`,
        `'${b.turno}'`,
        `'revisao'`,
        pgString(b.titulo),
        pgString(b.descricao),
        `NULL`,
        `'${b.cor}'`,
        `${b.prioridade}`,
        `false`,
      ].join(', '),
    )
    .map((row) => `(${row})`)
    .join(',\n')

  const txSql = `
DO $batchblock$
DECLARE v_cronograma_id uuid;
BEGIN
  INSERT INTO cronogramas (aluno_id, semana_inicio, semana_fim, status)
  VALUES (${pgString(input.matricula)}, '${opts.weekStart}'::date, '${opts.weekEnd}'::date, 'ativo')
  RETURNING id INTO v_cronograma_id;

  INSERT INTO blocos_cronograma
    (cronograma_id, dia_semana, horario_inicio, horario_fim, turno, tipo, titulo, descricao, disciplina_codigo, cor, prioridade, concluido)
  VALUES
${blocosValues};
END
$batchblock$;
`

  try {
    runSql(txSql)
    return {
      matricula: input.matricula,
      result: 'created',
      blocosCriados: input.scheduledBlocks.length,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { matricula: input.matricula, result: 'failed', reason: msg.split('\n')[0] }
  }
}
