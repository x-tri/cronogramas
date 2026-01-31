import type { DataRepository } from '../data/repository'
import type { BlocoCronograma, Cronograma, DiaSemana, Turno } from '../types/domain'
import { type Result, tryCatch, ok, err } from './result'
import { AppError, mapError } from './errors'
import { getSlotByIndex } from '../constants/time-slots'

export interface CreateBlockData {
  cronogramaId: string
  diaSemana: DiaSemana
  turno: Turno
  slotIndex: number
  tipo: BlocoCronograma['tipo']
  titulo: string
  descricao?: string | null
  disciplinaCodigo?: string | null
  prioridade?: BlocoCronograma['prioridade']
}

export interface MoveBlockData {
  blockId: string
  diaSemana: DiaSemana
  turno: Turno
  slotIndex: number
}

export interface CronogramaService {
  // Cronograma
  getOrCreateForWeek(
    alunoId: string,
    weekStart: Date
  ): Promise<Result<Cronograma, AppError>>
  
  loadCronograma(
    alunoId: string,
    weekStart: Date
  ): Promise<Result<{ cronograma: Cronograma; blocks: BlocoCronograma[] }, AppError>>
  
  getAllVersions(alunoId: string): Promise<Result<Cronograma[], AppError>>
  
  // Blocks
  addBlock(data: CreateBlockData): Promise<Result<BlocoCronograma, AppError>>
  updateBlock(
    blockId: string,
    updates: Partial<BlocoCronograma>
  ): Promise<Result<BlocoCronograma, AppError>>
  removeBlock(blockId: string): Promise<Result<void, AppError>>
  moveBlock(data: MoveBlockData): Promise<Result<BlocoCronograma, AppError>>
  
  // Validation
  validateSlot(
    diaSemana: DiaSemana,
    turno: Turno,
    slotIndex: number
  ): Result<{ inicio: string; fim: string }, AppError>
  
  isSlotAvailable(
    cronogramaId: string,
    diaSemana: DiaSemana,
    turno: Turno,
    slotIndex: number,
    excludeBlockId?: string
  ): Promise<Result<boolean, AppError>>
}

export function createCronogramaService(
  repository: DataRepository
): CronogramaService {
  return {
    async getOrCreateForWeek(
      alunoId: string,
      weekStart: Date
    ): Promise<Result<Cronograma, AppError>> {
      // Tenta buscar existente
      const existing = await tryCatch(
        () => repository.cronogramas.getCronograma(alunoId, weekStart),
        mapError
      )

      if (!existing.success) {
        return existing
      }

      if (existing.data) {
        return ok(existing.data)
      }

      // Calcula fim da semana
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)

      // Cria novo
      return await tryCatch(
        () =>
          repository.cronogramas.saveCronograma({
            alunoId,
            semanaInicio: weekStart,
            semanaFim: weekEnd,
            observacoes: null,
            status: 'ativo',
          }),
        mapError
      )
    },

    async loadCronograma(
      alunoId: string,
      weekStart: Date
    ): Promise<Result<{ cronograma: Cronograma; blocks: BlocoCronograma[] }, AppError>> {
      const cronogramaResult = await this.getOrCreateForWeek(alunoId, weekStart)

      if (!cronogramaResult.success) {
        return err(cronogramaResult.error)
      }

      const blocksResult = await tryCatch(
        () => repository.blocos.getBlocos(cronogramaResult.data.id),
        mapError
      )

      if (!blocksResult.success) {
        return blocksResult
      }

      return ok({
        cronograma: cronogramaResult.data,
        blocks: blocksResult.data,
      })
    },

    async getAllVersions(alunoId: string): Promise<Result<Cronograma[], AppError>> {
      return await tryCatch(
        () => repository.cronogramas.getAllCronogramas(alunoId),
        mapError
      )
    },

    async addBlock(data: CreateBlockData): Promise<Result<BlocoCronograma, AppError>> {
      // Valida slot
      const slotValidation = this.validateSlot(
        data.diaSemana,
        data.turno,
        data.slotIndex
      )
      if (!slotValidation.success) {
        return err(slotValidation.error)
      }

      const { inicio, fim } = slotValidation.data

      // Cria bloco
      return await tryCatch(
        () =>
          repository.blocos.createBloco({
            cronogramaId: data.cronogramaId,
            diaSemana: data.diaSemana,
            turno: data.turno,
            horarioInicio: inicio,
            horarioFim: fim,
            tipo: data.tipo,
            titulo: data.titulo,
            descricao: data.descricao ?? null,
            disciplinaCodigo: data.disciplinaCodigo ?? null,
            cor: null,
            prioridade: data.prioridade ?? 0,
            concluido: false,
          }),
        mapError
      )
    },

    async updateBlock(
      blockId: string,
      updates: Partial<BlocoCronograma>
    ): Promise<Result<BlocoCronograma, AppError>> {
      return await tryCatch(
        () => repository.blocos.updateBloco(blockId, updates),
        (error) => {
          if (error instanceof Error && error.message.includes('not found')) {
            return AppError.blockNotFound(blockId)
          }
          return mapError(error)
        }
      )
    },

    async removeBlock(blockId: string): Promise<Result<void, AppError>> {
      return await tryCatch(
        () => repository.blocos.deleteBloco(blockId),
        (error) => {
          if (error instanceof Error && error.message.includes('not found')) {
            return AppError.blockNotFound(blockId)
          }
          return mapError(error)
        }
      )
    },

    async moveBlock(data: MoveBlockData): Promise<Result<BlocoCronograma, AppError>> {
      // Valida slot
      const slotValidation = this.validateSlot(
        data.diaSemana,
        data.turno,
        data.slotIndex
      )
      if (!slotValidation.success) {
        return err(slotValidation.error)
      }

      const { inicio, fim } = slotValidation.data

      // Atualiza bloco
      return await tryCatch(
        () =>
          repository.blocos.updateBloco(data.blockId, {
            diaSemana: data.diaSemana,
            turno: data.turno,
            horarioInicio: inicio,
            horarioFim: fim,
          }),
        (error) => {
          if (error instanceof Error && error.message.includes('not found')) {
            return AppError.blockNotFound(data.blockId)
          }
          return mapError(error)
        }
      )
    },

    validateSlot(
      _diaSemana: DiaSemana,
      turno: Turno,
      slotIndex: number
    ): Result<{ inicio: string; fim: string }, AppError> {
      const slot = getSlotByIndex(turno, slotIndex)

      if (!slot) {
        return err(AppError.invalidTimeSlot(turno, slotIndex))
      }

      return ok(slot)
    },

    async isSlotAvailable(
      cronogramaId: string,
      diaSemana: DiaSemana,
      turno: Turno,
      slotIndex: number,
      excludeBlockId?: string
    ): Promise<Result<boolean, AppError>> {
      const slotValidation = this.validateSlot(diaSemana, turno, slotIndex)
      if (!slotValidation.success) {
        return err(slotValidation.error)
      }

      const { inicio } = slotValidation.data

      const blocksResult = await tryCatch(
        () => repository.blocos.getBlocos(cronogramaId),
        mapError
      )

      if (!blocksResult.success) {
        return blocksResult
      }

      const isOccupied = blocksResult.data.some(
        (b) =>
          b.diaSemana === diaSemana &&
          b.turno === turno &&
          b.horarioInicio === inicio &&
          b.id !== excludeBlockId
      )

      return ok(!isOccupied)
    },
  }
}
