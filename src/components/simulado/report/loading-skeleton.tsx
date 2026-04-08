function Bone({ className = '' }: { readonly className?: string }) {
  return (
    <div className={`bg-[#f1f1ef] rounded animate-pulse ${className}`} />
  )
}

interface ReportLoadingSkeletonProps {
  readonly message?: string
  readonly onClose?: () => void
}

export function ReportLoadingSkeleton({
  message = 'Consultando SISU, INEP e banco de questões para montar o relatório.',
  onClose,
}: ReportLoadingSkeletonProps) {
  return (
    <div className="bg-white rounded-xl border border-[#e3e2e0] overflow-hidden">
      {/* Header skeleton */}
      <div className="border-b border-[#e3e2e0] bg-[#fafaf9] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb]">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1f2937]">
                  Gerando relatório cirúrgico
                </p>
                <p className="mt-1 text-xs text-[#64748b]">
                  {message}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-[#94a3b8]">
              Dados reais do Supabase. Em alguns alunos esse processamento leva de 10 a 20 segundos.
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#94a3b8] transition-colors hover:bg-white hover:text-[#475569]"
              aria-label="Fechar carregamento do relatório"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* Posicao Atual skeleton */}
        <div className="border border-[#e3e2e0] rounded-lg p-4">
          <Bone className="h-3 w-28 mb-4" />
          <div className="flex justify-between mb-3">
            <div>
              <Bone className="h-3 w-32 mb-1" />
              <Bone className="h-6 w-20" />
            </div>
            <div className="text-right">
              <Bone className="h-3 w-24 mb-1 ml-auto" />
              <Bone className="h-6 w-20 ml-auto" />
            </div>
          </div>
          <Bone className="h-3 w-full mb-4" />
          <div className="grid grid-cols-4 gap-3">
            <Bone className="h-14 rounded-lg" />
            <Bone className="h-14 rounded-lg" />
            <Bone className="h-14 rounded-lg" />
            <Bone className="h-14 rounded-lg" />
          </div>
        </div>

        {/* ROI skeleton */}
        <div className="border border-[#e3e2e0] rounded-lg p-4">
          <Bone className="h-3 w-40 mb-4" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bone key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Habilidades skeleton */}
        <div className="border border-[#e3e2e0] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e3e2e0]">
            <Bone className="h-3 w-36" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-[#f1f1ef] last:border-b-0">
              <Bone className="h-3.5 w-full" />
            </div>
          ))}
        </div>

        {/* Erros TRI skeleton */}
        <div className="border border-[#e3e2e0] rounded-lg p-4">
          <Bone className="h-3 w-48 mb-4" />
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Bone key={i} className="h-16 rounded-md" />
            ))}
          </div>
        </div>

        {/* Cenarios skeleton */}
        <div className="border border-[#e3e2e0] rounded-lg p-4">
          <Bone className="h-3 w-36 mb-4" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Bone key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
