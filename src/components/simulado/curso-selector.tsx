import { useCallback, useEffect, useState } from 'react'
import type { CursoEscolhido } from '../../types/report'
import { getInepSupabaseClient, isInepSupabaseConfigured } from '../../lib/inep-supabase'

interface CursoSelectorProps {
  readonly onSelect: (curso: CursoEscolhido) => void
  readonly isLoading?: boolean
  readonly initialValues?: Partial<CursoEscolhido>
}

type CursoOption = {
  readonly id: number
  readonly nome: string
  readonly universidade: string
  readonly estado: string
  readonly campus: string | null
  readonly turno: string | null
}

const UF_LIST = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const

const MODALIDADES = [
  'Ampla concorrencia',
  'Cotas - Escola publica',
  'Cotas - Escola publica + Renda',
  'Cotas - Escola publica + PPI',
  'Cotas - Escola publica + Renda + PPI',
  'Cotas - PcD',
] as const

export function CursoSelector({
  onSelect,
  isLoading = false,
  initialValues,
}: CursoSelectorProps) {
  const [estado, setEstado] = useState(initialValues?.estado ?? '')
  const [modalidade, setModalidade] = useState(
    initialValues?.modalidade ?? 'Ampla concorrencia',
  )

  // Dados do Supabase SISU
  const [universidades, setUniversidades] = useState<string[]>([])
  const [universidade, setUniversidade] = useState(initialValues?.universidade ?? '')
  const [cursos, setCursos] = useState<CursoOption[]>([])
  const [cursoSelecionado, setCursoSelecionado] = useState<CursoOption | null>(null)
  const [isLoadingUniversidades, setIsLoadingUniversidades] = useState(false)
  const [isLoadingCursos, setIsLoadingCursos] = useState(false)
  const [supabaseOk, setSupabaseOk] = useState(false)

  // Verificar se INEP Supabase está configurado
  useEffect(() => {
    setSupabaseOk(isInepSupabaseConfigured())
  }, [])

  // Carregar universidades quando o estado muda
  useEffect(() => {
    if (!estado || !supabaseOk) {
      setUniversidades([])
      setUniversidade('')
      setCursos([])
      setCursoSelecionado(null)
      return
    }

    let cancelled = false
    setIsLoadingUniversidades(true)

    const fetchUniversidades = async () => {
      try {
        const client = getInepSupabaseClient()
        const { data } = await client
          .from('sisu_cursos')
          .select('universidade')
          .eq('estado', estado)
          .order('universidade')

        if (cancelled) return

        const unicas = [...new Set((data ?? []).map((d: { universidade: string }) => d.universidade))].sort()
        setUniversidades(unicas)
        setUniversidade('')
        setCursos([])
        setCursoSelecionado(null)
      } catch {
        if (!cancelled) setUniversidades([])
      } finally {
        if (!cancelled) setIsLoadingUniversidades(false)
      }
    }

    void fetchUniversidades()
    return () => { cancelled = true }
  }, [estado, supabaseOk])

  // Carregar cursos quando universidade muda
  useEffect(() => {
    if (!universidade || !estado || !supabaseOk) {
      setCursos([])
      setCursoSelecionado(null)
      return
    }

    let cancelled = false
    setIsLoadingCursos(true)

    const fetchCursos = async () => {
      try {
        const client = getInepSupabaseClient()
        const { data } = await client
          .from('sisu_cursos')
          .select('id, nome, universidade, estado, campus, turno')
          .eq('estado', estado)
          .eq('universidade', universidade)
          .order('nome')

        if (cancelled) return

        setCursos((data ?? []) as CursoOption[])
        setCursoSelecionado(null)
      } catch {
        if (!cancelled) setCursos([])
      } finally {
        if (!cancelled) setIsLoadingCursos(false)
      }
    }

    void fetchCursos()
    return () => { cancelled = true }
  }, [universidade, estado, supabaseOk])

  const isValid = cursoSelecionado != null && estado.length > 0

  const handleSubmit = useCallback(() => {
    if (!isValid || !cursoSelecionado) return

    const cursoEscolhido: CursoEscolhido = {
      nome: cursoSelecionado.nome,
      universidade: cursoSelecionado.universidade,
      estado,
      modalidade,
    }

    onSelect(cursoEscolhido)
  }, [cursoSelecionado, estado, modalidade, isValid, onSelect])

  // Fallback: se o Supabase INEP não estiver configurado, não mostra o seletor
  if (!supabaseOk) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-[11px] text-amber-800">
          ⚠️ Banco INEP/SISU não configurado. Adicione{' '}
          <code className="rounded bg-amber-100 px-1 text-[10px]">VITE_INEP_SUPABASE_URL</code> e{' '}
          <code className="rounded bg-amber-100 px-1 text-[10px]">VITE_INEP_SUPABASE_ANON_KEY</code>{' '}
          ao <code className="rounded bg-amber-100 px-1 text-[10px]">.env.local</code> para habilitar o Relatório Cirúrgico.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#f0f7ff]">
          <svg className="h-3.5 w-3.5 text-[#0071e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <p className="text-[12px] font-semibold text-[#1d1d1f]">
          Selecione o curso desejado
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Estado */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#6b7280]">
            Estado
          </label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full rounded-lg border border-[#e3e2e0] bg-white px-3 py-2 text-[12px] text-[#1d1d1f] outline-none transition-colors focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/20"
          >
            <option value="">Selecione o estado</option>
            {UF_LIST.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>

        {/* Universidade - dropdown do Supabase */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#6b7280]">
            Universidade
            {isLoadingUniversidades && (
              <span className="ml-1 text-[10px] text-[#9ca3af]">carregando...</span>
            )}
          </label>
          <select
            value={universidade}
            onChange={(e) => setUniversidade(e.target.value)}
            disabled={!estado || isLoadingUniversidades}
            className="w-full rounded-lg border border-[#e3e2e0] bg-white px-3 py-2 text-[12px] text-[#1d1d1f] outline-none transition-colors focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/20 disabled:bg-[#f7f6f3] disabled:text-[#9ca3af]"
          >
            <option value="">
              {!estado ? 'Selecione o estado primeiro' : 'Selecione a universidade'}
            </option>
            {universidades.map((uni) => (
              <option key={uni} value={uni}>
                {uni}
              </option>
            ))}
          </select>
        </div>

        {/* Curso - dropdown do Supabase */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#6b7280]">
            Curso
            {isLoadingCursos && (
              <span className="ml-1 text-[10px] text-[#9ca3af]">carregando...</span>
            )}
          </label>
          <select
            value={cursoSelecionado?.id.toString() ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value)
              const found = cursos.find((c) => c.id === id) ?? null
              setCursoSelecionado(found)
            }}
            disabled={!universidade || isLoadingCursos}
            className="w-full rounded-lg border border-[#e3e2e0] bg-white px-3 py-2 text-[12px] text-[#1d1d1f] outline-none transition-colors focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/20 disabled:bg-[#f7f6f3] disabled:text-[#9ca3af]"
          >
            <option value="">
              {!universidade ? 'Selecione a universidade primeiro' : 'Selecione o curso'}
            </option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id.toString()}>
                {c.nome}{c.turno ? ` (${c.turno})` : ''}{c.campus ? ` — ${c.campus}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Modalidade */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#6b7280]">
            Modalidade
          </label>
          <select
            value={modalidade}
            onChange={(e) => setModalidade(e.target.value)}
            className="w-full rounded-lg border border-[#e3e2e0] bg-white px-3 py-2 text-[12px] text-[#1d1d1f] outline-none transition-colors focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/20"
          >
            {MODALIDADES.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!isValid || isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0071e3] px-4 py-2.5 text-[12px] font-semibold text-white transition-all hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Gerando relatório...
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Gerar Relatório Cirúrgico
          </>
        )}
      </button>
    </div>
  )
}
