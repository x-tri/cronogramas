import { useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { getRepository } from '../../data/mock-repository'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { getStudentByMatricula } from '../../services/simulado-analyzer'

export function StudentSearch() {
  const [matricula, setMatricula] = useState('')
  const [error, setError] = useState<string | null>(null)

  const {
    isLoadingStudent,
    setLoadingStudent,
    setStudent,
    setOfficialSchedule,
    setLoadingSchedule,
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
      const repo = getRepository()
      let student = await repo.students.findByMatricula(trimmed)

      // Fallback: check Supabase if not in mock data
      if (!student) {
        const supabaseStudent = await getStudentByMatricula(trimmed)
        if (supabaseStudent) {
          // Convert Supabase student to domain Aluno format
          student = {
            id: supabaseStudent.id,
            matricula: supabaseStudent.matricula,
            nome: supabaseStudent.name,
            turma: supabaseStudent.turma ?? 'A',
            email: null,
            fotoFilename: null,
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
    <div className="flex gap-3 items-end">
      <div className="flex-1 max-w-xs">
        <Input
          label="Matrícula do Aluno"
          placeholder="Ex: 214150129"
          value={matricula}
          onChange={(e) => setMatricula(e.target.value)}
          onKeyDown={handleKeyDown}
          error={error ?? undefined}
          disabled={isLoadingStudent}
        />
      </div>
      <Button onClick={handleSearch} isLoading={isLoadingStudent}>
        Buscar
      </Button>
    </div>
  )
}
