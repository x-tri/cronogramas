import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/button'
import { Select } from '../ui/select'
import {
  getSisuCourseObjective,
  listSisuCidades,
  listSisuCursos,
  listSisuEstados,
  listSisuUniversidades,
  type SisuCourseCatalogItem,
} from '../../services/sisu-goals'

export type GoalSelection = {
  estado: string
  cidade: string
  universidade: string
  courseId: number
  courseLabel: string
}

export type GoalCourseCutoff = {
  notaCorteReferencia: number | null
  ano: number | null
  modalidade: string | null
  origem: 'aprovados_final' | 'notas_corte' | 'indisponivel'
  maiorNota: number | null
  menorNota: number | null
}

type Props = {
  value: GoalSelection | null
  onChange: (value: GoalSelection | null) => void
  onCutoffChange?: (value: GoalCourseCutoff | null) => void
  onGenerate: (courseId: number | null) => void
  isGenerating: boolean
}

export function SisuGoalSelector({
  value,
  onChange,
  onCutoffChange,
  onGenerate,
  isGenerating,
}: Props) {
  const [estados, setEstados] = useState<string[]>([])
  const [cidades, setCidades] = useState<string[]>([])
  const [universidades, setUniversidades] = useState<string[]>([])
  const [cursos, setCursos] = useState<SisuCourseCatalogItem[]>([])
  const [estado, setEstado] = useState(value?.estado ?? '')
  const [cidade, setCidade] = useState(value?.cidade ?? '')
  const [universidade, setUniversidade] = useState(value?.universidade ?? '')
  const [cursoId, setCursoId] = useState(value?.courseId ? String(value.courseId) : '')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingCutoff, setIsLoadingCutoff] = useState(false)
  const [cutoffPreview, setCutoffPreview] = useState<GoalCourseCutoff | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    void (async () => {
      setIsLoading(true)
      setError(null)
      try {
        const list = await listSisuEstados()
        if (!isCancelled) {
          setEstados(list)
        }
      } catch (err) {
        console.error(err)
        if (!isCancelled) {
          setError('Erro ao carregar estados do SISU')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!estado) {
      setCidades([])
      setCidade('')
      return
    }

    let isCancelled = false

    void (async () => {
      setIsLoading(true)
      setError(null)
      try {
        const list = await listSisuCidades(estado)
        if (!isCancelled) {
          setCidades(list)
        }
      } catch (err) {
        console.error(err)
        if (!isCancelled) {
          setError('Erro ao carregar cidades do SISU')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    })()

    setCidade('')
    setUniversidade('')
    setCursoId('')
    setUniversidades([])
    setCursos([])
    onChange(null)
    onCutoffChange?.(null)

    return () => {
      isCancelled = true
    }
  }, [estado, onChange, onCutoffChange])

  useEffect(() => {
    if (!estado || !cidade) {
      setUniversidades([])
      setUniversidade('')
      return
    }

    let isCancelled = false

    void (async () => {
      setIsLoading(true)
      setError(null)
      try {
        const list = await listSisuUniversidades(estado, cidade)
        if (!isCancelled) {
          setUniversidades(list)
        }
      } catch (err) {
        console.error(err)
        if (!isCancelled) {
          setError('Erro ao carregar universidades do SISU')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    })()

    setUniversidade('')
    setCursoId('')
    setCursos([])
    onChange(null)
    onCutoffChange?.(null)

    return () => {
      isCancelled = true
    }
  }, [cidade, estado, onChange, onCutoffChange])

  useEffect(() => {
    if (!estado || !cidade || !universidade) {
      setCursos([])
      setCursoId('')
      return
    }

    let isCancelled = false

    void (async () => {
      setIsLoading(true)
      setError(null)
      try {
        const list = await listSisuCursos(estado, cidade, universidade)
        if (!isCancelled) {
          setCursos(list)
        }
      } catch (err) {
        console.error(err)
        if (!isCancelled) {
          setError('Erro ao carregar cursos do SISU')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    })()

    setCursoId('')
    onChange(null)
    onCutoffChange?.(null)

    return () => {
      isCancelled = true
    }
  }, [cidade, estado, universidade, onChange, onCutoffChange])

  useEffect(() => {
    if (!cursoId) {
      onChange(null)
      setCutoffPreview(null)
      onCutoffChange?.(null)
      return
    }

    const selectedCourse = cursos.find((course) => String(course.id) === cursoId)
    if (!selectedCourse) {
      onChange(null)
      setCutoffPreview(null)
      onCutoffChange?.(null)
      return
    }

    onChange({
      estado,
      cidade,
      universidade,
      courseId: selectedCourse.id,
      courseLabel: [
        selectedCourse.nome,
        selectedCourse.campus,
        selectedCourse.turno,
      ]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(' · '),
    })
  }, [cidade, cursoId, cursos, estado, onChange, onCutoffChange, universidade])

  useEffect(() => {
    if (!cursoId) {
      setCutoffPreview(null)
      setIsLoadingCutoff(false)
      onCutoffChange?.(null)
      return
    }

    let isCancelled = false

    void (async () => {
      setIsLoadingCutoff(true)
      try {
        const objective = await getSisuCourseObjective(Number(cursoId))
        if (isCancelled) return

        const nextCutoff: GoalCourseCutoff = {
          notaCorteReferencia: objective.notaCorte.notaCorteReferencia,
          ano: objective.notaCorte.ano,
          modalidade: objective.notaCorte.modalidadeReferencia,
          origem: objective.notaCorte.origemReferencia,
          maiorNota: objective.notaCorte.maiorNotaConvocadoAmostra,
          menorNota: objective.notaCorte.menorNotaConvocadoAmostra,
        }

        setCutoffPreview(nextCutoff)
        onCutoffChange?.(nextCutoff)
      } catch (err) {
        console.error(err)
        if (!isCancelled) {
          setCutoffPreview(null)
          onCutoffChange?.(null)
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingCutoff(false)
        }
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [cursoId, onCutoffChange])

  const selectedCourse = useMemo(
    () => cursos.find((course) => String(course.id) === cursoId) ?? null,
    [cursoId, cursos],
  )

  return (
    <div className="space-y-3 rounded-xl border border-[#dbe5f3] bg-[#f8fbff] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#64748b]">Objetivo SISU</p>
          <p className="mt-1 text-sm font-semibold text-[#0f172a]">Selecione o curso (opcional) para personalizar pesos e corte</p>
        </div>
        {value ? (
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#2563eb]">
            {value.courseLabel}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Select
          label="Estado"
          value={estado}
          onChange={(event) => setEstado(event.target.value)}
          options={estados.map((item) => ({ value: item, label: item }))}
          placeholder="Selecione o estado"
        />
        <Select
          label="Cidade"
          value={cidade}
          onChange={(event) => setCidade(event.target.value)}
          options={cidades.map((item) => ({ value: item, label: item }))}
          placeholder="Selecione a cidade"
          disabled={!estado}
        />
        <Select
          label="Faculdade"
          value={universidade}
          onChange={(event) => setUniversidade(event.target.value)}
          options={universidades.map((item) => ({ value: item, label: item }))}
          placeholder="Selecione a faculdade"
          disabled={!cidade}
        />
        <Select
          label="Curso"
          value={cursoId}
          onChange={(event) => setCursoId(event.target.value)}
          options={cursos.map((item) => ({
            value: String(item.id),
            // Inclui turno no label para o coord distinguir cursos com mesmo
            // nome+campus mas turnos diferentes (ex: Direito Natal Matutino
            // vs Direito Natal Vespertino).
            label: [item.nome, item.campus, item.turno]
              .filter((part): part is string => Boolean(part && part.trim()))
              .join(' · '),
          }))}
          placeholder="Selecione o curso"
          disabled={!universidade}
        />
      </div>

      {selectedCourse ? (
        <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-3 text-xs text-[#475569]">
          <p className="font-medium text-[#0f172a]">{selectedCourse.nome}</p>
          <p className="mt-1">
            {selectedCourse.universidade}
            {selectedCourse.campus ? ` · ${selectedCourse.campus}` : ''}
            {selectedCourse.turno ? ` · ${selectedCourse.turno}` : ''}
          </p>
          <div className="mt-3 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]">
              Corte do curso
            </p>
            <p className="mt-1 text-sm font-semibold text-[#0f172a]">
              {isLoadingCutoff
                ? 'Carregando...'
                : cutoffPreview?.notaCorteReferencia != null
                  ? cutoffPreview.notaCorteReferencia.toFixed(2)
                  : '-'}
            </p>
            <p className="mt-1 text-[11px] text-[#64748b]">
              {isLoadingCutoff
                ? 'Buscando corte final no SISU...'
                : cutoffPreview?.notaCorteReferencia != null
                  ? [
                      cutoffPreview.origem === 'aprovados_final'
                        ? 'Final Cut Score'
                        : 'Nota de corte',
                      cutoffPreview.ano != null ? `Ano ${cutoffPreview.ano}` : null,
                      cutoffPreview.menorNota != null && cutoffPreview.maiorNota != null
                        ? `Maior/menor: ${cutoffPreview.maiorNota.toFixed(2)} · ${cutoffPreview.menorNota.toFixed(2)}`
                        : cutoffPreview.modalidade,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Sem corte disponível para este curso'}
            </p>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-[#dc2626]">{error}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[#64748b]">
          {isLoading
            ? 'Carregando catálogo do SISU...'
            : 'Sem curso selecionado, o relatório usa análise geral ENEM por TRI + erros reais. Com curso, aplica pesos e corte SISU.'}
        </p>
        <Button
          onClick={() => {
            onGenerate(value?.courseId ?? null)
          }}
          isLoading={isGenerating}
        >
          {value?.courseId ? 'Gerar relatório do curso' : 'Gerar análise geral'}
        </Button>
      </div>
    </div>
  )
}
