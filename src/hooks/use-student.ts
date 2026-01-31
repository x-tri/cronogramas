import { useQuery } from '@tanstack/react-query'
import { useRepository } from '../data/factory'
import { queryKeys } from '../lib/query-client'
import { createStudentService } from '../services'
import { unwrapOr } from '../services'

export function useStudent(matricula: string) {
  const repository = useRepository()
  const studentService = createStudentService(repository)

  return useQuery({
    queryKey: queryKeys.students.byMatricula(matricula),
    queryFn: async () => {
      const result = await studentService.findByMatricula(matricula)
      return unwrapOr(result, null)
    },
    enabled: !!matricula && matricula.length >= 5,
    staleTime: 10 * 60 * 1000, // 10 minutos - alunos raramente mudam
  })
}

export function useStudentsByTurma(turma: string) {
  const repository = useRepository()
  const studentService = createStudentService(repository)

  return useQuery({
    queryKey: queryKeys.students.byTurma(turma),
    queryFn: async () => {
      const result = await studentService.findByTurma(turma)
      return unwrapOr(result, [])
    },
    enabled: !!turma,
  })
}
