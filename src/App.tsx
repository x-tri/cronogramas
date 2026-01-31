import { useState } from 'react'
import { StudentSearch } from './components/student/student-search'
import { AlunoAvulsoForm } from './components/student/aluno-avulso-form'
import { StudentCard } from './components/student/student-card'
import { SimuladoAnalyzer } from './components/simulado/simulado-analyzer'
import { KanbanBoard } from './components/kanban/kanban-board'
import { BlockEditorModal } from './components/blocks/block-editor-modal'
import { HistoryDropdown } from './components/cronograma/history-dropdown'
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
  const [selectedSlot, setSelectedSlot] = useState<SlotSelection | null>(null)
  const [editingBlock, setEditingBlock] = useState<BlocoCronograma | null>(null)


  const handleSlotClick = (dia: DiaSemana, turno: Turno, slotIndex: number) => {
    setSelectedSlot({ dia, turno, slotIndex })
    setEditingBlock(null)
  }

  const handleBlockEdit = (block: BlocoCronograma) => {
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
      {/* Header Institucional */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo e Título */}
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-900 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
                  XTRI Cronogramas
                </h1>
                <p className="text-xs text-gray-500">
                  Sistema de Gestão de Estudos
                </p>
              </div>
            </div>

            {/* Ações do Header */}
            {currentStudent && (
              <div className="flex items-center gap-2">
                <WeekSelector />
                <div className="h-6 w-px bg-gray-200 mx-1" />
                <ShareDropdown />
                <HistoryDropdown />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Busca */}
          <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-blue-900 rounded-full" />
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Consulta de Aluno
              </h2>
            </div>
            <StudentSearch />
            
            <div className="mt-4 pt-4 border-t border-gray-100">
              <AlunoAvulsoForm />
            </div>
          </section>

          {/* Dados do Aluno e Análise */}
          {currentStudent && (
            <>
              <StudentCard student={currentStudent} />
              
              <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 bg-green-600 rounded-full" />
                    <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Análise de Desempenho
                    </h2>
                  </div>
                  <SimuladoAnalyzer matricula={currentStudent.matricula} />
                </div>
              </section>

              {/* Kanban */}
              <section className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 bg-blue-600 rounded-full" />
                    <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Cronograma Semanal
                    </h2>
                  </div>
                </div>
                <div className="p-6">
                  <KanbanBoard
                    onSlotClick={handleSlotClick}
                    onBlockEdit={handleBlockEdit}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* Footer Institucional */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span className="font-medium text-gray-700">XTRI EdTech</span>
              <span className="text-gray-300">|</span>
              <span>Colégio Marista de Natal</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Versão 2.0</span>
              <span className="text-gray-300">|</span>
              <span>© 2026</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modais */}
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
