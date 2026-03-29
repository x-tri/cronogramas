import { useState } from 'react'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { ResetConfirmModal } from './reset-confirm-modal'

export function ResetButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  
  const currentStudent = useCronogramaStore((state) => state.currentStudent)
  const blocks = useCronogramaStore((state) => state.blocks)
  const clearAllBlocks = useCronogramaStore((state) => state.clearAllBlocks)

  // Don't show if no student or no blocks
  if (!currentStudent || blocks.length === 0) {
    return null
  }

  const handleReset = async () => {
    await clearAllBlocks()
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  return (
    <>
      <div className="group relative min-w-0">
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex h-12 w-full items-center gap-2.5 rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 text-left text-sm font-semibold text-[#be123c] transition-colors hover:bg-[#ffe4e6]"
          title="Apagar os blocos atuais da semana e recomeçar o planejamento"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white/80">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </span>
          <span className="min-w-0 truncate">Refazer semana</span>
        </button>
        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-xl bg-[#0f172a] px-3 py-2 text-xs text-white opacity-0 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.8)] transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          Remove os blocos atuais para montar a semana novamente do zero.
        </div>
      </div>

      <ResetConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleReset}
        studentName={currentStudent.nome}
        blockCount={blocks.length}
      />

      {/* Toast de sucesso */}
      {showSuccess && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div className="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-medium">Cronograma refeito!</p>
              <p className="text-sm text-green-100">Todos os blocos foram removidos.</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
