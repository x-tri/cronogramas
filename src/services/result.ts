/**
 * Result Pattern
 * 
 * Uma abordagem funcional para tratamento de erros,
 * eliminando a necessidade de try/catch em toda a aplicação.
 * 
 * Inspirado em Rust, Elm e outras linguagens funcionais.
 */

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data }
}

export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error }
}

/**
 * Helper para executar funções async e retornar Result
 */
export async function tryCatch<T, E = Error>(
  fn: () => Promise<T>,
  errorMapper?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const data = await fn()
    return ok(data)
  } catch (error) {
    const mappedError = errorMapper
      ? errorMapper(error)
      : (error as E)
    return err(mappedError)
  }
}

/**
 * Helper para executar funções sync e retornar Result
 */
export function tryCatchSync<T, E = Error>(
  fn: () => T,
  errorMapper?: (error: unknown) => E
): Result<T, E> {
  try {
    const data = fn()
    return ok(data)
  } catch (error) {
    const mappedError = errorMapper
      ? errorMapper(error)
      : (error as E)
    return err(mappedError)
  }
}

/**
 * Helper para unwrap com valor padrão
 */
export function unwrapOr<T>(result: Result<T, unknown>, defaultValue: T): T {
  return result.success ? result.data : defaultValue
}

/**
 * Helper para mapear dados quando sucesso
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  return result.success ? ok(fn(result.data)) : result
}

/**
 * Helper para encadear operações (flatMap)
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  return result.success ? fn(result.data) : result
}
