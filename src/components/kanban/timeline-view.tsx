import { useCronogramaStore } from '../../stores/cronograma-store'
import { DIAS_SEMANA, DIAS_SEMANA_LABELS, TURNOS, TURNO_LABELS } from '../../types/domain'
import type { BlocoCronograma, DiaSemana, Turno } from '../../types/domain'
import { TURNOS_CONFIG } from '../../constants/time-slots'
import { detectAreaFromTitle } from '../../constants/colors'

type TimelineViewProps = {
  dayDates: Record<DiaSemana, Date>
  onSlotClick?: (dia: DiaSemana, turno: Turno, slotIndex: number) => void
  onBlockEdit?: (block: BlocoCronograma) => void
}

const AREA_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  natureza:   { bg: 'bg-[#f0fdf4]', border: 'border-l-2 border-l-[#10b981]', text: 'text-[#047857]', dot: 'bg-[#10b981]' },
  matematica: { bg: 'bg-[#fef2f2]', border: 'border-l-2 border-l-[#ef4444]', text: 'text-[#b91c1c]', dot: 'bg-[#ef4444]' },
  linguagens: { bg: 'bg-[#eff6ff]', border: 'border-l-2 border-l-[#3b82f6]', text: 'text-[#1d4ed8]', dot: 'bg-[#3b82f6]' },
  humanas:    { bg: 'bg-[#fff7ed]', border: 'border-l-2 border-l-[#f97316]', text: 'text-[#c2410c]', dot: 'bg-[#f97316]' },
  outros:     { bg: 'bg-[#f5f3ff]', border: 'border-l-2 border-l-[#8b5cf6]', text: 'text-[#7c3aed]', dot: 'bg-[#8b5cf6]' },
}

