import { useState } from 'react'
import { StudentSearch } from './components/student/student-search'
import { StudentCard } from './components/student/student-card'
import { SimuladoAnalyzer } from './components/simulado/simulado-analyzer'
import { KanbanBoard } from './components/kanban/kanban-board'
import { BlockEditorModal } from './components/blocks/block-editor-modal'
import { VersionSelectorModal } from './components/cronograma/version-selector-modal'
import { WeekSelector } from './components/week-selector'
import { ShareDropdown } from './components/export/share-dropdown'
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
  const cronogramaVersions = useCronogramaStore((state) => state.cronogramaVersions)
  const [selectedSlot, setSelectedSlot] = useState<SlotSelection | null>(null)
  const [editingBlock, setEditingBlock] = useState<BlocoCronograma | null>(null)
  const [showVersionModal, setShowVersionModal] = useState(false)

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                XTRI Cronogramas
              </h1>
              <p className="text-sm text-gray-500">
                Sistema de cronogramas de estudo personalizados
              </p>
            </div>
            {currentStudent && (
              <div className="flex items-center gap-3">
                <WeekSelector />
                <ShareDropdown />
                <button
                  onClick={() => setShowVersionModal(true)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Historico ({cronogramaVersions.length})
                </button>
              </div>
            )}
          </div>
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

      {/* Version History Modal */}
      <VersionSelectorModal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
      />
    </div>
  )
}

export default App

