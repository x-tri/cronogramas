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
      return 'bg-gray-100 border-gray-200 cursor-not-allowed'
    }
    if (customBlock) {
      return 'bg-white border-gray-200'
    }
    if (isOver) {
      return 'bg-blue-50 border-blue-300 border-2 cursor-pointer'
    }
    return 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer'
  }

  return (
    <div
      ref={setNodeRef}
      onClick={isOccupied ? undefined : onClick}
      className={`
        relative rounded-lg border p-2
        transition-all duration-150
        ${getContainerStyles()}
      `}
    >
      {/* Horário */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-gray-500">
          {slot.inicio}
        </span>
        {!isOccupied && !isOver && (
          <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
      </div>

      {/* Aula Oficial */}
      {officialClass && (
        <div
          className="px-2 py-1.5 bg-gray-500 text-white text-[11px] font-medium rounded"
          title={`${officialClass.disciplina}${officialClass.professor ? ` - ${officialClass.professor}` : ''}`}
        >
          <div className="line-clamp-2">{officialClass.disciplina}</div>
        </div>
      )}

      {/* Bloco Customizado */}
      {customBlock && !officialClass && (
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
      )}

      {/* Estado de Drop */}
      {isOver && !isOccupied && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-100/50 rounded">
          <span className="text-[10px] font-medium text-blue-700">Soltar aqui</span>
        </div>
      )}
    </div>
  )
}
