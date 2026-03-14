import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRepository } from '../data/factory'
import { queryKeys } from '../lib/query-client'
import { createCronogramaService } from '../services'
import { unwrapOr } from '../services'
import type { BlocoCronograma, Cronograma } from '../types/domain'

export function useCronograma(alunoId: string, weekStart: Date) {
  const repository = useRepository()
  const cronogramaService = createCronogramaService(repository)

  return useQuery({
    queryKey: queryKeys.cronogramas.byWeek(alunoId, weekStart.toISOString()),
    queryFn: async () => {
      const result = await cronogramaService.loadCronograma(alunoId, weekStart)
      const defaultValue = { cronograma: null as Cronograma | null, blocks: [] as BlocoCronograma[] }
      return unwrapOr(result, defaultValue)
    },
    enabled: !!alunoId,
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}

export function useCronogramaVersions(alunoId: string) {
  const repository = useRepository()
  const cronogramaService = createCronogramaService(repository)

  return useQuery({
    queryKey: queryKeys.cronogramas.byAluno(alunoId),
    queryFn: async () => {
      const result = await cronogramaService.getAllVersions(alunoId)
      return unwrapOr(result, [])
    },
    enabled: !!alunoId,
  })
}

// Mutations
export function useCreateBlock() {
  const queryClient = useQueryClient()
  const repository = useRepository()
  const cronogramaService = createCronogramaService(repository)

  return useMutation({
    mutationFn: async (data: Parameters<typeof cronogramaService.addBlock>[0]) => {
      void data.cronogramaId // usado no onSuccess
      const result = await cronogramaService.addBlock(data)
      if (!result.success) {
        throw result.error
      }
      return result.data
    },
    onSuccess: (_, variables) => {
      // Invalida cache de blocos para este cronograma
      queryClient.invalidateQueries({
        queryKey: queryKeys.blocks.byCronograma(variables.cronogramaId),
      })
    },
  })
}

export function useUpdateBlock() {
  const queryClient = useQueryClient()
  const repository = useRepository()
  const cronogramaService = createCronogramaService(repository)

  return useMutation({
    mutationFn: async ({
      blockId,
      updates,
      cronogramaId,
    }: {
      blockId: string
      updates: Partial<BlocoCronograma>
      cronogramaId: string
    }) => {
      void cronogramaId // usado no onSuccess
      const result = await cronogramaService.updateBlock(blockId, updates)
      if (!result.success) {
        throw result.error
      }
      return result.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.blocks.byCronograma(variables.cronogramaId),
      })
    },
  })
}

export function useDeleteBlock() {
  const queryClient = useQueryClient()
  const repository = useRepository()
  const cronogramaService = createCronogramaService(repository)

  return useMutation({
    mutationFn: async ({
      blockId,
      cronogramaId,
    }: {
      blockId: string
      cronogramaId: string
    }) => {
      void cronogramaId // usado no onSuccess
      const result = await cronogramaService.removeBlock(blockId)
      if (!result.success) {
        throw result.error
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.blocks.byCronograma(variables.cronogramaId),
      })
    },
  })
}

export function useMoveBlock() {
  const queryClient = useQueryClient()
  const repository = useRepository()
  const cronogramaService = createCronogramaService(repository)

  return useMutation({
    mutationFn: async (data: {
      blockId: string
      diaSemana: BlocoCronograma['diaSemana']
      turno: BlocoCronograma['turno']
      slotIndex: number
      cronogramaId: string
    }) => {
      const { cronogramaId: _cronogramaId, ...moveData } = data
      void _cronogramaId // usado no onSuccess
      const result = await cronogramaService.moveBlock(moveData)
      if (!result.success) {
        throw result.error
      }
      return result.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.blocks.byCronograma(variables.cronogramaId),
      })
    },
  })
}
