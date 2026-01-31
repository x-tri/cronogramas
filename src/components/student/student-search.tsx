import { useState } from 'react'
import { useRepository } from '../../data/factory'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { getStudentByMatricula } from '../../services/simulado-analyzer'

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
          student = {
            id: supabaseStudent.id,
            matricula: supabaseStudent.matricula,
            nome: supabaseStudent.name,
            turma: supabaseStudent.turma ?? 'A',
            email: null,
            fotoFilename: null,
            escola: 'MARISTA',
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
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
      <div className="flex-1 w-full sm:max-w-md">
        <label htmlFor="matricula" className="block text-sm font-medium text-gray-700 mb-1.5">
          Número de Matrícula
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              block w-full pl-10 pr-4 py-2.5
              text-sm text-gray-900 placeholder-gray-400
              bg-white border rounded-lg
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-blue-500/20
              disabled:bg-gray-50 disabled:text-gray-500
              ${error 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
                : 'border-gray-300 focus:border-blue-500'
              }
            `}
          />
          {error && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
            {error}
          </p>
        )}
      </div>

      <button
        onClick={handleSearch}
        disabled={isLoadingStudent}
        className={`
          inline-flex items-center justify-center gap-2
          px-6 py-2.5
          text-sm font-medium text-white
          bg-blue-900 hover:bg-blue-800
          rounded-lg shadow-sm
          transition-all duration-150
          disabled:opacity-60 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        `}
      >
        {isLoadingStudent ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
