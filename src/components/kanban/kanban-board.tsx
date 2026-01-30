import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useState } from 'react'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { DIAS_SEMANA, type BlocoCronograma, type DiaSemana, type Turno } from '../../types/domain'
import { getSlotByIndex } from '../../constants/time-slots'
import { KanbanColumn } from './kanban-column'
import { BlockCard } from '../blocks/block-card'

type KanbanBoardProps = {
  onSlotClick?: (dia: DiaSemana, turno: Turno, slotIndex: number) => void
  onBlockEdit?: (block: BlocoCronograma) => void
}

export function KanbanBoard({ onSlotClick, onBlockEdit }: KanbanBoardProps) {
  const officialSchedule = useCronogramaStore((state) => state.officialSchedule)
  const isLoadingSchedule = useCronogramaStore(
    (state) => state.isLoadingSchedule
  )
  const blocks = useCronogramaStore((state) => state.blocks)
  const removeBlock = useCronogramaStore((state) => state.removeBlock)
  const updateBlock = useCronogramaStore((state) => state.updateBlock)
  const moveBlock = useCronogramaStore((state) => state.moveBlock)

  const [activeBlock, setActiveBlock] = useState<BlocoCronograma | null>(null)

  const handleBlockDelete = async (blockId: string) => {
    // Confirmation is handled in BlockCard
    try {
      await removeBlock(blockId)
    } catch (err) {
      console.error('Failed to delete block:', err)
    }
  }

  const handleBlockChangePriority = async (blockId: string, newPriority: 0 | 1 | 2) => {
    try {
      await updateBlock(blockId, { prioridade: newPriority })
    } catch (err) {
      console.error('Failed to update priority:', err)
    }
  }

  const handleBlockToggleComplete = async (blockId: string) => {
    const block = blocks.find((b) => b.id === blockId)
    if (!block) return
    try {
      await updateBlock(blockId, { concluido: !block.concluido })
    } catch (err) {
      console.error('Failed to toggle complete:', err)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const blockId = event.active.id as string
    const block = blocks.find((b) => b.id === blockId)
    if (block) {
      setActiveBlock(block)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveBlock(null)

    const { active, over } = event
    if (!over) return

    const blockId = active.id as string
    const dropData = over.data.current as {
      dia: DiaSemana
      turno: Turno
      slotIndex: number
    } | undefined

    if (!dropData) return

    // Check if slot is already occupied by official schedule
    const { dia, turno, slotIndex } = dropData
    const slot = getSlotByIndex(turno, slotIndex)
    if (!slot) return

    const isOccupiedByOfficial = officialSchedule.some(
      (h) => h.diaSemana === dia && h.turno === turno && h.horarioInicio === slot.inicio
    )
    if (isOccupiedByOfficial) return

    // Check if slot is already occupied by another block
    const isOccupiedByBlock = blocks.some(
      (b) => b.id !== blockId && b.diaSemana === dia && b.turno === turno && b.horarioInicio === slot.inicio
    )
    if (isOccupiedByBlock) return

    try {
      await moveBlock(blockId, dia, turno, slotIndex)
    } catch (err) {
      console.error('Failed to move block:', err)
    }
  }

  if (isLoadingSchedule) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto" />
          <div className="grid grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-x-auto">
        <div className="grid grid-cols-7 gap-3 min-w-[900px]">
          {DIAS_SEMANA.map((dia) => (
            <KanbanColumn
              key={dia}
              dia={dia}
              officialSchedule={officialSchedule}
              onSlotClick={(turno, slotIndex) =>
                onSlotClick?.(dia, turno, slotIndex)
              }
              onBlockEdit={onBlockEdit}
              onBlockDelete={handleBlockDelete}
              onBlockChangePriority={handleBlockChangePriority}
              onBlockToggleComplete={handleBlockToggleComplete}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeBlock && (
          <div className="w-32 opacity-80">
            <BlockCard block={activeBlock} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
