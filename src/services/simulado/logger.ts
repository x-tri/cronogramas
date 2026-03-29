const SIMULADO_DEBUG_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_DEBUG_SIMULADO === 'true'

export function simuladoLog(...args: unknown[]): void {
  if (!SIMULADO_DEBUG_ENABLED) return
  console.log(...args)
}
