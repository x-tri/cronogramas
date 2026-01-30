import type { BlocoCronograma, DiaSemana, HorarioOficial, Turno } from '../../types/domain'
import { DIAS_SEMANA_LABELS, TURNOS } from '../../types/domain'
import { DIAS_CONFIG } from '../../constants/time-slots'
import { KanbanCell } from './kanban-cell'

type KanbanColumnProps = {
  dia: DiaSemana
  officialSchedule: HorarioOficial[]
  onSlotClick?: (turno: Turno, slotIndex: number) => void
  onBlockEdit?: (block: BlocoCronograma) => void
  onBlockDelete?: (blockId: string) => void
  onBlockChangePriority?: (blockId: string, newPriority: 0 | 1 | 2) => void
  onBlockToggleComplete?: (blockId: string) => void
}

export function KanbanColumn({
  dia,
  officialSchedule,
  onSlotClick,
  onBlockEdit,
  onBlockDelete,
  onBlockChangePriority,
  onBlockToggleComplete,
}: KanbanColumnProps) {
  const diaConfig = DIAS_CONFIG[dia]
  const isWeekend = diaConfig.livre

  return (
    <div
      className={`
        flex flex-col rounded-xl border
        ${isWeekend ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}
      `}
    >
      {/* Day header */}
      <div
        className={`
          px-3 py-2 text-center font-semibold text-sm border-b
          ${isWeekend ? 'bg-green-100 border-green-200 text-green-800' : 'bg-gray-100 border-gray-200 text-gray-700'}
        `}
      >
        {DIAS_SEMANA_LABELS[dia]}
        {isWeekend && (
          <span className="ml-1 text-xs font-normal">(Livre)</span>
        )}
      </div>

      {/* Turno cells */}
      <div className="flex-1 p-2 space-y-2">
        {TURNOS.map((turno) => (
          <KanbanCell
            key={turno}
            dia={dia}
            turno={turno}
            officialSchedule={officialSchedule}
            onSlotClick={(slotIndex) => onSlotClick?.(turno, slotIndex)}
            onBlockEdit={onBlockEdit}
            onBlockDelete={onBlockDelete}
            onBlockChangePriority={onBlockChangePriority}
            onBlockToggleComplete={onBlockToggleComplete}
          />
        ))}
      </div>
    </div>
  )
}
