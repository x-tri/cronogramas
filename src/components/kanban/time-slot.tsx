import { useDroppable } from '@dnd-kit/core'
import type {
  BlocoCronograma,
  DiaSemana,
  HorarioOficial,
  TimeSlot as TimeSlotType,
  Turno,
} from '../../types/domain'
import { CORES_TIPOS } from '../../constants/colors'
import { DraggableBlockCard } from '../blocks/draggable-block-card'

type TimeSlotProps = {
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

  return (
    <div
      ref={setNodeRef}
      onClick={isOccupied ? undefined : onClick}
      className={`
        relative p-2 rounded-lg border text-xs
        transition-all duration-150
        ${
          officialClass
            ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
            : customBlock
              ? 'bg-white border-gray-200'
              : isOver
                ? 'bg-blue-100 border-blue-400 border-2'
                : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
        }
      `}
    >
      {/* Time label */}
      <div className="text-[10px] text-gray-400 mb-1">
        {slot.inicio} - {slot.fim}
      </div>

      {/* Official class content */}
      {officialClass && (
        <div
          className="px-2 py-1 rounded text-white text-[11px] font-medium truncate"
          style={{ backgroundColor: CORES_TIPOS.aula_oficial }}
          title={`${officialClass.disciplina} - ${officialClass.professor}`}
        >
          {officialClass.disciplina}
        </div>
      )}

      {/* Custom block content */}
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

      {/* Empty slot indicator */}
      {!isOccupied && (
        <div className="h-6 flex items-center justify-center text-gray-300">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </div>
      )}
    </div>
  )
}
