import { useCronogramaStore } from '../../stores/cronograma-store'
import { DIAS_SEMANA, DIAS_SEMANA_LABELS, TURNOS, TURNO_LABELS } from '../../types/domain'
import type { BlocoCronograma, DiaSemana, Turno } from '../../types/domain'
import { TURNOS_CONFIG } from '../../constants/time-slots'
import { detectAreaFromTitle } from '../../constants/colors'
import { BloquearTurnoButtons } from '../cronograma/bloquear-turno-buttons'

type TimelineViewProps = {
  dayDates: Record<DiaSemana, Date>
  onSlotClick?: (dia: DiaSemana, turno: Turno, slotIndex: number) => void
  onBlockEdit?: (block: BlocoCronograma) => void
}

const AREA_STYLES: Record<string, { bg: string; border: string; text: string; sub: string }> = {
  natureza:   { bg: '#f0fdf4', border: '#10b981', text: '#065f46', sub: '#047857' },
  matematica: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', sub: '#b91c1c' },
  linguagens: { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a5f', sub: '#1d4ed8' },
  humanas:    { bg: '#fff7ed', border: '#f97316', text: '#7c2d12', sub: '#c2410c' },
  outros:     { bg: '#f5f3ff', border: '#8b5cf6', text: '#4c1d95', sub: '#7c3aed' },
}

const TURNO_BANNER: Record<Turno, { bg: string; icon: string }> = {
  manha: { bg: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', icon: '☀️' },
  tarde: { bg: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)', icon: '🌤️' },
  noite: { bg: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', icon: '🌙' },
}

export function TimelineView({ dayDates, onSlotClick, onBlockEdit }: TimelineViewProps) {
  const officialSchedule = useCronogramaStore((s) => s.officialSchedule)
  const blocks = useCronogramaStore((s) => s.blocks)
  const removeBlock = useCronogramaStore((s) => s.removeBlock)

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

  async function handleUnblock(block: BlocoCronograma, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await removeBlock(block.id)
    } catch (err) {
      console.error('Failed to unblock:', err)
    }
  }

  return (
    <div className="w-full overflow-x-auto timetable-container">
      <div className="min-w-[900px]">

        {/* ===== LEGEND ===== */}
        <div className="timetable-legend" style={{ borderRadius: '10px', marginBottom: 0, borderBottom: 'none' }}>
          <div className="timetable-legend-item">
            <div className="legend-dot" style={{ background: '#e5e7eb' }} />
            <span>Aula Oficial</span>
          </div>
          <div className="timetable-legend-item">
            <div className="legend-dot" style={{ background: '#3b82f6' }} />
            <span>Estudo</span>
          </div>
          <div className="timetable-legend-item">
            <div className="legend-dot" style={{ background: '#f59e0b' }} />
            <span>Revisão</span>
          </div>
          <div className="timetable-legend-item">
            <div className="legend-dot blocked-dot" />
            <span>Bloqueado</span>
          </div>
          <div className="timetable-legend-item" style={{ marginLeft: 'auto', color: '#94a3b8' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Clique em slot vazio para adicionar</span>
          </div>
        </div>

        {/* ===== BULK BLOCK BUTTONS (seg–sex por turno) ===== */}
        <div
          className="flex items-center justify-between gap-3 border border-t-0 border-[#e5e7eb] bg-[#fafafa] px-3 py-2"
          style={{ borderRadius: '0 0 10px 10px', marginBottom: 12 }}
        >
          <BloquearTurnoButtons />
        </div>

        {TURNOS.map((turno) => {
          const config = TURNOS_CONFIG[turno]
          const banner = TURNO_BANNER[turno]

          return (
            <div key={turno} className="mb-1">
              {/* ===== TURNO BANNER ===== */}
              <div
                className="turno-banner"
                style={{ background: banner.bg }}
              >
                <span className="turno-banner-icon">{banner.icon}</span>
                <span className="turno-banner-label">{TURNO_LABELS[turno].toUpperCase()}</span>
                <span className="turno-banner-time">{config.inicio} – {config.fim}</span>
              </div>

              {/* ===== HEADER DOS DIAS ===== */}
              <div className="timetable-grid timetable-header">
                <div className="timetable-time-col">HORARIO</div>
                {DIAS_SEMANA.map((dia) => {
                  const date = dayDates[dia]
                  const today = isToday(date)
                  const isWeekend = dia === 'sabado' || dia === 'domingo'
                  return (
                    <div
                      key={dia}
                      className={`timetable-day-header ${today ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
                    >
                      <span className="day-label">{DIAS_SEMANA_LABELS[dia].slice(0, 3).toUpperCase()}</span>
                      {date && (
                        <span className="day-date">
                          {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ===== SLOT ROWS ===== */}
              {config.slots.map((slot, slotIndex) => (
                <div key={slot.inicio} className="timetable-grid timetable-row">
                  {/* Time cell */}
                  <div className="timetable-time-cell">
                    {slot.inicio}
                  </div>

                  {/* Day cells */}
                  {DIAS_SEMANA.map((dia) => {
                    const official = getOfficial(dia, turno, slot.inicio)
                    const block = getBlock(dia, turno, slot.inicio)
                    const isWeekend = dia === 'sabado' || dia === 'domingo'
                    const today = isToday(dayDates[dia])

                    // ---- BLOCKED SLOT ----
                    // Detects blocks with titulo 'Bloqueado' (stored as tipo='rotina' in DB for constraint compatibility)
                    if (block?.titulo === 'Bloqueado') {
                      return (
                        <div
                          key={dia}
                          className="timetable-cell blocked"
                          onClick={(e) => handleUnblock(block, e)}
                          title="Clique para desbloquear"
                        >
                          <svg className="blocked-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                        </div>
                      )
                    }

                    // ---- OFFICIAL CLASS ----
                    if (official) {
                      return (
                        <div
                          key={dia}
                          className="timetable-cell official"
                          title={`${official.disciplina}${official.professor ? ` — ${official.professor}` : ''}`}
                        >
                          <span className="official-title">{official.disciplina}</span>
                          {official.professor && (
                            <span className="official-sub">{official.professor}</span>
                          )}
                        </div>
                      )
                    }

                    // ---- STUDY BLOCK ----
                    if (block) {
                      const area = detectAreaFromTitle(block.titulo) || 'outros'
                      const style = AREA_STYLES[area] ?? AREA_STYLES.outros
                      return (
                        <div
                          key={dia}
                          className={`timetable-cell study-block ${block.concluido ? 'completed' : ''}`}
                          style={{
                            backgroundColor: style.bg,
                            borderLeftColor: style.border,
                          }}
                          onClick={() => onBlockEdit?.(block)}
                          title={block.titulo}
                        >
                          <span className="block-title" style={{ color: style.text }}>
                            {block.titulo}
                          </span>
                          <span className="block-sub" style={{ color: style.sub }}>
                            {block.descricao || (detectAreaFromTitle(block.titulo) ? block.titulo.split('(')[0]?.trim() : '')}
                          </span>
                          <span className="block-time">
                            {slot.inicio} – {slot.fim}
                          </span>
                          {block.concluido && (
                            <span className="block-done">✓</span>
                          )}
                        </div>
                      )
                    }

                    // ---- EMPTY SLOT ----
                    return (
                      <div
                        key={dia}
                        className={`timetable-cell empty ${today ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
                        onClick={() => onSlotClick?.(dia, turno, slotIndex)}
                      >
                        <svg className="empty-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
