import { useState, useRef, useEffect } from 'react'
import { useCronogramaStore } from '../../stores/cronograma-store'
import type { Cronograma } from '../../types/domain'

export function HistoryDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const versions = useCronogramaStore((state) => state.cronogramaVersions)
  const currentCronograma = useCronogramaStore((state) => state.cronograma)
  const isLoading = useCronogramaStore((state) => state.isLoadingVersions)
  const selectCronogramaVersion = useCronogramaStore((state) => state.selectCronogramaVersion)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectVersion = (version: Cronograma) => {
    selectCronogramaVersion(version.id)
    setIsOpen(false)
  }

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  // Encontrar o cronograma atual na lista
  const currentVersion = versions.find(v => v.id === currentCronograma?.id)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors border
          ${isOpen 
            ? 'bg-blue-50 text-blue-700 border-blue-300' 
            : 'text-gray-600 bg-gray-50 hover:bg-gray-100 border-gray-200'
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="hidden sm:inline">
          {currentVersion 
            ? `${formatDateShort(currentVersion.semanaInicio)} - ${formatDateShort(currentVersion.semanaFim)}`
            : 'Histórico'
          }
        </span>
        <span className="sm:hidden">Histórico</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Cronogramas Salvos
              </h3>
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                {versions.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Selecione um cronograma para visualizar
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto py-2">
            {isLoading ? (
              <div className="px-4 py-8 text-center">
                <svg className="animate-spin h-5 w-5 text-blue-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm text-gray-500">Carregando...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">Nenhum cronograma salvo</p>
                <p className="text-xs text-gray-400 mt-1">
                  Crie blocos para salvar automaticamente
                </p>
              </div>
            ) : (
              <div className="space-y-1 px-2">
                {versions.map((version) => {
                  const isActive = version.id === currentCronograma?.id
                  const isArchived = version.status === 'arquivado'

                  return (
                    <button
                      key={version.id}
                      onClick={() => handleSelectVersion(version)}
                      className={`
                        w-full text-left p-3 rounded-lg border transition-all
                        ${isActive
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900">
                          {formatDateShort(version.semanaInicio)} - {formatDateShort(version.semanaFim)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isArchived && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">
                              Arquivado
                            </span>
                          )}
                          {isActive && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full" title="Atual" />
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        Criado em {formatDate(version.createdAt)}
                      </div>
                      {version.observacoes && (
                        <div className="text-[11px] text-gray-600 mt-1 line-clamp-1">
                          {version.observacoes}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {versions.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/30 rounded-b-lg">
              <p className="text-[10px] text-gray-400 text-center">
                Clique em um cronograma para carregá-lo
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
