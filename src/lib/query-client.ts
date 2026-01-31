import { QueryClient, QueryCache } from '@tanstack/react-query'
import { AppError } from '../services/errors'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error(`[Query Error] ${query.queryKey}:`, error)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (antes cacheTime)
      retry: (failureCount, error) => {
        // Não retry em erros de negócio
        if (error instanceof AppError) {
          return false
        }
        // Retry até 3 vezes em erros de rede
        return failureCount < 3
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})

// Query keys tipados para evitar erros
export const queryKeys = {
  students: {
    all: ['students'] as const,
    byMatricula: (matricula: string) => ['students', matricula] as const,
    byTurma: (turma: string) => ['students', 'turma', turma] as const,
  },
  schedules: {
    all: ['schedules'] as const,
    byTurma: (turma: string) => ['schedules', turma] as const,
  },
  cronogramas: {
    all: ['cronogramas'] as const,
    byAluno: (alunoId: string) => ['cronogramas', alunoId] as const,
    byWeek: (alunoId: string, weekStart: string) =>
      ['cronogramas', alunoId, weekStart] as const,
  },
  blocks: {
    all: ['blocks'] as const,
    byCronograma: (cronogramaId: string) =>
      ['blocks', cronogramaId] as const,
  },
  subjects: {
    all: ['subjects'] as const,
    byCode: (code: string) => ['subjects', code] as const,
  },
} as const

// Helper para invalidar queries relacionadas
export function invalidateRelatedQueries(
  alunoId?: string,
  cronogramaId?: string
) {
  const promises: Promise<void>[] = []

  if (alunoId) {
    promises.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.cronogramas.byAluno(alunoId),
      })
    )
  }

  if (cronogramaId) {
    promises.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.blocks.byCronograma(cronogramaId),
      })
    )
  }

  return Promise.all(promises)
}
