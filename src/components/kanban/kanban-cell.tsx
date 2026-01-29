import type { BlocoCronograma, DiaSemana, HorarioOficial, Turno } from '../../types/domain'
import { TURNOS_CONFIG } from '../../constants/time-slots'
import { TURNO_LABELS } from '../../types/domain'
import { TimeSlot } from './time-slot'
import { useCronogramaStore } from '../../stores/cronograma-store'

type KanbanCellProps = {
  dia: DiaSemana
  turno: Turno
  officialSchedule: HorarioOficial[]
  onSlotClick?: (slotIndex: number) => void
  onBlockEdit?: (block: BlocoCronograma) => void
  onBlockDelete?: (blockId: string) => void
  onBlockChangePriority?: (blockId: string, newPriority: 0 | 1 | 2) => void
}

export function KanbanCell({
  dia,
  turno,
  officialSchedule,
  onSlotClick,
  onBlockEdit,
  onBlockDelete,
  onBlockChangePriority,
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
    <div className="bg-gray-50 rounded-lg p-2 min-h-[120px]">
      {/* Turno label */}
      <div className="text-[10px] font-medium text-gray-500 mb-2 uppercase tracking-wide">
        {TURNO_LABELS[turno]}
      </div>

      {/* Time slots */}
      <div className="space-y-1">
        {turnoConfig.slots.map((slot, index) => {
          const officialClass = getOfficialForSlot(slot.inicio)
          const customBlock = getBlockForSlot(slot.inicio)

          return (
            <TimeSlot
              key={slot.inicio}
              slot={slot}
              officialClass={officialClass}
              customBlock={customBlock}
              onClick={() => onSlotClick?.(index)}
              onBlockEdit={onBlockEdit}
              onBlockDelete={onBlockDelete}
              onBlockChangePriority={onBlockChangePriority}
            />
          )
        })}
      </div>
    </div>
  )
}
