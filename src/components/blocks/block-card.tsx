import type { BlocoCronograma } from '../../types/domain'
import { TIPO_BLOCO_LABELS, PRIORIDADE_LABELS } from '../../types/domain'
import { CORES_TIPOS, CORES_PRIORIDADE } from '../../constants/colors'

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
  isDragging?: boolean
}

export function BlockCard({ block, onEdit, onDelete, onChangePriority, isDragging }: BlockCardProps) {
  const backgroundColor = block.cor ?? CORES_TIPOS[block.tipo]

  const cyclePriority = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onChangePriority) return
    const next = ((block.prioridade + 1) % 3) as 0 | 1 | 2
    onChangePriority(next)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onDelete) return
    if (window.confirm('Excluir este bloco?')) {
      onDelete()
    }
  }

  const config = PRIORIDADE_CONFIG[block.prioridade]

  return (
    <div
      className={`
        relative p-2 rounded-lg text-white text-xs shadow-sm
        transition-all duration-150
        ${isDragging ? 'opacity-50 scale-105 shadow-lg' : 'opacity-100'}
        ${onEdit ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
      style={{ backgroundColor }}
    >
      {/* Priority indicator */}
      {block.prioridade > 0 && (
        <div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
          style={{ backgroundColor: CORES_PRIORIDADE[block.prioridade] }}
          title={PRIORIDADE_LABELS[block.prioridade]}
        />
      )}

      {/* Title */}
      <div className="font-medium truncate pr-1">{block.titulo}</div>

      {/* Type label */}
      <div className="text-[10px] opacity-80 mt-0.5">
        {TIPO_BLOCO_LABELS[block.tipo]}
      </div>

      {/* Time */}
      <div className="text-[10px] opacity-70">
        {block.horarioInicio} - {block.horarioFim}
      </div>

      {/* Action buttons - always visible */}
      {(onEdit || onDelete || onChangePriority) && (
        <div className="flex gap-1 mt-2 pt-1.5 border-t border-white/30">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
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
}
