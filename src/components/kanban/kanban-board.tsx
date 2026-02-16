import { DndContext, DragOverlay, pointerWithin, useSensor, useSensors, PointerSensor, defaultDropAnimationSideEffects } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent, DragOverEvent, DropAnimation } from '@dnd-kit/core'
import { useState, useCallback } from 'react'
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
  const swapBlocks = useCronogramaStore((state) => state.swapBlocks)


  const [activeBlock, setActiveBlock] = useState<BlocoCronograma | null>(null)
  const [dropTarget, setDropTarget] = useState<{ dia: DiaSemana; turno: Turno; slotIndex: number } | null>(null)
  const [dropMode, setDropMode] = useState<'swap' | 'move' | 'blocked'>('blocked')

  // Configuração dos sensores para melhorar a detecção de drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Mínimo de 8px de movimento para iniciar o drag
      },
    })
  )

  const handleBlockDelete = async (blockId: string) => {
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const blockId = event.active.id as string
    const block = blocks.find((b) => b.id === blockId)
    if (block) {
      setActiveBlock(block)
    }
  }, [blocks])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event
    if (!over) {
      setDropTarget(null)
      return
    }

    const dropData = over.data.current as {
      dia: DiaSemana
      turno: Turno
      slotIndex: number
    } | undefined

    if (!dropData) {
      setDropTarget(null)
      return
    }

    const { dia, turno, slotIndex } = dropData
    const slot = getSlotByIndex(turno, slotIndex)
    if (!slot) {
      setDropTarget(null)
      return
    }

    // Check if slot is occupied by official class
    const isOccupiedByOfficial = officialSchedule.some(
      (h) => h.diaSemana === dia && h.turno === turno && h.horarioInicio === slot.inicio
    )

    if (isOccupiedByOfficial) {
      setDropTarget({ dia, turno, slotIndex })
      setDropMode('blocked')
      return
    }

    // Check if slot is occupied by another block
    const occupyingBlock = blocks.find(
      (b) => b.diaSemana === dia && b.turno === turno && b.horarioInicio === slot.inicio
    )

    setDropTarget({ dia, turno, slotIndex })
    
    if (occupyingBlock && occupyingBlock.id !== activeBlock?.id) {
      // Slot is occupied by another block - show swap mode
      setDropMode('swap')
    } else {
      // Slot is empty - allow move
      setDropMode('move')
    }
  }, [blocks, officialSchedule, activeBlock])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveBlock(null)
    setDropTarget(null)

    const { active, over } = event
    if (!over) return

    const blockId = active.id as string
    const dropData = over.data.current as {
      dia: DiaSemana
      turno: Turno
      slotIndex: number
    } | undefined

    if (!dropData) return

    const { dia, turno, slotIndex } = dropData
    const slot = getSlotByIndex(turno, slotIndex)
    if (!slot) return

    // Check if slot is occupied by official class
    const isOccupiedByOfficial = officialSchedule.some(
      (h) => h.diaSemana === dia && h.turno === turno && h.horarioInicio === slot.inicio
    )
    if (isOccupiedByOfficial) return

    // Find if there's a block in the target slot
    const targetBlock = blocks.find(
      (b) => b.diaSemana === dia && b.turno === turno && b.horarioInicio === slot.inicio && b.id !== blockId
    )

    try {
      if (targetBlock) {
        // Swap the blocks
        await swapBlocks(blockId, targetBlock.id)
      } else {
        // Simple move to empty slot
        await moveBlock(blockId, dia, turno, slotIndex)
      }
    } catch (err) {
      console.error('Failed to move/swap block:', err)
    }
  }, [blocks, officialSchedule, moveBlock, swapBlocks])

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  }

  if (isLoadingSchedule) {
    return (
      <div className="bg-[#f7f6f3] rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-[#e3e2e0] rounded w-1/4 mx-auto" />
          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-64 bg-[#e3e2e0] rounded" />
            ))}
          </div>
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
      <div className="bg-[#f7f6f3] rounded-lg p-5 w-full">
        {/* Header do Kanban */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-5 text-sm text-[#6b6b67]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#9ca3af] rounded-sm" />
              <span>Aula Oficial</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#37352f] rounded-sm" />
              <span>Estudo</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 border-2 border-[#37352f] rounded-sm" />
              <span>Revisão</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#9ca3af]">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span>Solte sobre um bloco para trocar</span>
            </span>
          </div>
        </div>

        {/* Grid do Kanban - ocupa 100% da largura */}
        <div className="grid grid-cols-7 gap-4 w-full">
          {DIAS_SEMANA.map((dia) => (
            <KanbanColumn
              key={dia}
              dia={dia}
              officialSchedule={officialSchedule}
              dropTarget={dropTarget}
              dropMode={dropMode}
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

      <DragOverlay dropAnimation={dropAnimation}>
        {activeBlock && (
          <div className="w-52 opacity-90 rotate-1 shadow-2xl">
            <BlockCard block={activeBlock} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
