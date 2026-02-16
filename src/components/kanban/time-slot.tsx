import { useDroppable } from '@dnd-kit/core'
import type {
  BlocoCronograma,
  DiaSemana,
  HorarioOficial,
  TimeSlot as TimeSlotType,
  Turno,
} from '../../types/domain'
import { DraggableBlockCard } from '../blocks/draggable-block-card'

interface TimeSlotProps {
  slot: TimeSlotType
  slotIndex: number
  dia: DiaSemana
  turno: Turno
  officialClass?: HorarioOficial
  customBlock?: BlocoCronograma
  isDropTarget?: boolean
  dropMode?: 'swap' | 'move' | 'blocked'
  onClick?: () => void
  onBlockEdit?: (block: BlocoCronograma) => void
  onBlockDelete?: (blockId: string) => void
  onBlockChangePriority?: (blockId: string, newPriority: 0 | 1 | 2) => void
  onBlockToggleComplete?: (blockId: string) => void
}

export function TimeSlot({
  slot,
  slotIndex,
  dia,
  turno,
  officialClass,
  customBlock,
  isDropTarget,
  dropMode,
  onClick,
  onBlockEdit,
  onBlockDelete,
  onBlockChangePriority,
  onBlockToggleComplete,
}: TimeSlotProps) {
  const isOccupied = !!officialClass || !!customBlock

  const { setNodeRef, isOver } = useDroppable({
    id: `${dia}-${turno}-${slotIndex}`,
    data: { dia, turno, slotIndex },
    disabled: !!officialClass,
  })

  // Estilos baseados no estado
  const getContainerStyles = () => {
    if (officialClass) {
      return 'bg-[#f1f1ef] border-[#e3e2e0] cursor-not-allowed'
    }
    if (isDropTarget) {
      if (dropMode === 'blocked') {
        return 'bg-[#fef2f2] border-[#dc2626] border-2 cursor-not-allowed shadow-inner'
      }
      if (dropMode === 'swap') {
        return 'bg-[#f0fdf4] border-[#16a34a] border-2 cursor-pointer ring-2 ring-[#16a34a]/30 shadow-md'
      }
      // dropMode === 'move' - empty slot
      return 'bg-[#eff6ff] border-[#2383e2] border-2 cursor-pointer shadow-md'
    }
    if (customBlock) {
      return 'bg-white border-[#e3e2e0]'
    }
    if (isOver) {
      return 'bg-[#eff6ff] border-[#2383e2] border-2 cursor-pointer'
    }
    return 'bg-white border-[#e3e2e0] hover:border-[#2383e2] hover:bg-[#f7f6f3] cursor-pointer'
  }

  return (
    <div
      ref={setNodeRef}
      onClick={isOccupied || isDropTarget ? undefined : onClick}
      className={`
        relative rounded-md border p-2.5 min-h-[56px]
        transition-all duration-100
        ${getContainerStyles()}
      `}
    >
      {/* Horário */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#9ca3af]">
          {slot.inicio}
        </span>
        {!isOccupied && !isOver && !isDropTarget && (
          <svg className="w-3.5 h-3.5 text-[#e3e2e0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
      </div>

      {/* Aula Oficial */}
      {officialClass && (
        <div
          className="mt-1.5 px-2 py-1.5 bg-[#6b7280] text-white text-xs font-medium rounded"
          title={`${officialClass.disciplina}${officialClass.professor ? ` - ${officialClass.professor}` : ''}`}
        >
          <div className="line-clamp-1">{officialClass.disciplina}</div>
        </div>
      )}

      {/* Bloco Customizado */}
      {customBlock && !officialClass && (
        <div className="mt-1.5">
          <DraggableBlockCard
            block={customBlock}
            onEdit={onBlockEdit ? () => onBlockEdit(customBlock) : undefined}
            onDelete={onBlockDelete ? () => onBlockDelete(customBlock.id) : undefined}
            onChangePriority={
              onBlockChangePriority
                ? (newPriority) => onBlockChangePriority(customBlock.id, newPriority)
                : undefined
            }
            onToggleComplete={
              onBlockToggleComplete
                ? () => onBlockToggleComplete(customBlock.id)
                : undefined
            }
          />
        </div>
      )}

      {/* Estado de Drop - Slot vazio (move para espaço vazio) */}
      {(isDropTarget && dropMode === 'move') && !isOccupied && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#eff6ff]/90 rounded-md z-10 border-2 border-dashed border-[#2383e2]">
          <span className="text-xs font-medium text-[#1d4ed8]">Mover aqui</span>
        </div>
      )}

      {/* Estado de hover (isOver) - quando está arrastando sobre */}
      {isOver && !isOccupied && !isDropTarget && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#eff6ff]/60 rounded-md z-10">
          <span className="text-xs font-medium text-[#1d4ed8]">Soltar aqui</span>
        </div>
      )}

      {/* Estado de Drop - Troca de blocos */}
      {isDropTarget && dropMode === 'swap' && customBlock && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f0fdf4]/90 rounded-md border-2 border-dashed border-[#16a34a]">
          <svg className="w-5 h-5 text-[#16a34a] mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span className="text-[10px] font-medium text-[#166534]">Trocar</span>
        </div>
      )}

      {/* Estado de Drop - Bloqueado */}
      {isDropTarget && dropMode === 'blocked' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#fef2f2]/90 rounded-md">
          <svg className="w-5 h-5 text-[#dc2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
      )}
    </div>
  )
}
