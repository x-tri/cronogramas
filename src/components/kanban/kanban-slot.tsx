import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import type { BlocoCronograma, DiaSemana, HorarioOficial, Turno, TimeSlot as TimeSlotType } from '../../types/domain'
import { detectAreaFromTitle } from '../../constants/colors'

const AREA_STYLES: Record<string, { bg: string; border: string; text: string; sub: string }> = {
  natureza:   { bg: '#f0fdf4', border: '#10b981', text: '#065f46', sub: '#047857' },
  matematica: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', sub: '#b91c1c' },
  linguagens: { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a5f', sub: '#1d4ed8' },
  humanas:    { bg: '#fff7ed', border: '#f97316', text: '#7c2d12', sub: '#c2410c' },
  outros:     { bg: '#f5f3ff', border: '#8b5cf6', text: '#4c1d95', sub: '#7c3aed' },
}

type KanbanSlotProps = {
  dia: DiaSemana
  turno: Turno
  slotIndex: number
  slot: TimeSlotType
  official?: HorarioOficial
  block?: BlocoCronograma
  isWeekend: boolean
  today: boolean
  isDropTarget?: boolean
  dropMode?: 'swap' | 'move' | 'blocked'
  onSlotClick: () => void
  onBlockEdit?: (block: BlocoCronograma) => void
  onUnblock: (block: BlocoCronograma, e: React.MouseEvent) => void
}

function DraggableStudyBlock({ block, slot, onBlockEdit }: {
  block: BlocoCronograma
  slot: TimeSlotType
  onBlockEdit?: (block: BlocoCronograma) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
  })

  const area = detectAreaFromTitle(block.titulo) || 'outros'
  const style = AREA_STYLES[area] ?? AREA_STYLES.outros

  return (
    <div
      ref={setNodeRef}
      className={`timetable-cell study-block ${block.concluido ? 'completed' : ''} ${isDragging ? 'opacity-40' : ''}`}
      style={{
        backgroundColor: style.bg,
        borderLeftColor: style.border,
        cursor: 'grab',
        touchAction: 'none',
      }}
      onClick={() => onBlockEdit?.(block)}
      title={`${block.titulo} (arraste para trocar)`}
      {...listeners}
      {...attributes}
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
      {block.concluido && <span className="block-done">✓</span>}
    </div>
  )
}

export function KanbanSlot({
  dia,
  turno,
  slotIndex,
  slot,
  official,
  block,
  isWeekend,
  today,
  isDropTarget,
  dropMode,
  onSlotClick,
  onBlockEdit,
  onUnblock,
}: KanbanSlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${dia}-${turno}-${slotIndex}`,
    data: { dia, turno, slotIndex },
    disabled: !!official,
  })

  // Blocked slot
  if (block?.titulo === 'Bloqueado') {
    return (
      <div
        ref={setNodeRef}
        className="timetable-cell blocked"
        onClick={(e) => onUnblock(block, e)}
        title="Clique para desbloquear"
      >
        <svg className="blocked-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      </div>
    )
  }

  // Official class
  if (official) {
    return (
      <div
        ref={setNodeRef}
        className="timetable-cell official"
        title={`${official.disciplina}${official.professor ? ` — ${official.professor}` : ''}`}
      >
        <span className="official-title">{official.disciplina}</span>
        {official.professor && <span className="official-sub">{official.professor}</span>}
      </div>
    )
  }

  // Study block (draggable)
  if (block) {
    // Drop target overlay for swap
    if (isDropTarget && dropMode === 'swap') {
      return (
        <div ref={setNodeRef} className="timetable-cell" style={{
          background: '#f0fdf4',
          borderRight: '1px solid #f1f5f9',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg className="w-5 h-5 text-[#16a34a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#166534' }}>Trocar</span>
        </div>
      )
    }

    return (
      <div ref={setNodeRef} style={{ display: 'contents' }}>
        <DraggableStudyBlock block={block} slot={slot} onBlockEdit={onBlockEdit} />
      </div>
    )
  }

  // Drop target overlay for move
  if (isDropTarget && dropMode === 'move') {
    return (
      <div ref={setNodeRef} className="timetable-cell" style={{
        background: '#eff6ff',
        border: '2px dashed #2563eb',
        borderRadius: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#1d4ed8' }}>Mover aqui</span>
      </div>
    )
  }

  // Drop target blocked
  if (isDropTarget && dropMode === 'blocked') {
    return (
      <div ref={setNodeRef} className="timetable-cell" style={{
        background: '#fef2f2',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg className="w-4 h-4 text-[#dc2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </div>
    )
  }

  // Hover effect when dragging over empty slot
  if (isOver) {
    return (
      <div ref={setNodeRef} className="timetable-cell" style={{
        background: '#dbeafe',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: '#2563eb' }}>Soltar aqui</span>
      </div>
    )
  }

  // Empty slot
  return (
    <div
      ref={setNodeRef}
      className={`timetable-cell empty ${today ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
      onClick={onSlotClick}
    >
      <svg className="empty-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    </div>
  )
}
