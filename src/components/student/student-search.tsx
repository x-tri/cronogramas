import { useState } from 'react'
import { useRepository, useRepositoryMode } from '../../data/factory'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { getStudentByMatricula } from '../../services/simulado-analyzer'
import { isSupabaseConfigured } from '../../config/repository-config'
import type { Escola } from '../../types/domain'

type StudentSearchProps = {
  variant?: 'hero' | 'modal'
}

function resolveEscolaByName(rawName: string | null | undefined): {
  escola: Escola
  escolaNome?: string
} {
  const schoolName = rawName?.trim()
  const marker = (schoolName ?? '').toLowerCase()

  if (marker.includes('xtri')) {
    return { escola: 'XTRI', escolaNome: schoolName || 'Escola XTRI' }
  }

  if (marker.includes('marista')) {
    return { escola: 'MARISTA', escolaNome: schoolName || 'Colégio Marista de Natal' }
  }

  if (schoolName) {
    return { escola: 'MARISTA', escolaNome: schoolName }
  }

  return { escola: 'MARISTA' }
}

export function StudentSearch({ variant = 'modal' }: StudentSearchProps) {
  const [matricula, setMatricula] = useState('')
  const [error, setError] = useState<string | null>(null)

  const repo = useRepository()
  const repositoryMode = useRepositoryMode()

  const {
    isLoadingStudent,
    setLoadingStudent,
    setStudent,
    setOfficialSchedule,
    applySlotsOverrideFromSchedule,
    setLoadingSchedule,
    loadCronograma,
  } = useCronogramaStore()

  const handleSearch = async () => {
    const trimmed = matricula.trim()
    if (!trimmed) {
      setError('Digite uma matrícula')
      return
    }

    setError(null)
    setLoadingStudent(true)

    try {
      let student = await repo.students.findByMatricula(trimmed)

      // Fallback: check Supabase if not in mock data and Supabase is configured
      if (!student && repositoryMode !== 'mock' && isSupabaseConfigured()) {
        const supabaseStudent = await getStudentByMatricula(trimmed)
        if (supabaseStudent) {
          const schoolName = supabaseStudent?.school?.name
          const { escola, escolaNome } = resolveEscolaByName(schoolName)
          student = {
            id: supabaseStudent.matricula,
            matricula: supabaseStudent.matricula,
            nome: supabaseStudent.name,
            turma: supabaseStudent.turma ?? 'A',
            email: null,
            fotoFilename: null,
            escola,
            escolaId: supabaseStudent.school_id ?? null,
            escolaNome,
            createdAt: new Date(),
          }
        }
      }

      if (!student) {
        setError('Aluno não encontrado')
        setStudent(null)
        return
      }

      setStudent(student)

      // Load official schedule for the student's class.
      // Passa escolaId pra suportar escolas com turmas no mesmo nome (ex: 'A',
      // 'Turma 300') e ler do banco school_schedules quando disponivel.
      setLoadingSchedule(true)
      // Diagnostico (incidente 2026-05-04 — coord Marista vendo grade Dom Bosco):
      // imprime escolaId/turma do aluno carregado pra cruzar com retorno do
      // getOfficialSchedule no console. Remover quando a causa raiz for fechada.
      console.info('[student-search] carregando schedule', {
        matricula: student.matricula,
        turma: student.turma,
        escolaId: student.escolaId,
        escolaNome: student.escolaNome ?? null,
      })
      const schedule = await repo.schedules.getOfficialSchedule(
        student.turma,
        student.escolaId ?? null,
      )
      setOfficialSchedule(schedule)
      // Deriva slots da grade da escola (Dom Bosco tem horarios diferentes
      // do default Marista). Se identicos ao default, override fica null.
      applySlotsOverrideFromSchedule(schedule)

      // Load existing cronograma and blocks for this student
      await loadCronograma(student.id)
    } catch (err) {
      setError('Erro ao buscar aluno')
      console.error(err)
    } finally {
      setLoadingStudent(false)
      setLoadingSchedule(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const isHero = variant === 'hero'

  return (
    <div className={isHero ? 'flex flex-col items-start gap-3 sm:flex-row sm:items-end' : 'flex flex-col items-start gap-3 sm:flex-row sm:items-end'}>
      <div className={`w-full ${isHero ? '' : 'flex-1 sm:max-w-sm'}`}>
        <label
          htmlFor="matricula"
          className={`mb-1.5 block ${isHero ? 'text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]' : 'text-sm font-medium text-[#37352f]'}`}
        >
          Matrícula
        </label>
        <div className="relative">
          <div className={`pointer-events-none absolute inset-y-0 left-0 flex items-center ${isHero ? 'pl-4' : 'pl-3'}`}>
            <svg className="h-4 w-4 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            id="matricula"
            type="text"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: 214150129"
            disabled={isLoadingStudent}
            className={`
              block w-full text-[#1d1d1f] placeholder-[#94a3b8]
              border bg-white transition-all duration-150
              focus:outline-none focus:ring-4
              disabled:bg-[#f8fafc] disabled:text-[#9ca3af]
              ${isHero
                ? 'h-14 rounded-2xl border-[#dbe5f3] pl-11 pr-4 text-base hover:border-[#bfdbfe] focus:border-[#2563eb] focus:ring-[#2563eb]/12'
                : 'rounded-xl border-[#e2e8f0] pl-9 pr-3 py-2.5 text-sm hover:border-[#cbd5e1] focus:border-[#2563eb] focus:ring-[#2563eb]/12'
              }
              ${error 
                ? 'border-[#fca5a5] focus:border-[#ef4444] focus:ring-[#ef4444]/15' 
                : ''
              }
            `}
          />
          {error && (
            <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center ${isHero ? 'pr-4' : 'pr-3'}`}>
              <svg className="h-4 w-4 text-[#ef4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-[#dc2626]">{error}</p>
        )}
      </div>

      <button
        onClick={handleSearch}
        disabled={isLoadingStudent}
        className={`
          inline-flex items-center justify-center gap-2
          text-sm font-semibold text-white
          transition-all duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-4 focus:ring-[#2563eb]/18
          ${isHero
            ? 'h-14 w-full rounded-2xl bg-[#111827] px-6 hover:bg-[#0f172a] sm:w-auto'
            : 'rounded-xl bg-[#1f2937] px-4 py-2.5 hover:bg-[#111827]'
          }
        `}
      >
        {isLoadingStudent ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Buscando...</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Buscar</span>
          </>
        )}
      </button>
    </div>
  )
}
