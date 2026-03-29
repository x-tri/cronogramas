import { useState } from 'react'
import { useRepository } from '../../data/factory'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { ESCOLA_LABELS } from '../../types/domain'

type AlunoAvulsoFormProps = {
  variant?: 'panel' | 'compact'
}

export function AlunoAvulsoForm({ variant = 'compact' }: AlunoAvulsoFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [matricula, setMatricula] = useState('')
  const [turma, setTurma] = useState('Avulso')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const repo = useRepository()
  const setStudent = useCronogramaStore((state) => state.setStudent)
  const setOfficialSchedule = useCronogramaStore((state) => state.setOfficialSchedule)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!nome.trim() || !matricula.trim()) {
      setError('Nome e matrícula são obrigatórios')
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const aluno = await repo.students.createAlunoXTRI({
        matricula: matricula.trim(),
        nome: nome.trim(),
        turma: turma.trim() || 'XTRI',
        email: email.trim() || null,
        fotoFilename: null,
      })

      setStudent(aluno)
      // Aluno avulso não tem horário oficial
      setOfficialSchedule([])
      
      // Fecha o formulário e limpa
      setIsOpen(false)
      setNome('')
      setMatricula('')
      setTurma('Avulso')
      setEmail('')
    } catch (err) {
      setError('Erro ao criar aluno. Tente novamente.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={
          variant === 'panel'
            ? 'flex w-full items-start gap-3 rounded-2xl border border-[#dbe5f3] bg-[#f8fbff] px-4 py-4 text-left text-[#1d4ed8] transition-all hover:-translate-y-0.5 hover:border-[#bfdbfe] hover:bg-white'
            : 'inline-flex items-center gap-2 rounded-2xl border border-[#dbe5f3] bg-[#f8fbff] px-4 py-2.5 text-sm font-medium text-[#1d4ed8] transition-all hover:-translate-y-0.5 hover:border-[#bfdbfe] hover:bg-white'
        }
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
            Cadastro manual
          </span>
          <span className="block truncate text-sm font-semibold text-[#1d4ed8]">
            Cadastrar aluno avulso
          </span>
          {variant === 'panel' && (
            <span className="mt-1 block text-xs text-[#64748b]">
              Use esta opção quando o aluno ainda não estiver disponível pela matrícula.
            </span>
          )}
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-[24px] border border-[#dbe5f3] bg-white p-6 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eff6ff]">
            <svg className="h-4 w-4 text-[#2563eb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
              Aluno avulso
            </p>
            <h3 className="text-sm font-semibold text-gray-900">
              Cadastrar aluno {ESCOLA_LABELS.XTRI}
            </h3>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-[#f8fafc] hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="avulso-nome" className="block text-sm font-medium text-gray-700 mb-1">
              Nome Completo <span className="text-red-500">*</span>
            </label>
            <input
              id="avulso-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João da Silva"
            className="block w-full rounded-2xl border border-[#dbe5f3] px-3.5 py-3 text-sm focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/12"
            required
          />
        </div>

          <div>
            <label htmlFor="avulso-matricula" className="block text-sm font-medium text-gray-700 mb-1">
              Matrícula / ID <span className="text-red-500">*</span>
            </label>
            <input
              id="avulso-matricula"
              type="text"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              placeholder="Ex: AV001"
            className="block w-full rounded-2xl border border-[#dbe5f3] px-3.5 py-3 text-sm focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/12"
            required
          />
        </div>

          <div>
            <label htmlFor="avulso-turma" className="block text-sm font-medium text-gray-700 mb-1">
              Turma / Grupo
            </label>
            <input
              id="avulso-turma"
              type="text"
              value={turma}
              onChange={(e) => setTurma(e.target.value)}
              placeholder="Ex: Avulso, Online, etc"
            className="block w-full rounded-2xl border border-[#dbe5f3] px-3.5 py-3 text-sm focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/12"
          />
        </div>

          <div>
            <label htmlFor="avulso-email" className="block text-sm font-medium text-gray-700 mb-1">
              E-mail
            </label>
            <input
              id="avulso-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex: aluno@email.com"
            className="block w-full rounded-2xl border border-[#dbe5f3] px-3.5 py-3 text-sm focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/12"
          />
        </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Cadastrando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Cadastrar e Selecionar
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-800"
          >
            Cancelar
          </button>
        </div>

        <p className="text-xs text-gray-500">
          <span className="font-medium">Nota:</span> Alunos da {ESCOLA_LABELS.XTRI} não têm horário oficial de aula. 
          O cronograma será criado com todos os horários disponíveis para estudo.
        </p>
      </form>
    </div>
  )
}
