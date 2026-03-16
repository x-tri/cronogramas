import { describe, expect, it } from 'vitest'
import { BLOCKED_SLOT_COLOR, BLOCKED_SLOT_TITLE, getBlockDisplayLabel, isBlockedSlotBlock } from './blocked-slot'

describe('blocked-slot', () => {
  it('identifies blocked slot markers stored as descanso blocks', () => {
    expect(
      isBlockedSlotBlock({
        tipo: 'descanso',
        titulo: BLOCKED_SLOT_TITLE,
        cor: BLOCKED_SLOT_COLOR,
      }),
    ).toBe(true)
  })

  it('keeps normal labels for regular blocks', () => {
    expect(
      getBlockDisplayLabel(
        {
          tipo: 'estudo',
          titulo: 'Matemática',
          cor: null,
        },
        'Estudo',
      ),
    ).toBe('Estudo')
  })
})
