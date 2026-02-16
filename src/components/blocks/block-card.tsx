import type { BlocoCronograma } from '../../types/domain'
import { TIPO_BLOCO_LABELS } from '../../types/domain'
import { detectAreaFromTitle } from '../../constants/colors'

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
  const area = detectAreaFromTitle(block.titulo) || 'outros'
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onDelete) return
    if (window.confirm('Deseja excluir este bloco?')) {
      onDelete()
    }
  }

  const cyclePriority = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onChangePriority) return
    const next = ((block.prioridade + 1) % 3) as 0 | 1 | 2
    onChangePriority(next)
  }

  // Badge da área do ENEM
  const getAreaBadge = () => {
    const areaStyles: Record<string, string> = {
      natureza: 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]',
      matematica: 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]',
      linguagens: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]',
      humanas: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]',
      outros: 'bg-[#f5f3ff] text-[#7c3aed] border-[#ddd6fe]',
    }
    const areaLabels: Record<string, string> = {
      natureza: 'Natureza',
      matematica: 'Matemática',
      linguagens: 'Linguagens',
      humanas: 'Humanas',
      outros: 'Outro',
    }
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${areaStyles[area] || areaStyles.outros}`}>
        {areaLabels[area] || 'Outro'}
      </span>
    )
  }

  // Borda colorida baseada na área
  const getAreaBorderClass = () => {
    const borders: Record<string, string> = {
      natureza: 'border-l-[3px] border-l-[#10b981]',
      matematica: 'border-l-[3px] border-l-[#ef4444]',
      linguagens: 'border-l-[3px] border-l-[#3b82f6]',
      humanas: 'border-l-[3px] border-l-[#f97316]',
      outros: 'border-l-[3px] border-l-[#8b5cf6]',
    }
    return borders[area] || borders.outros
  }

  // Badge de prioridade
  const getPriorityBadge = () => {
    if (block.prioridade === 0) return null
    const styles = {
      1: 'text-[#92400e]',
      2: 'text-[#991b1b]'
    }
    const labels = { 1: '•', 2: '••' }
    return (
      <span className={`text-[11px] font-bold ${styles[block.prioridade]}`}>
        {labels[block.prioridade]}
      </span>
    )
  }

  return (
    <div
      className={`
        relative bg-white rounded-md border border-[#e3e2e0] overflow-hidden
        transition-all duration-100
        ${isDragging ? 'opacity-60 shadow-sm rotate-1' : 'hover:border-[#d1d1cd]'}
        ${getAreaBorderClass()}
        ${block.concluido ? 'opacity-70' : ''}
      `}
    >
      {/* Drag Handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute top-1 left-1 z-10 cursor-grab active:cursor-grabbing p-1.5 rounded hover:bg-[#f1f1ef] touch-none"
          title="Arrastar"
        >
          <svg className="w-4 h-4 text-[#9ca3af]" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="2"/>
            <circle cx="9" cy="12" r="2"/>
            <circle cx="9" cy="19" r="2"/>
            <circle cx="15" cy="5" r="2"/>
            <circle cx="15" cy="12" r="2"/>
            <circle cx="15" cy="19" r="2"/>
          </svg>
        </div>
      )}

      <div className={`p-2 pr-1 ${dragHandleProps ? 'pl-6' : ''}`}>
        {/* Badges: Área + Prioridade */}
        <div className="flex items-center gap-1.5 mb-1">
          {getAreaBadge()}
          {getPriorityBadge()}
        </div>

        {/* Título */}
        <h4 
          className="text-[13px] font-semibold text-[#37352f] leading-snug line-clamp-2 break-words"
          title={block.titulo}
        >
          {block.titulo}
        </h4>

        {/* Meta info e ações */}
        <div className="flex items-center justify-between mt-1.5 min-w-0">
          <span className="text-[11px] text-[#9ca3af] truncate">
            {TIPO_BLOCO_LABELS[block.tipo]}
          </span>
          {/* Ações - container com min-w-0 para não estourar */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onToggleComplete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleComplete()
                }}
                className={`
                  p-1 rounded transition-colors flex-shrink-0
                  ${block.concluido 
                    ? 'text-[#22c55e]' 
                    : 'text-[#c1c0bb] hover:text-[#37352f]'
                  }
                `}
                title={block.concluido ? 'Concluído' : 'Marcar como concluído'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}
            
            {onChangePriority && (
              <button
                onClick={cyclePriority}
                className="p-1 rounded text-[#c1c0bb] hover:text-[#37352f] transition-colors flex-shrink-0"
                title="Mudar prioridade"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </button>
            )}

            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                className="p-1 rounded text-[#c1c0bb] hover:text-[#37352f] transition-colors flex-shrink-0"
                title="Editar"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}

            {onDelete && (
              <button
                onClick={handleDelete}
                className="p-1 rounded text-[#c1c0bb] hover:text-[#dc2626] transition-colors flex-shrink-0"
                title="Excluir"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Overlay de concluído */}
      {block.concluido && (
        <div className="absolute inset-0 bg-white/40 flex items-center justify-center rounded-md">
          <svg className="w-6 h-6 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  )
}
