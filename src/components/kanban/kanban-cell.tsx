import type { BlocoCronograma, DiaSemana, HorarioOficial, Turno } from '../../types/domain'
import { TURNOS_CONFIG } from '../../constants/time-slots'
import { TimeSlot } from './time-slot'
import { useCronogramaStore } from '../../stores/cronograma-store'

interface KanbanCellProps {
  dia: DiaSemana
  turno: Turno
  officialSchedule: HorarioOficial[]
  isDropTarget?: boolean
  dropSlotIndex?: number
  dropMode?: 'swap' | 'move' | 'blocked'
  onSlotClick?: (slotIndex: number) => void
  onBlockSlotClick?: (slotIndex: number) => void
  onBlockEdit?: (block: BlocoCronograma) => void
  onBlockDelete?: (blockId: string) => void
  onBlockChangePriority?: (blockId: string, newPriority: 0 | 1 | 2) => void
  onBlockToggleComplete?: (blockId: string) => void
}

export function KanbanCell({
  dia,
  turno,
  officialSchedule,
  isDropTarget,
  dropSlotIndex,
  dropMode,
  onSlotClick,
  onBlockSlotClick,
  onBlockEdit,
  onBlockDelete,
  onBlockChangePriority,
  onBlockToggleComplete,
}: KanbanCellProps) {
  const turnoConfig = TURNOS_CONFIG[turno]
  const blocks = useCronogramaStore((state) => state.blocks)

  const getOfficialForSlot = (slotInicio: string): HorarioOficial | undefined => {
    return officialSchedule.find(
      (h) => h.diaSemana === dia && h.turno === turno && h.horarioInicio === slotInicio
    )
  }

  const getBlockForSlot = (slotInicio: string): BlocoCronograma | undefined => {
    return blocks.find(
      (b) => b.diaSemana === dia && b.turno === turno && b.horarioInicio === slotInicio
    )
  }

  return (
    <div className="bg-white rounded border border-[#f1f1ef] p-1 space-y-0.5">
      {turnoConfig.slots.map((slot, index) => {
        const officialClass = getOfficialForSlot(slot.inicio)
        const customBlock = getBlockForSlot(slot.inicio)

        const isTargetSlot = isDropTarget && dropSlotIndex === index

        return (
          <TimeSlot
            key={slot.inicio}
            slot={slot}
            slotIndex={index}
            dia={dia}
            turno={turno}
            officialClass={officialClass}
            customBlock={customBlock}
            isDropTarget={isTargetSlot}
            dropMode={isTargetSlot ? dropMode : undefined}
            onClick={() => onSlotClick?.(index)}
            onBlockSlotClick={() => onBlockSlotClick?.(index)}
            onBlockEdit={onBlockEdit}
            onBlockDelete={onBlockDelete}
            onBlockChangePriority={onBlockChangePriority}
            onBlockToggleComplete={onBlockToggleComplete}
          />
        )
      })}
    </div>
  )
}