export function TimelineView({ dayDates, onSlotClick, onBlockEdit }: TimelineViewProps) {
  const officialSchedule = useCronogramaStore((s) => s.officialSchedule)
  const blocks = useCronogramaStore((s) => s.blocks)

  const isToday = (date: Date) => new Date().toDateString() === date.toDateString()

  function getOfficial(dia: DiaSemana, turno: Turno, slotInicio: string) {
    return officialSchedule.find(
      (h) => h.diaSemana === dia && h.turno === turno && h.horarioInicio === slotInicio
    )
  }

  function getBlock(dia: DiaSemana, turno: Turno, slotInicio: string) {
    return blocks.find(
      (b) => b.diaSemana === dia && b.turno === turno && b.horarioInicio === slotInicio
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[700px]">

        {/* Header — dias */}
        <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-px bg-[#e3e2e0] rounded-t-lg overflow-hidden">
          {/* Canto vazio */}
          <div className="bg-[#f7f6f3] px-2 py-3" />
          {DIAS_SEMANA.map((dia) => {
            const date = dayDates[dia]
            const today = isToday(date)
            const isWeekend = dia === 'sabado' || dia === 'domingo'
            return (
              <div
                key={dia}
                className={`px-2 py-3 text-center ${
                  today ? 'bg-[#0071e3]' : isWeekend ? 'bg-[#f0fdf4]' : 'bg-[#f7f6f3]'
                }`}
              >
                <p className={`text-[11px] font-bold uppercase tracking-wider ${
                  today ? 'text-white/80' : isWeekend ? 'text-[#047857]' : 'text-[#9ca3af]'
                }`}>
                  {DIAS_SEMANA_LABELS[dia].slice(0, 3)}
                </p>
                <p className={`text-[13px] font-semibold tabular-nums mt-0.5 ${
                  today ? 'text-white' : isWeekend ? 'text-[#047857]' : 'text-[#1d1d1f]'
                }`}>
                  {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </p>
              </div>
            )
          })}
        </div>

        {/* Body — turnos e slots */}
        <div className="border border-t-0 border-[#e3e2e0] rounded-b-lg overflow-hidden">
          {TURNOS.map((turno, turnoIdx) => (
            <div key={turno}>
              {/* Separador de turno */}
              <div className={`grid grid-cols-[64px_repeat(7,1fr)] gap-px bg-[#e3e2e0] ${turnoIdx > 0 ? 'border-t-2 border-t-[#d1d0cb]' : ''}`}>
                <div className="bg-[#f1f1ef] col-span-8 px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
                    {TURNO_LABELS[turno]}
                  </span>
                  <span className="text-[10px] text-[#c1c0bb]">
                    {TURNOS_CONFIG[turno].inicio} – {TURNOS_CONFIG[turno].fim}
                  </span>
                </div>
              </div>

              {/* Slots do turno */}
              {TURNOS_CONFIG[turno].slots.map((slot, slotIndex) => (
                <div
                  key={slot.inicio}
                  className="grid grid-cols-[64px_repeat(7,1fr)] gap-px bg-[#e3e2e0]"
                >
                  {/* Hora */}
                  <div className="bg-[#f7f6f3] flex items-center justify-end pr-2.5 py-1.5">
                    <span className="text-[11px] font-medium text-[#9ca3af] tabular-nums">
                      {slot.inicio}
                    </span>
                  </div>

                  {/* Células por dia */}
                  {DIAS_SEMANA.map((dia) => {
                    const official = getOfficial(dia, turno, slot.inicio)
                    const block = getBlock(dia, turno, slot.inicio)
                    const isWeekend = dia === 'sabado' || dia === 'domingo'
                    const today = isToday(dayDates[dia])

                    if (official) {
                      return (
                        <div
                          key={dia}
                          className="bg-[#f1f1ef] px-2 py-1.5 min-h-[44px] flex items-center"
                          title={`${official.disciplina}${official.professor ? ` — ${official.professor}` : ''}`}
                        >
                          <div className="w-full">
                            <p className="text-[11px] font-semibold text-[#6b7280] line-clamp-1 leading-tight">
                              {official.disciplina}
                            </p>
                            {official.professor && (
                              <p className="text-[10px] text-[#9ca3af] line-clamp-1 mt-0.5">
                                {official.professor}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    }

                    if (block) {
                      const area = detectAreaFromTitle(block.titulo) || 'outros'
                      const style = AREA_STYLES[area] ?? AREA_STYLES.outros
                      return (
                        <div
                          key={dia}
                          onClick={() => onBlockEdit?.(block)}
                          className={`
                            ${style.bg} ${style.border}
                            px-2 py-1.5 min-h-[44px] flex items-center cursor-pointer
                            hover:brightness-95 transition-all
                            ${block.concluido ? 'opacity-60' : ''}
                          `}
                        >
                          <div className="w-full">
                            <div className="flex items-start gap-1">
                              <span className={`mt-[3px] flex-shrink-0 w-1.5 h-1.5 rounded-full ${style.dot}`} />
                              <p className={`text-[11px] font-semibold line-clamp-2 leading-tight ${style.text}`}>
                                {block.titulo}
                              </p>
                            </div>
                            {block.concluido && (
                              <p className="text-[10px] text-[#22c55e] mt-0.5">✓ Concluído</p>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // Slot vazio
                    return (
                      <div
                        key={dia}
                        onClick={() => onSlotClick?.(dia, turno, slotIndex)}
                        className={`
                          group min-h-[44px] px-2 py-1.5 flex items-center cursor-pointer
                          transition-colors duration-100
                          ${today
                            ? 'bg-[#f0f7ff] hover:bg-[#dbeafe]'
                            : isWeekend
                            ? 'bg-[#f9fefb] hover:bg-[#dcfce7]'
                            : 'bg-white hover:bg-[#f0f7ff]'
                          }
                        `}
                      >
                        <svg
                          className="w-3 h-3 text-[#e3e2e0] group-hover:text-[#93c5fd] transition-colors mx-auto"
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
