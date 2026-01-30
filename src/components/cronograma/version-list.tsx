import { useCronogramaStore } from '../../stores/cronograma-store'
import type { Cronograma } from '../../types/domain'

type VersionListProps = {
  onSelectVersion: (cronograma: Cronograma) => void
}

export function VersionList({ onSelectVersion }: VersionListProps) {
  const versions = useCronogramaStore((state) => state.cronogramaVersions)
  const currentCronograma = useCronogramaStore((state) => state.cronograma)
  const isLoading = useCronogramaStore((state) => state.isLoadingVersions)

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Carregando versoes...
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Nenhum cronograma salvo para este aluno.
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {versions.map((version) => {
        const isActive = version.id === currentCronograma?.id
        const isArchived = version.status === 'arquivado'

        return (
          <button
            key={version.id}
            onClick={() => onSelectVersion(version)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              isActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-gray-900">
                {formatDateShort(version.semanaInicio)} - {formatDateShort(version.semanaFim)}
              </span>
              <div className="flex items-center gap-2">
                {isArchived && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    Arquivado
                  </span>
                )}
                {isActive && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    Visualizando
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Criado em {formatDate(version.createdAt)}
            </div>
            {version.observacoes && (
              <div className="text-xs text-gray-600 mt-1 truncate">
                {version.observacoes}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
