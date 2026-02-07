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
      onClick={isOccupied ? undefined : onClick}
      className={`
        relative rounded-md border p-2
        transition-all duration-100
        ${getContainerStyles()}
      `}
    >
      {/* Horário */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#9ca3af]">
          {slot.inicio}
        </span>
        {!isOccupied && !isOver && (
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

      {/* Estado de Drop */}
      {isOver && !isOccupied && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#eff6ff]/80 rounded-md">
          <span className="text-xs font-medium text-[#1d4ed8]">Soltar aqui</span>
        </div>
      )}
    </div>
  )
}
