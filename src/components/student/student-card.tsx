import type { Aluno } from '../../types/domain'
import { ESCOLA_LABELS } from '../../types/domain'

interface StudentCardProps {
  student: Aluno
}

export function StudentCard({ student }: StudentCardProps) {
  const schoolLabel = student.escolaNome?.trim() || ESCOLA_LABELS[student.escola]
  const initials = student.nome
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <section className="bg-white rounded border border-[#e3e2e0] overflow-hidden">
      <div className="px-4 py-4">
        <div className="flex items-start gap-4">
          {/* Avatar Notion */}
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-[#37352f] rounded flex items-center justify-center text-white text-sm font-semibold">
              {initials}
            </div>
          </div>

          {/* Informações do Aluno */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#37352f] leading-tight">
                  {student.nome}
                </h2>
                <div className="mt-2 flex items-center gap-3 text-sm text-[#6b6b67]">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                    <span>{student.matricula}</span>
                  </div>
                  <span className="text-[#e3e2e0]">|</span>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>{schoolLabel}</span>
                  </div>
                  <span className="text-[#e3e2e0]">|</span>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="px-1.5 py-0.5 bg-[#f7f6f3] text-[#37352f] text-xs font-medium rounded border border-[#e3e2e0]">
                      {student.turma}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Divider */}
            <div className="my-3 border-t border-[#f1f1ef]" />

            {/* Metadados adicionais */}
            <div className="flex items-center gap-4 text-xs text-[#9ca3af]">
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Cadastro: {student.createdAt.toLocaleDateString('pt-BR')}</span>
              </div>
              {student.email && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>{student.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
