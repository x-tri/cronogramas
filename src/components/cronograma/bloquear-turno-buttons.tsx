/**
 * BloquearTurnoButtons — 2 botões toggle pra bloquear/desbloquear
 * MANHÃ (07:15→12:45) e TARDE (14:35→18:15) de seg a sex em um clique.
 *
 * Visual:
 *  - Estado 'none'    → "🔒 Bloquear MANHÃ" (azul outline)
 *  - Estado 'partial' → "🔒 Completar bloqueio MANHÃ (12/30)" (âmbar)
 *  - Estado 'full'    → "🔓 Desbloquear MANHÃ" (vermelho/filled)
 */

import { useCronogramaStore } from '../../stores/cronograma-store'
import { useToggleShiftBlock } from '../../hooks/useToggleShiftBlock'
import type { BulkShift } from '../../services/shift-block/shift-block-slots'

function ShiftButton({ turno, label }: { turno: BulkShift; label: string }) {
  const { status, blocked, total, toggle, loading, error } = useToggleShiftBlock(turno)

  const styles = {
    none: {
      cls: 'border-[#2563eb] text-[#2563eb] hover:bg-[#eff6ff]',
      icon: '🔒',
      text: `Bloquear ${label}`,
    },
    partial: {
      cls: 'border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100',
      icon: '🔒',
      text: `Completar bloqueio ${label} (${blocked}/${total})`,
    },
    full: {
      cls: 'border-red-500 bg-red-500 text-white hover:bg-red-600',
      icon: '🔓',
      text: `Desbloquear ${label}`,
    },
  }[status]

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${styles.cls}`}
      title={error ?? (status === 'partial' ? `${blocked} de ${total} slots bloqueados` : undefined)}
      data-testid={`bloquear-${turno}-btn`}
      data-status={status}
    >
      {loading ? (
        <>
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Aplicando…
        </>
      ) : (
        <>
          <span>{styles.icon}</span>
          {styles.text}
        </>
      )}
    </button>
  )
}

export function BloquearTurnoButtons() {
  const cronograma = useCronogramaStore((s) => s.cronograma)
  const currentStudent = useCronogramaStore((s) => s.currentStudent)

  // Só mostra se há aluno + cronograma ativo (sem isso, bloqueio não faz sentido)
  if (!currentStudent || !cronograma?.id) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="bloquear-turno-buttons">
      <ShiftButton turno="manha" label="MANHÃ" />
      <ShiftButton turno="tarde" label="TARDE" />
      <span className="ml-1 text-[10px] text-[#94a3b8]">
        seg–sex · {' '}
        <span className="font-mono">07:15–12:45</span> / {' '}
        <span className="font-mono">14:35–18:15</span>
      </span>
    </div>
  )
}
