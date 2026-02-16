import { useState } from 'react'

interface ResetConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  studentName: string
  blockCount: number
}

export function ResetConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  studentName,
  blockCount,
}: ResetConfirmModalProps) {
  const [isResetting, setIsResetting] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsResetting(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Error resetting cronograma:', error)
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isResetting ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header with warning icon */}
        <div className="bg-red-50 px-6 py-4 border-b border-red-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full">
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-900">
                Refazer Cronograma
              </h3>
              <p className="text-sm text-red-700">
                Esta ação não pode ser desfeita
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-[#37352f] mb-4">
            Você tem certeza que deseja <strong>refazer</strong> o cronograma de{' '}
            <span className="font-semibold text-[#2eaadc]">{studentName}</span>?
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">O que será apagado:</p>
                <ul className="list-disc list-inside space-y-1 text-amber-700">
                  <li>
                    <strong>{blockCount}</strong> bloco{blockCount !== 1 ? 's' : ''} de estudo
                  </li>
                  <li>Todas as disciplinas alocadas</li>
                  <li>Distribuição atual das matérias</li>
                </ul>
              </div>
            </div>
          </div>

          <p className="text-sm text-[#6b6b67]">
            Você poderá criar um novo cronograma do zero após confirmar.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isResetting}
            className="px-4 py-2 text-sm font-medium text-[#6b6b67] hover:text-[#37352f] hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isResetting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isResetting ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Apagando...
              </>
            ) : (
              <>
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Sim, refazer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
