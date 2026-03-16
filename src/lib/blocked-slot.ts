import type { BlocoCronograma } from '../types/domain'

export const BLOCKED_SLOT_TITLE = 'Horário bloqueado'
export const BLOCKED_SLOT_COLOR = '#DC2626'

export function isBlockedSlotBlock(
  block: Pick<BlocoCronograma, 'tipo' | 'titulo' | 'cor'>,
): boolean {
  return (
    block.tipo === 'descanso'
    && block.titulo === BLOCKED_SLOT_TITLE
    && block.cor === BLOCKED_SLOT_COLOR
  )
}

export function getBlockDisplayLabel(
  block: Pick<BlocoCronograma, 'tipo' | 'titulo' | 'cor'>,
  fallbackLabel: string,
): string {
  return isBlockedSlotBlock(block) ? 'Bloqueado' : fallbackLabel
}
