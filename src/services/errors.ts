/**
 * Domain Errors
 * 
 * Erros específicos do domínio da aplicação
 * com mensagens amigáveis para o usuário.
 */

export type ErrorCode =
  | 'STUDENT_NOT_FOUND'
  | 'INVALID_MATRICULA'
  | 'CRONOGRAMA_NOT_FOUND'
  | 'BLOCK_NOT_FOUND'
  | 'SLOT_OCCUPIED'
  | 'INVALID_TIME_SLOT'
  | 'REPOSITORY_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR'

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public userMessage?: string
  ) {
    super(message)
    this.name = 'AppError'
  }

  static studentNotFound(matricula: string): AppError {
    return new AppError(
      'STUDENT_NOT_FOUND',
      `Student with matricula ${matricula} not found`,
      `Aluno com matrícula ${matricula} não encontrado`
    )
  }

  static invalidMatricula(): AppError {
    return new AppError(
      'INVALID_MATRICULA',
      'Invalid matricula format',
      'Matrícula inválida. Digite apenas números.'
    )
  }

  static cronogramaNotFound(alunoId: string): AppError {
    return new AppError(
      'CRONOGRAMA_NOT_FOUND',
      `Cronograma for aluno ${alunoId} not found`,
      'Cronograma não encontrado para este aluno'
    )
  }

  static blockNotFound(blockId: string): AppError {
    return new AppError(
      'BLOCK_NOT_FOUND',
      `Block ${blockId} not found`,
      'Bloco não encontrado'
    )
  }

  static slotOccupied(dia: string, horario: string): AppError {
    return new AppError(
      'SLOT_OCCUPIED',
      `Slot ${dia} at ${horario} is occupied`,
      `Este horário em ${dia} já está ocupado`
    )
  }

  static invalidTimeSlot(turno: string, slotIndex: number): AppError {
    return new AppError(
      'INVALID_TIME_SLOT',
      `Invalid time slot ${slotIndex} for turno ${turno}`,
      'Horário inválido'
    )
  }

  static repositoryError(operation: string, cause?: unknown): AppError {
    const message = cause instanceof Error ? cause.message : String(cause)
    return new AppError(
      'REPOSITORY_ERROR',
      `Repository error during ${operation}: ${message}`,
      'Erro ao acessar dados. Tente novamente.'
    )
  }

  static networkError(): AppError {
    return new AppError(
      'NETWORK_ERROR',
      'Network error occurred',
      'Erro de conexão. Verifique sua internet.'
    )
  }

  static validationError(message: string): AppError {
    return new AppError(
      'VALIDATION_ERROR',
      message,
      message
    )
  }

  static unknownError(cause: unknown): AppError {
    const message = cause instanceof Error ? cause.message : String(cause)
    return new AppError(
      'UNKNOWN_ERROR',
      message,
      'Ocorreu um erro inesperado'
    )
  }
}

/**
 * Mapper genérico de erros para Result pattern
 */
export function mapError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return AppError.networkError()
    }
  }

  return AppError.unknownError(error)
}
