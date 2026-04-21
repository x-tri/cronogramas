import { describe, expect, it } from 'vitest'
import {
  blockIdsToUnblock,
  computeShiftBlockStatus,
  missingSlotsToBlock,
  SHIFT_BLOCK_SLOTS,
  WEEKDAYS,
  type BlockLike,
} from './shift-block-slots'

function mk(
  overrides: Partial<BlockLike> & Pick<BlockLike, 'diaSemana' | 'horarioInicio'>,
): BlockLike {
  return {
    id: overrides.id ?? `b-${overrides.diaSemana}-${overrides.horarioInicio}`,
    turno: overrides.turno ?? 'manha',
    titulo: overrides.titulo ?? 'Bloqueado',
    ...overrides,
  }
}

describe('SHIFT_BLOCK_SLOTS', () => {
  it('MANHÃ = 6 slots de 07:15 até 12:45', () => {
    const m = SHIFT_BLOCK_SLOTS.manha
    expect(m).toHaveLength(6)
    expect(m[0]).toEqual({ inicio: '07:15', fim: '08:05' })
    expect(m[m.length - 1]).toEqual({ inicio: '11:55', fim: '12:45' })
  })

  it('TARDE = 4 slots de 14:35 até 18:15', () => {
    const t = SHIFT_BLOCK_SLOTS.tarde
    expect(t).toHaveLength(4)
    expect(t[0]).toEqual({ inicio: '14:35', fim: '15:25' })
    expect(t[t.length - 1]).toEqual({ inicio: '17:25', fim: '18:15' })
  })

  it('WEEKDAYS = segunda a sexta (sem fds)', () => {
    expect(WEEKDAYS).toEqual(['segunda', 'terca', 'quarta', 'quinta', 'sexta'])
  })
})

describe('computeShiftBlockStatus', () => {
  it('status "none" quando não há nenhum bloqueio no turno', () => {
    const r = computeShiftBlockStatus([], 'manha')
    expect(r).toEqual({ blocked: 0, total: 30, status: 'none' })
  })

  it('MANHÃ totalmente bloqueada = 5 dias × 6 slots = 30 slots', () => {
    const blocks: BlockLike[] = WEEKDAYS.flatMap((dia) =>
      SHIFT_BLOCK_SLOTS.manha.map((slot) =>
        mk({ diaSemana: dia, turno: 'manha', horarioInicio: slot.inicio }),
      ),
    )
    const r = computeShiftBlockStatus(blocks, 'manha')
    expect(r).toEqual({ blocked: 30, total: 30, status: 'full' })
  })

  it('TARDE parcialmente bloqueada = status "partial"', () => {
    const blocks: BlockLike[] = [
      mk({ diaSemana: 'segunda', turno: 'tarde', horarioInicio: '14:35' }),
      mk({ diaSemana: 'terca', turno: 'tarde', horarioInicio: '14:35' }),
    ]
    const r = computeShiftBlockStatus(blocks, 'tarde')
    expect(r).toEqual({ blocked: 2, total: 20, status: 'partial' })
  })

  it('ignora blocos de outro turno', () => {
    const blocks: BlockLike[] = [
      mk({ diaSemana: 'segunda', turno: 'noite', horarioInicio: '07:15' }),
      mk({ diaSemana: 'segunda', turno: 'tarde', horarioInicio: '14:35' }),
    ]
    const r = computeShiftBlockStatus(blocks, 'manha')
    expect(r.blocked).toBe(0)
  })

  it('ignora blocos em dias de fim de semana', () => {
    const blocks: BlockLike[] = [
      mk({ diaSemana: 'sabado', turno: 'manha', horarioInicio: '07:15' }),
      mk({ diaSemana: 'domingo', turno: 'manha', horarioInicio: '08:05' }),
    ]
    const r = computeShiftBlockStatus(blocks, 'manha')
    expect(r.blocked).toBe(0)
  })

  it('ignora bloqueios em slots fora do range definido (ex: 12:45 da MANHÃ)', () => {
    const blocks: BlockLike[] = [
      mk({ diaSemana: 'segunda', turno: 'manha', horarioInicio: '12:45' }),
    ]
    const r = computeShiftBlockStatus(blocks, 'manha')
    expect(r.blocked).toBe(0)
  })

  it('ignora blocos com titulo diferente de "Bloqueado" (ex: estudo)', () => {
    const blocks: BlockLike[] = [
      mk({
        diaSemana: 'segunda',
        turno: 'manha',
        horarioInicio: '07:15',
        titulo: 'Estudo de Matemática',
      }),
    ]
    const r = computeShiftBlockStatus(blocks, 'manha')
    expect(r.blocked).toBe(0)
  })
})

describe('missingSlotsToBlock', () => {
  it('quando nada bloqueado, retorna TODOS os 30 slots da manhã', () => {
    const r = missingSlotsToBlock([], 'manha')
    expect(r).toHaveLength(30)
    expect(r[0]).toMatchObject({ dia: 'segunda', inicio: '07:15' })
  })

  it('se já existir um bloco (qualquer tipo) no slot, não re-tenta bloquear', () => {
    // Um estudo já ocupa segunda 07:15 — não pode ser sobrescrito
    const blocks: BlockLike[] = [
      mk({
        diaSemana: 'segunda',
        turno: 'manha',
        horarioInicio: '07:15',
        titulo: 'Matemática',
      }),
    ]
    const r = missingSlotsToBlock(blocks, 'manha')
    expect(r).toHaveLength(29)
    expect(
      r.find((s) => s.dia === 'segunda' && s.inicio === '07:15'),
    ).toBeUndefined()
  })
})

describe('blockIdsToUnblock', () => {
  it('retorna apenas ids de blocos "Bloqueado" do turno alvo', () => {
    const blocks: BlockLike[] = [
      mk({
        id: 'b1',
        diaSemana: 'segunda',
        turno: 'manha',
        horarioInicio: '07:15',
      }),
      mk({
        id: 'b2',
        diaSemana: 'terca',
        turno: 'manha',
        horarioInicio: '08:05',
        titulo: 'Estudo',
      }),
      mk({
        id: 'b3',
        diaSemana: 'quarta',
        turno: 'tarde',
        horarioInicio: '14:35',
      }),
    ]
    const ids = blockIdsToUnblock(blocks, 'manha')
    expect(ids).toEqual(['b1'])
  })

  it('preserva estudos e aulas oficiais ao desbloquear', () => {
    const blocks: BlockLike[] = [
      mk({
        id: 'blk',
        diaSemana: 'segunda',
        turno: 'manha',
        horarioInicio: '07:15',
      }),
      mk({
        id: 'study',
        diaSemana: 'segunda',
        turno: 'manha',
        horarioInicio: '08:05',
        titulo: 'Matemática',
      }),
    ]
    const ids = blockIdsToUnblock(blocks, 'manha')
    expect(ids).toEqual(['blk'])
  })
})
