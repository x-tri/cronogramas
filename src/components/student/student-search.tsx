import { useState } from 'react'
import { useRepository } from '../../data/factory'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { getStudentByMatricula } from '../../services/simulado-analyzer'
import type { Escola } from '../../types/domain'

type SupabaseStudentLike = {
  id: string
  matricula: string
  name: string
  turma?: string | null
  school_id?: string | null
  school_name?: string | null
  escola?: string | null
}

function resolveEscola(student: SupabaseStudentLike): { escola: Escola; escolaNome?: string } {
  const rawName = (student.school_name ?? student.escola ?? '').trim()
  const rawId = (student.school_id ?? '').trim()
  const marker = `${rawId} ${rawName}`.toLowerCase()

  if (marker.includes('xtri')) {
    return { escola: 'XTRI', escolaNome: rawName || 'Escola XTRI' }
  }

  if (marker.includes('marista')) {
    return { escola: 'MARISTA', escolaNome: rawName || 'Colégio Marista de Natal' }
  }

  if (rawName) {
    return { escola: 'MARISTA', escolaNome: rawName }
  }

  return { escola: 'MARISTA' }
}

export function StudentSearch() {
  const [matricula, setMatricula] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const repo = useRepository()

  const {
    isLoadingStudent,
    setLoadingStudent,
    setStudent,
    setOfficialSchedule,
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

      // Fallback: check Supabase if not in mock data
      if (!student) {
        const supabaseStudent = await getStudentByMatricula(trimmed)
        if (supabaseStudent) {
          const schoolName = supabaseStudent?.school?.name
          student = {
            id: supabaseStudent.id,
            matricula: supabaseStudent.matricula,
            nome: supabaseStudent.name,
            turma: supabaseStudent.turma ?? 'A',
            email: null,
            fotoFilename: null,
            escola: schoolName as Escola,
            escolaNome: schoolName,
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

      // Load official schedule for the student's class
      setLoadingSchedule(true)
      const schedule = await repo.schedules.getOfficialSchedule(student.turma)
      setOfficialSchedule(schedule)

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

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
      <div className="flex-1 w-full sm:max-w-sm">
        <label htmlFor="matricula" className="block text-sm font-medium text-[#37352f] mb-1.5">
          Matrícula
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
              block w-full pl-9 pr-3 py-1.5
              text-sm text-[#37352f] placeholder-[#9ca3af]
              bg-white border rounded
              transition-colors duration-100
              focus:outline-none focus:border-[#2383e2] focus:ring-1 focus:ring-[#2383e2]/20
              hover:border-[#d1d1cd]
              disabled:bg-[#f7f6f3] disabled:text-[#9ca3af]
              ${error 
                ? 'border-[#fca5a5] focus:border-[#ef4444] focus:ring-[#ef4444]/20' 
                : 'border-[#e3e2e0]'
              }
            `}
          />
          {error && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
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
          inline-flex items-center justify-center gap-1.5
          px-3 py-1.5
          text-sm font-medium text-white
          bg-[#37352f] hover:bg-[#2d2d2d] active:bg-[#1a1a1a]
          rounded
          transition-colors duration-100
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-[#2383e2]/30
        `}
      >
        {isLoadingStudent ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Buscando...</span>
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Buscar</span>
          </>
        )}
      </button>
    </div>
  )
}
