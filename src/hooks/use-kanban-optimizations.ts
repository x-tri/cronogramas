import { useMemo, useCallback } from 'react'
import type { BlocoCronograma, DiaSemana, Turno } from '../types/domain'

/**
 * Hook para otimizações de performance do Kanban
 */
export function useKanbanOptimizations(
  blocks: BlocoCronograma[],
  officialSchedule: { diaSemana: DiaSemana; turno: Turno; horarioInicio: string }[]
) {
  // Memoiza os blocos agrupados por dia/turno para evitar re-filtrar a cada render
  const blocksByCell = useMemo(() => {
    const map = new Map<string, BlocoCronograma[]>()

    for (const block of blocks) {
      const key = `${block.diaSemana}-${block.turno}`
      const existing = map.get(key) ?? []
      existing.push(block)
      map.set(key, existing)
    }

    return map
  }, [blocks])

  // Memoiza horários oficiais agrupados
  const officialByCell = useMemo(() => {
    const map = new Map<string, typeof officialSchedule>()

    for (const item of officialSchedule) {
      const key = `${item.diaSemana}-${item.turno}`
      const existing = map.get(key) ?? []
      existing.push(item)
      map.set(key, existing)
    }

    return map
  }, [officialSchedule])

  // Função memoizada para buscar blocos
  const getBlocksForCell = useCallback(
    (dia: DiaSemana, turno: Turno) => {
      return blocksByCell.get(`${dia}-${turno}`) ?? []
    },
    [blocksByCell]
  )

  // Função memoizada para verificar se slot está ocupado
  const isSlotOccupiedByOfficial = useCallback(
    (dia: DiaSemana, turno: Turno, horarioInicio: string) => {
      const officials = officialByCell.get(`${dia}-${turno}`) ?? []
      return officials.some((o) => o.horarioInicio === horarioInicio)
    },
    [officialByCell]
  )

  return {
    getBlocksForCell,
    isSlotOccupiedByOfficial,
  }
}

/**
 * Hook para virtualização (se necessário no futuro)
 */
export function useVirtualization(itemCount: number, itemHeight: number) {
  // Placeholder para futura implementação de virtualização
  // Útil quando houver muitos blocos
  return {
    virtualItems: [], // Items visíveis
    totalHeight: itemCount * itemHeight,
    scrollToIndex: () => {},
  }
}
