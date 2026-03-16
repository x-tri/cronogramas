import type { BlocoCronograma, DiaSemana, HorarioOficial, Turno } from '../../types/domain'
import { DIAS_SEMANA_LABELS, TURNO_LABELS, TURNOS } from '../../types/domain'
import { DIAS_CONFIG, TURNOS_CONFIG } from '../../constants/time-slots'
import { KanbanCell } from './kanban-cell'

interface KanbanColumnProps {
  dia: DiaSemana
  date?: Date
  officialSchedule: HorarioOficial[]
  blocks?: BlocoCronograma[]
  dropTarget?: { dia: DiaSemana; turno: Turno; slotIndex: number } | null
  dropMode?: 'swap' | 'move' | 'blocked'
  onSlotClick?: (turno: Turno, slotIndex: number) => void
  onBlockSlotClick?: (turno: Turno, slotIndex: number) => void
  onBlockEdit?: (block: BlocoCronograma) => void
  onBlockDelete?: (blockId: string) => void
  onBlockChangePriority?: (blockId: string, newPriority: 0 | 1 | 2) => void
  onBlockToggleComplete?: (blockId: string) => void
}

export function KanbanColumn({
  dia,
  date,
  officialSchedule,
  blocks = [],
  dropTarget,
  dropMode,
  onSlotClick,
  onBlockSlotClick,
  onBlockEdit,
  onBlockDelete,
  onBlockChangePriority,
  onBlockToggleComplete,
}: KanbanColumnProps) {
  const diaConfig = DIAS_CONFIG[dia]
  const isWeekend = diaConfig.livre

  // Calcular ocupação do dia
  const totalSlots = TURNOS.reduce((acc, t) => acc + TURNOS_CONFIG[t].slots.length, 0)
  const officialCount = officialSchedule.filter((h) => h.diaSemana === dia).length
  const blockCount = blocks.filter((b) => b.diaSemana === dia).length
  const occupiedCount = officialCount + blockCount
  const occupancyPct = totalSlots > 0 ? (occupiedCount / totalSlots) * 100 : 0

  // Formatar data: "10/03"
  const dateLabel = date
    ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null

  // Verificar se é hoje
  const isToday = date
    ? new Date().toDateString() === date.toDateString()
    : false

  return (
    <div
      className={`
        flex flex-col rounded-lg min-w-[140px]
        ${isWeekend 
          ? 'bg-[#f0fdf4]' 
          : 'bg-white'
        }
      `}
    >
      {/* Header do Dia */}
      <div
        className={`
          px-2 pt-2.5 pb-2 text-center border-b-2
          ${isWeekend ? 'border-[#10b981]' : isToday ? 'border-[#0071e3]' : 'border-[#e3e2e0]'}
        `}
      >
        {/* Nome do dia */}
        <h3 className={`
          text-sm font-semibold leading-none
          ${isWeekend ? 'text-[#047857]' : isToday ? 'text-[#0071e3]' : 'text-[#37352f]'}
        `}>
          {DIAS_SEMANA_LABELS[dia]}
        </h3>

        {/* Data real */}
        {dateLabel && (
          <div className="flex items-center justify-center gap-1 mt-1">
            {isToday && (
              <span className="w-1.5 h-1.5 bg-[#0071e3] rounded-full" />
            )}
            <span className={`text-[11px] font-medium tabular-nums ${
              isToday ? 'text-[#0071e3]' : isWeekend ? 'text-[#10b981]' : 'text-[#9ca3af]'
            }`}>
              {dateLabel}
            </span>
          </div>
        )}

        {/* Barra de ocupação */}
        <div className="mt-2 px-1">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] text-[#c1c0bb] tabular-nums">
              {occupiedCount}/{totalSlots}
            </span>
            {isWeekend && (
              <span className="text-[9px] font-medium text-[#10b981] uppercase tracking-wide">Livre</span>
            )}
          </div>
          <div className="h-1 w-full bg-[#f1f1ef] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isWeekend ? 'bg-[#10b981]' :
                isToday ? 'bg-[#0071e3]' :
                occupancyPct > 70 ? 'bg-[#f97316]' : 'bg-[#9ca3af]'
              }`}
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Turnos */}
      <div className="flex-1 p-2 space-y-2">
        {TURNOS.map((turno) => (
          <div key={turno} className="space-y-1">
            {/* Label do Turno */}
            <div className="flex items-center gap-1.5">
              <div className="h-px flex-1 bg-[#e3e2e0]" />
              <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">
                {TURNO_LABELS[turno]}
              </span>
              <div className="h-px flex-1 bg-[#e3e2e0]" />
            </div>
            
            <KanbanCell
              dia={dia}
              turno={turno}
              officialSchedule={officialSchedule}
              isDropTarget={dropTarget?.dia === dia && dropTarget?.turno === turno}
              dropSlotIndex={dropTarget?.dia === dia && dropTarget?.turno === turno ? dropTarget?.slotIndex : undefined}
              dropMode={dropMode}
              onSlotClick={(slotIndex) => onSlotClick?.(turno, slotIndex)}
              onBlockSlotClick={(slotIndex) => onBlockSlotClick?.(turno, slotIndex)}
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
