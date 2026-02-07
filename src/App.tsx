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
    <div className="min-h-screen bg-white">
      {/* Header Notion - Flat, minimalista */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#e3e2e0]">
        <div className="notion-page">
          <div className="flex items-center justify-between h-14">
            {/* Logo simples */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-[#37352f] rounded">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-medium text-[#37352f]">
                  XTRI Cronogramas
                </h1>
                <span className="text-[#9ca3af]">/</span>
                <span className="text-sm text-[#6b6b67]">Colégio Marista</span>
              </div>
            </div>

            {/* Ações do Header */}
            {currentStudent && (
              <div className="flex items-center gap-1">
                <WeekSelector />
                <div className="h-4 w-px bg-[#e3e2e0] mx-2" />
                <ShareDropdown />
                <HistoryDropdown />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="py-8">
        <div className="space-y-8">
          
          {/* Título da página - limitado em largura */}
          <div className="max-w-4xl mx-auto px-6 pb-4 border-b border-[#e3e2e0]">
            <h1 className="text-[40px] font-bold text-[#37352f] tracking-tight leading-tight">
              Cronograma de Estudos
            </h1>
            <p className="mt-2 text-[#6b6b67] text-lg">
              Gerencie seu planejamento semanal de estudos integrado aos horários de aula.
            </p>
          </div>

          {/* Busca - limitado em largura */}
          <section className="max-w-4xl mx-auto px-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-[#6b6b67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h2 className="text-sm font-medium text-[#37352f]">Consultar Aluno</h2>
            </div>
            <div className="bg-[#f7f6f3] rounded p-4">
              <StudentSearch />
              <div className="mt-4 pt-4 border-t border-[#e3e2e0]">
                <AlunoAvulsoForm />
              </div>
            </div>
          </section>

          {/* Dados do Aluno e Análise - limitado em largura */}
          {currentStudent && (
            <>
              <div className="max-w-4xl mx-auto px-6">
                <StudentCard student={currentStudent} />
              </div>
              
              {/* Divider com título */}
              <div className="max-w-4xl mx-auto px-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-[#e3e2e0]" />
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#6b6b67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-sm font-medium text-[#6b6b67]">Análise de Desempenho</span>
                </div>
                <div className="h-px flex-1 bg-[#e3e2e0]" />
              </div>

              <section className="max-w-4xl mx-auto px-6">
                <div className="bg-[#f7f6f3] rounded p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#6b6b67]">
                      Faça upload do arquivo de resultados do simulado para análise personalizada.
                    </p>
                    <SimuladoAnalyzer matricula={currentStudent.matricula} />
                  </div>
                </div>
              </section>

              {/* Kanban - LARGURA TOTAL com padding nas laterais */}
              <section className="px-6">
                <div className="max-w-4xl mx-auto flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#6b6b67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h2 className="text-sm font-medium text-[#37352f]">Cronograma Semanal</h2>
                  </div>
                  <span className="text-xs text-[#9ca3af]">
                    Clique em um horário para adicionar bloco de estudo
                  </span>
                </div>
                <KanbanBoard
                  onSlotClick={handleSlotClick}
                  onBlockEdit={handleBlockEdit}
                />
              </section>
            </>
          )}
        </div>
      </main>

      {/* Footer simples */}
      <footer className="border-t border-[#e3e2e0] mt-16">
        <div className="notion-page py-6">
          <div className="flex items-center justify-between text-sm text-[#6b6b67]">
            <span>XTRI EdTech — Colégio Marista de Natal</span>
            <span>v2.0</span>
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
