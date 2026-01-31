import type { DataRepository } from '../data/repository'
import type { Aluno } from '../types/domain'
import { type Result, tryCatch, ok, err } from './result'
import { AppError, mapError } from './errors'

export interface StudentService {
  findByMatricula(matricula: string): Promise<Result<Aluno, AppError>>
  findByTurma(turma: string): Promise<Result<Aluno[], AppError>>
  validateMatricula(matricula: string): Result<void, AppError>
}

export function createStudentService(
  repository: DataRepository
): StudentService {
  return {
    async findByMatricula(matricula: string): Promise<Result<Aluno, AppError>> {
      // Validação
      const validation = this.validateMatricula(matricula)
      if (!validation.success) {
        return validation
      }

      // Busca
      const result = await tryCatch(
        () => repository.students.findByMatricula(matricula.trim()),
        mapError
      )

      if (!result.success) {
        return result
      }

      if (!result.data) {
        return err(AppError.studentNotFound(matricula))
      }

      return ok(result.data)
    },

    async findByTurma(turma: string): Promise<Result<Aluno[], AppError>> {
      const result = await tryCatch(
        () => repository.students.findByTurma(turma),
        mapError
      )

      if (!result.success) {
        return result
      }

      return ok(result.data)
    },

    validateMatricula(matricula: string): Result<void, AppError> {
      const trimmed = matricula.trim()

      if (!trimmed) {
        return err(AppError.validationError('Matrícula é obrigatória'))
      }

      if (!/^\d+$/.test(trimmed)) {
        return err(AppError.invalidMatricula())
      }

      if (trimmed.length < 5 || trimmed.length > 20) {
        return err(
          AppError.validationError('Matrícula deve ter entre 5 e 20 dígitos')
        )
      }

      return ok(undefined)
    },
  }
}
