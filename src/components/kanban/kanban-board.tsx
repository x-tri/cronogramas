import { useCronogramaStore } from '../../stores/cronograma-store'
import { DIAS_SEMANA, type BlocoCronograma, type DiaSemana, type Turno } from '../../types/domain'
import { KanbanColumn } from './kanban-column'

type KanbanBoardProps = {
  onSlotClick?: (dia: DiaSemana, turno: Turno, slotIndex: number) => void
  onBlockEdit?: (block: BlocoCronograma) => void
}

export function KanbanBoard({ onSlotClick, onBlockEdit }: KanbanBoardProps) {
  const officialSchedule = useCronogramaStore((state) => state.officialSchedule)
  const isLoadingSchedule = useCronogramaStore(
    (state) => state.isLoadingSchedule
  )
  const removeBlock = useCronogramaStore((state) => state.removeBlock)
  const updateBlock = useCronogramaStore((state) => state.updateBlock)

  const handleBlockDelete = (blockId: string) => {
    // Confirmation is handled in BlockCard
    removeBlock(blockId)
  }

  const handleBlockChangePriority = (blockId: string, newPriority: 0 | 1 | 2) => {
    updateBlock(blockId, { prioridade: newPriority })
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
          />
        ))}
      </div>
    </div>
  )
}
