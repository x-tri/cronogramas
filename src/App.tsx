import { useState } from 'react'
import { StudentSearch } from './components/student/student-search'
import { StudentCard } from './components/student/student-card'
import { SimuladoAnalyzer } from './components/simulado/simulado-analyzer'
import { KanbanBoard } from './components/kanban/kanban-board'
import { BlockEditorModal } from './components/blocks/block-editor-modal'
import { useCronogramaStore } from './stores/cronograma-store'
import type { BlocoCronograma, DiaSemana, Turno } from './types/domain'
import { TURNOS_CONFIG } from './constants/time-slots'

type SlotSelection = {
  dia: DiaSemana
  turno: Turno
  slotIndex: number
}

export function App() {
  const currentStudent = useCronogramaStore((state) => state.currentStudent)
  const [selectedSlot, setSelectedSlot] = useState<SlotSelection | null>(null)
  const [editingBlock, setEditingBlock] = useState<BlocoCronograma | null>(null)

  const handleSlotClick = (dia: DiaSemana, turno: Turno, slotIndex: number) => {
    setSelectedSlot({ dia, turno, slotIndex })
    setEditingBlock(null)
  }

  const handleBlockEdit = (block: BlocoCronograma) => {
    // Find the slot index for this block's time
    const turnoConfig = TURNOS_CONFIG[block.turno]
    const slotIndex = turnoConfig.slots.findIndex(
      (slot) => slot.inicio === block.horarioInicio
    )
    if (slotIndex !== -1) {
      setSelectedSlot({
        dia: block.diaSemana,
        turno: block.turno,
        slotIndex,
      })
      setEditingBlock(block)
    }
  }

  const handleCloseModal = () => {
    setSelectedSlot(null)
    setEditingBlock(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            XTRI Cronogramas
          </h1>
          <p className="text-sm text-gray-500">
            Sistema de cronogramas de estudo personalizados
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <StudentSearch />

        {currentStudent && (
          <>
            <StudentCard student={currentStudent} />
            <SimuladoAnalyzer matricula={currentStudent.matricula} />
            <KanbanBoard
              onSlotClick={handleSlotClick}
              onBlockEdit={handleBlockEdit}
            />
          </>
        )}
      </main>

      {/* Block Editor Modal */}
      {selectedSlot && (
        <BlockEditorModal
          isOpen={true}
          onClose={handleCloseModal}
          dia={selectedSlot.dia}
          turno={selectedSlot.turno}
          slotIndex={selectedSlot.slotIndex}
          editingBlock={editingBlock ?? undefined}
        />
      )}
    </div>
  )
}

export default App

