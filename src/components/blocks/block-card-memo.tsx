import { memo, useMemo } from 'react'
import type { BlocoCronograma } from '../../types/domain'
import { TIPO_BLOCO_LABELS, PRIORIDADE_LABELS } from '../../types/domain'
import { CORES_PRIORIDADE, getBlockColorWithAutoDetect } from '../../constants/colors'

const PRIORIDADE_CONFIG = {
  0: { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Normal' },
  1: { bg: 'bg-yellow-300', text: 'text-yellow-900', label: 'Alta' },
  2: { bg: 'bg-red-400', text: 'text-red-900', label: 'Urgente' },
} as const

type BlockCardProps = {
  block: BlocoCronograma
  onEdit?: () => void
  onDelete?: () => void
  onChangePriority?: (newPriority: 0 | 1 | 2) => void
  onToggleComplete?: () => void
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

// Componente memoizado - só re-renderiza se props mudarem
export const BlockCard = memo(function BlockCard({
  block,
  onEdit,
  onDelete,
  onChangePriority,
  onToggleComplete,
  isDragging,
  dragHandleProps,
}: BlockCardProps) {
  // Memoiza cor para evitar recalcular
  const backgroundColor = useMemo(
    () => getBlockColorWithAutoDetect(block.tipo, block.titulo, null, block.cor),
    [block.tipo, block.titulo, block.cor]
  )

  // Memoiza config de prioridade
  const config = useMemo(
    () => PRIORIDADE_CONFIG[block.prioridade],
    [block.prioridade]
  )

  // Handlers memoizados
  const handleToggleComplete = useMemo(
    () => (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggleComplete?.()
    },
    [onToggleComplete]
  )

  const handleEdit = useMemo(
    () => (e: React.MouseEvent) => {
      e.stopPropagation()
      onEdit?.()
    },
    [onEdit]
  )

  const handleDelete = useMemo(
    () => (e: React.MouseEvent) => {
      e.stopPropagation()
      if (onDelete && window.confirm('Excluir este bloco?')) {
        onDelete()
      }
    },
    [onDelete]
  )

  const cyclePriority = useMemo(
    () => (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!onChangePriority) return
      const next = ((block.prioridade + 1) % 3) as 0 | 1 | 2
      onChangePriority(next)
    },
    [onChangePriority, block.prioridade]
  )

  return (
    <div
      className={`
        relative p-2 rounded-lg text-white text-xs shadow-sm
        transition-all duration-150
        ${isDragging ? 'opacity-50 scale-105 shadow-lg' : 'opacity-100'}
      `}
      style={{ backgroundColor }}
    >
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute top-1 left-1 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/20 z-10"
          title="Arrastar bloco"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="5" r="2"/>
            <circle cx="12" cy="5" r="2"/>
            <circle cx="5" cy="12" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="5" cy="19" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </div>
      )}

      {/* Priority indicator */}
      {block.prioridade > 0 && (
        <div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
          style={{ backgroundColor: CORES_PRIORIDADE[block.prioridade] }}
          title={PRIORIDADE_LABELS[block.prioridade]}
        />
      )}

      {/* Title */}
      <div className={`font-medium truncate pr-1 ${dragHandleProps ? 'pl-5' : ''}`}>
        {block.titulo}
      </div>

      {/* Type label */}
      <div className="text-[10px] opacity-80 mt-0.5">
        {TIPO_BLOCO_LABELS[block.tipo]}
      </div>

      {/* Time */}
      <div className="text-[10px] opacity-70">
        {block.horarioInicio} - {block.horarioFim}
      </div>

      {/* Action buttons */}
      {(onEdit || onDelete || onChangePriority || onToggleComplete) && (
        <div className="flex gap-1 mt-2 pt-1.5 border-t border-white/30">
          {onToggleComplete && (
            <button
              onClick={handleToggleComplete}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                block.concluido
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              title={block.concluido ? 'Marcar como pendente' : 'Marcar como concluído'}
            >
              {block.concluido ? '✓' : '○'}
            </button>
          )}
          {onEdit && (
            <button
              onClick={handleEdit}
              className="flex-1 px-1.5 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] font-medium transition-colors"
              title="Editar"
            >
              ✏️
            </button>
          )}
          {onChangePriority && (
            <button
              onClick={cyclePriority}
              className={`flex-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${config.bg} ${config.text}`}
              title={`Prioridade: ${config.label} (clique para mudar)`}
            >
              {config.label}
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="flex-1 px-1.5 py-0.5 bg-red-500/40 hover:bg-red-500/60 rounded text-[10px] font-medium transition-colors"
              title="Excluir"
            >
              🗑️
            </button>
          )}
        </div>
      )}

      {/* Completed indicator */}
      {block.concluido && (
        <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  )
})
