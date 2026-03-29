import { DndContext, DragOverlay, pointerWithin, useSensor, useSensors, PointerSensor, defaultDropAnimationSideEffects } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent, DragOverEvent, DropAnimation } from '@dnd-kit/core'
import { useState, useCallback, useMemo } from 'react'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { DIAS_SEMANA, DIAS_SEMANA_LABELS, TURNOS, TURNO_LABELS, type BlocoCronograma, type DiaSemana, type Turno } from '../../types/domain'
import { TURNOS_CONFIG, getSlotByIndex } from '../../constants/time-slots'
import { getWeekBounds } from '../week-utils'
import { detectAreaFromTitle } from '../../constants/colors'
import { KanbanSlot } from './kanban-slot'

type KanbanBoardProps = {
  onSlotClick?: (dia: DiaSemana, turno: Turno, slotIndex: number) => void
  onBlockEdit?: (block: BlocoCronograma) => void
}

const TURNO_BANNER: Record<Turno, { bg: string; icon: string }> = {
  manha: { bg: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', icon: '\u2600\uFE0F' },
  tarde: { bg: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)', icon: '\uD83C\uDF24\uFE0F' },
  noite: { bg: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', icon: '\uD83C\uDF19' },
}

export function KanbanBoard({ onSlotClick, onBlockEdit }: KanbanBoardProps) {
  const officialSchedule = useCronogramaStore((state) => state.officialSchedule)
  const isLoadingSchedule = useCronogramaStore((state) => state.isLoadingSchedule)
  const blocks = useCronogramaStore((state) => state.blocks)
  const selectedWeek = useCronogramaStore((state) => state.selectedWeek)
  const removeBlock = useCronogramaStore((state) => state.removeBlock)
  const moveBlock = useCronogramaStore((state) => state.moveBlock)
  const swapBlocks = useCronogramaStore((state) => state.swapBlocks)

  const dayDates = useMemo(() => {
    const { start } = getWeekBounds(selectedWeek)
    return {
      segunda: new Date(start),
      terca: new Date(new Date(start).setDate(start.getDate() + 1)),
      quarta: new Date(new Date(start).setDate(start.getDate() + 2)),
      quinta: new Date(new Date(start).setDate(start.getDate() + 3)),
      sexta: new Date(new Date(start).setDate(start.getDate() + 4)),
      sabado: new Date(new Date(start).setDate(start.getDate() + 5)),
      domingo: new Date(new Date(start).setDate(start.getDate() + 6)),
    } as Record<DiaSemana, Date>
  }, [selectedWeek])

  const [activeBlock, setActiveBlock] = useState<BlocoCronograma | null>(null)
  const [dropTarget, setDropTarget] = useState<{ dia: DiaSemana; turno: Turno; slotIndex: number } | null>(null)
  const [dropMode, setDropMode] = useState<'swap' | 'move' | 'blocked'>('blocked')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

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
    try { await removeBlock(block.id) } catch (err) { console.error('Failed to unblock:', err) }
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const block = blocks.find((b) => b.id === event.active.id)
    if (block) setActiveBlock(block)
  }, [blocks])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event
    if (!over) { setDropTarget(null); return }
    const dropData = over.data.current as { dia: DiaSemana; turno: Turno; slotIndex: number } | undefined
    if (!dropData) { setDropTarget(null); return }
    const { dia, turno, slotIndex } = dropData
    const slot = getSlotByIndex(turno, slotIndex)
    if (!slot) { setDropTarget(null); return }
    const isOccupiedByOfficial = officialSchedule.some(
      (h) => h.diaSemana === dia && h.turno === turno && h.horarioInicio === slot.inicio
    )
    if (isOccupiedByOfficial) { setDropTarget({ dia, turno, slotIndex }); setDropMode('blocked'); return }
    const occupyingBlock = blocks.find(
      (b) => b.diaSemana === dia && b.turno === turno && b.horarioInicio === slot.inicio
    )
    setDropTarget({ dia, turno, slotIndex })
    setDropMode(occupyingBlock && occupyingBlock.id !== activeBlock?.id ? 'swap' : 'move')
  }, [blocks, officialSchedule, activeBlock])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveBlock(null)
    setDropTarget(null)
    const { active, over } = event
    if (!over) return
    const blockId = active.id as string
    const dropData = over.data.current as { dia: DiaSemana; turno: Turno; slotIndex: number } | undefined
    if (!dropData) return
    const { dia, turno, slotIndex } = dropData
    const slot = getSlotByIndex(turno, slotIndex)
    if (!slot) return
    const isOccupiedByOfficial = officialSchedule.some(
      (h) => h.diaSemana === dia && h.turno === turno && h.horarioInicio === slot.inicio
    )
    if (isOccupiedByOfficial) return
    const targetBlock = blocks.find(
      (b) => b.diaSemana === dia && b.turno === turno && b.horarioInicio === slot.inicio && b.id !== blockId
    )
    try {
      if (targetBlock) await swapBlocks(blockId, targetBlock.id)
      else await moveBlock(blockId, dia, turno, slotIndex)
    } catch (err) { console.error('Failed to move/swap block:', err) }
  }, [blocks, officialSchedule, moveBlock, swapBlocks])

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }),
  }

  if (isLoadingSchedule) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto" />
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-64 bg-gray-200 rounded" />)}
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full overflow-x-auto">
        <div className="min-w-[900px]">

          {/* Legend — same as timeline */}
          <div className="timetable-legend" style={{ borderRadius: '10px', marginBottom: 0, borderBottom: 'none' }}>
            <div className="timetable-legend-item">
              <div className="legend-dot" style={{ background: '#e5e7eb' }} /><span>Aula Oficial</span>
            </div>
            <div className="timetable-legend-item">
              <div className="legend-dot" style={{ background: '#3b82f6' }} /><span>Estudo</span>
            </div>
            <div className="timetable-legend-item">
              <div className="legend-dot" style={{ background: '#f59e0b' }} /><span>Revisão</span>
            </div>
            <div className="timetable-legend-item">
              <div className="legend-dot blocked-dot" /><span>Bloqueado</span>
            </div>
            <div className="timetable-legend-item" style={{ marginLeft: 'auto', color: '#94a3b8' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span>Arraste blocos para trocar</span>
            </div>
          </div>

          {TURNOS.map((turno) => {
            const config = TURNOS_CONFIG[turno]
            const banner = TURNO_BANNER[turno]

            return (
              <div key={turno} className="mb-1">
                {/* Turno Banner */}
                <div className="turno-banner" style={{ background: banner.bg }}>
                  <span className="turno-banner-icon">{banner.icon}</span>
                  <span className="turno-banner-label">{TURNO_LABELS[turno].toUpperCase()}</span>
                  <span className="turno-banner-time">{config.inicio} – {config.fim}</span>
                </div>

                {/* Day headers */}
                <div className="timetable-grid timetable-header">
                  <div className="timetable-time-col">HORÁRIO</div>
                  {DIAS_SEMANA.map((dia) => {
                    const date = dayDates[dia]
                    const today = isToday(date)
                    const isWeekend = dia === 'sabado' || dia === 'domingo'
                    return (
                      <div key={dia} className={`timetable-day-header ${today ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}>
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

                {/* Slot rows */}
                {config.slots.map((slot, slotIndex) => (
                  <div key={slot.inicio} className="timetable-grid timetable-row">
                    <div className="timetable-time-cell">{slot.inicio}</div>

                    {DIAS_SEMANA.map((dia) => {
                      const official = getOfficial(dia, turno, slot.inicio)
                      const block = getBlock(dia, turno, slot.inicio)
                      const isWeekend = dia === 'sabado' || dia === 'domingo'
                      const today = isToday(dayDates[dia])
                      const isTarget = dropTarget?.dia === dia && dropTarget?.turno === turno && dropTarget?.slotIndex === slotIndex

                      return (
                        <KanbanSlot
                          key={dia}
                          dia={dia}
                          turno={turno}
                          slotIndex={slotIndex}
                          slot={slot}
                          official={official}
                          block={block}
                          isWeekend={isWeekend}
                          today={today}
                          isDropTarget={isTarget}
                          dropMode={isTarget ? dropMode : undefined}
                          onSlotClick={() => onSlotClick?.(dia, turno, slotIndex)}
                          onBlockEdit={onBlockEdit}
                          onUnblock={handleUnblock}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeBlock && (() => {
          const area = detectAreaFromTitle(activeBlock.titulo) || 'outros'
          const AREA_STYLES: Record<string, { bg: string; border: string; text: string }> = {
            natureza:   { bg: '#f0fdf4', border: '#10b981', text: '#065f46' },
            matematica: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
            linguagens: { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a5f' },
            humanas:    { bg: '#fff7ed', border: '#f97316', text: '#7c2d12' },
            outros:     { bg: '#f5f3ff', border: '#8b5cf6', text: '#4c1d95' },
          }
          const style = AREA_STYLES[area] ?? AREA_STYLES.outros
          return (
            <div
              className="opacity-90 rotate-1 shadow-2xl rounded-md px-2 py-1.5"
              style={{ backgroundColor: style.bg, borderLeft: `3px solid ${style.border}`, minWidth: 120 }}
            >
              <span style={{ color: style.text, fontSize: 12, fontWeight: 700 }}>{activeBlock.titulo}</span>
            </div>
          )
        })()}
      </DragOverlay>
    </DndContext>
  )
}
