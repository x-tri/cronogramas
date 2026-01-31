import type { BlocoCronograma } from '../../types/domain'
import { TIPO_BLOCO_LABELS } from '../../types/domain'
import { getBlockColorWithAutoDetect } from '../../constants/colors'

interface BlockCardProps {
  block: BlocoCronograma
  onEdit?: () => void
  onDelete?: () => void
  onChangePriority?: (newPriority: 0 | 1 | 2) => void
  onToggleComplete?: () => void
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function BlockCard({ 
  block, 
  onEdit, 
  onDelete, 
  onChangePriority, 
  onToggleComplete,
  isDragging,
  dragHandleProps 
}: BlockCardProps) {
  const backgroundColor = getBlockColorWithAutoDetect(block.tipo, block.titulo, null, block.cor)
  
  const cyclePriority = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onChangePriority) return
    const next = ((block.prioridade + 1) % 3) as 0 | 1 | 2
    onChangePriority(next)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onDelete) return
    if (window.confirm('Deseja excluir este bloco?')) {
      onDelete()
    }
  }

  // Ícone de prioridade - dentro do header
  const getPriorityIndicator = () => {
    if (block.prioridade === 0) return null
    const styles = {
      1: { bg: 'bg-yellow-400', text: 'text-yellow-900' },
      2: { bg: 'bg-red-500', text: 'text-white' }
    }
    const style = styles[block.prioridade]
    return (
      <span 
        className={`shrink-0 w-5 h-5 ${style.bg} ${style.text} rounded-full flex items-center justify-center text-[10px] font-bold`}
        title={block.prioridade === 2 ? 'Urgente' : 'Alta prioridade'}
      >
        !
      </span>
    )
  }

  return (
    <div
      className={`
        relative rounded-md overflow-hidden
        transition-all duration-150
        ${isDragging ? 'opacity-70 scale-105 shadow-lg rotate-1' : 'opacity-100'}
      `}
      style={{ backgroundColor }}
    >
      {/* Drag Handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute top-1.5 left-1.5 z-10 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-white/20"
          title="Arrastar"
        >
          <svg className="w-3 h-3 text-white/60" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="5" r="1.5"/>
            <circle cx="12" cy="5" r="1.5"/>
            <circle cx="5" cy="12" r="1.5"/>
            <circle cx="12" cy="12" r="1.5"/>
            <circle cx="5" cy="19" r="1.5"/>
            <circle cx="12" cy="19" r="1.5"/>
          </svg>
        </div>
      )}

      <div className={`p-2 ${dragHandleProps ? 'pl-5' : ''}`}>
        {/* Header: Título + Prioridade */}
        <div className="flex items-start gap-1.5">
          <h4 
            className="text-[13px] font-semibold text-white leading-tight line-clamp-2 flex-1"
            title={block.titulo}
          >
            {block.titulo}
          </h4>
          {getPriorityIndicator()}
        </div>

        {/* Meta info em linha */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-white/80">
            {TIPO_BLOCO_LABELS[block.tipo]}
          </span>
          <span className="text-[10px] text-white/60">
            {block.horarioInicio} - {block.horarioFim}
          </span>
        </div>

        {/* Ações - Compactas */}
        {(onEdit || onDelete || onChangePriority || onToggleComplete) && (
          <div className="flex items-center gap-0.5 mt-2 pt-1.5 border-t border-white/15">
            {onToggleComplete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleComplete()
                }}
                className={`
                  p-1 rounded transition-colors
                  ${block.concluido 
                    ? 'bg-green-500 text-white' 
                    : 'text-white/70 hover:text-white hover:bg-white/20'
                  }
                `}
                title={block.concluido ? 'Concluído' : 'Marcar como concluído'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}
            
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                className="p-1 rounded text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                title="Editar"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}

            {onChangePriority && (
              <button
                onClick={cyclePriority}
                className="p-1 rounded text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                title="Mudar prioridade"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </button>
            )}

            {onDelete && (
              <button
                onClick={handleDelete}
                className="p-1 rounded text-white/70 hover:text-red-200 hover:bg-red-500/50 transition-colors ml-auto"
                title="Excluir"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Overlay de concluído */}
      {block.concluido && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  )
}
