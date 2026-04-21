/**
 * useToggleShiftBlock — bulk block/unblock de um turno inteiro (seg→sex).
 *
 * Uso:
 *   const { status, toggle, loading } = useToggleShiftBlock('manha')
 *
 * Quando `status === 'full'`, o próximo toggle REMOVE todos os bloqueios
 * daquele turno. Caso contrário (none/partial), o toggle INSERE os slots
 * que faltam (não sobrescreve estudos/aulas já alocados).
 */

import { useState } from 'react'
import { useCronogramaStore } from '../stores/cronograma-store'
import {
  blockIdsToUnblock,
  computeShiftBlockStatus,
  missingSlotsToBlock,
  type BulkShift,
} from '../services/shift-block/shift-block-slots'

export function useToggleShiftBlock(turno: BulkShift) {
  const blocks = useCronogramaStore((s) => s.blocks)
  const cronograma = useCronogramaStore((s) => s.cronograma)
  const addBlock = useCronogramaStore((s) => s.addBlock)
  const removeBlock = useCronogramaStore((s) => s.removeBlock)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { blocked, total, status } = computeShiftBlockStatus(blocks, turno)
  const isBlocked = status === 'full'

  const toggle = async () => {
    if (!cronograma?.id) {
      setError('Selecione um aluno com cronograma ativo')
      return
    }
    setError(null)
    setLoading(true)
    try {
      if (status === 'full') {
        // Desbloquear: remove TODOS os bloqueios do turno (preserva estudos)
        const ids = blockIdsToUnblock(blocks, turno)
        // Sequential para evitar race conditions no set() do store
        for (const id of ids) {
          await removeBlock(id)
        }
      } else {
        // Bloquear: INSERT nos slots livres (não sobrescreve estudos)
        const missing = missingSlotsToBlock(blocks, turno)
        for (const slot of missing) {
          await addBlock({
            cronogramaId: cronograma.id,
            diaSemana: slot.dia,
            turno,
            horarioInicio: slot.inicio,
            horarioFim: slot.fim,
            tipo: 'rotina', // convenção compat com timeline-view (linha 141)
            titulo: 'Bloqueado',
            descricao: null,
            disciplinaCodigo: null,
            cor: null,
            prioridade: 0,
            concluido: false,
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar bloqueios')
    } finally {
      setLoading(false)
    }
  }

  return {
    status,
    isBlocked,
    blocked,
    total,
    toggle,
    loading,
    error,
  }
}
