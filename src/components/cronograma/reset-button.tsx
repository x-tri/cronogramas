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
    const previousCount = blocks.length
    await clearAllBlocks()
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
    console.log(`[ResetButton] Cronograma resetado: ${previousCount} blocos removidos`)
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        title="Refazer cronograma - apaga todos os blocos atuais"
      >
        <svg
          className="w-4 h-4"
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
        Refazer
      </button>

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
