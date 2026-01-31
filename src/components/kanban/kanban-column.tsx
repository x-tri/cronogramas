import type { BlocoCronograma, DiaSemana, HorarioOficial, Turno } from '../../types/domain'
import { DIAS_SEMANA_LABELS, TURNO_LABELS, TURNOS } from '../../types/domain'
import { DIAS_CONFIG } from '../../constants/time-slots'
import { KanbanCell } from './kanban-cell'

interface KanbanColumnProps {
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
        flex flex-col rounded-lg border overflow-hidden
        ${isWeekend 
          ? 'bg-emerald-50/50 border-emerald-200' 
          : 'bg-white border-gray-200'
        }
      `}
    >
      {/* Header do Dia */}
      <div
        className={`
          px-3 py-2.5 text-center border-b
          ${isWeekend 
            ? 'bg-emerald-100/70 border-emerald-200' 
            : 'bg-gray-100 border-gray-200'
          }
        `}
      >
        <h3 className={`
          text-sm font-semibold
          ${isWeekend ? 'text-emerald-900' : 'text-gray-800'}
        `}>
          {DIAS_SEMANA_LABELS[dia]}
        </h3>
        {isWeekend && (
          <span className="text-[10px] font-medium text-emerald-700 uppercase tracking-wide">
            Livre
          </span>
        )}
      </div>

      {/* Turnos */}
      <div className="flex-1 p-2 space-y-3">
        {TURNOS.map((turno) => (
          <div key={turno} className="space-y-1.5">
            {/* Label do Turno */}
            <div className="flex items-center gap-1.5">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {TURNO_LABELS[turno]}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            
            <KanbanCell
              dia={dia}
              turno={turno}
              officialSchedule={officialSchedule}
              onSlotClick={(slotIndex) => onSlotClick?.(turno, slotIndex)}
              onBlockEdit={onBlockEdit}
              onBlockDelete={onBlockDelete}
              onBlockChangePriority={onBlockChangePriority}
              onBlockToggleComplete={onBlockToggleComplete}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
