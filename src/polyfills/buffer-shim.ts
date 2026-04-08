/**
 * Minimal `Buffer` shim para o browser.
 *
 * `@react-pdf/layout@4.4.2` usa `Buffer.isBuffer(source)` em `fetchImage` sem
 * o browser field em seu package.json — como resultado, Vite bundla o código
 * Node cru e o browser quebra com `ReferenceError: Buffer is not defined`
 * toda vez que o layout tenta resolver uma imagem remota.
 *
 * O único método realmente consumido é `Buffer.isBuffer(x)`, que no browser
 * precisa apenas retornar `false` (não existem instâncias de Node Buffer aqui).
 * Expomos também `Buffer.from`/`Buffer.alloc` como no-ops defensivos para
 * evitar quebras caso outra parte do renderer tente usá-los.
 *
 * Importe ANTES de qualquer módulo que toque `@react-pdf/*`.
 */
declare global {
  interface Window {
    Buffer?: unknown
  }
}

type BufferShim = {
  readonly isBuffer: (value: unknown) => boolean
  readonly from: (value: ArrayBufferLike | ArrayLike<number> | string) => Uint8Array
  readonly alloc: (size: number) => Uint8Array
}

const bufferShim: BufferShim = {
  isBuffer: (value: unknown): boolean => {
    void value
    return false
  },
  from: (value: ArrayBufferLike | ArrayLike<number> | string): Uint8Array => {
    if (typeof value === 'string') {
      if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(value)
      }
      const bytes = new Uint8Array(value.length)
      for (let i = 0; i < value.length; i += 1) {
        bytes[i] = value.charCodeAt(i) & 0xff
      }
      return bytes
    }
    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value)
    }
    return new Uint8Array(value as ArrayLike<number>)
  },
  alloc: (size: number): Uint8Array => new Uint8Array(size),
}

const globalRef = globalThis as unknown as { Buffer?: unknown }
if (typeof globalRef.Buffer === 'undefined') {
  globalRef.Buffer = bufferShim
}

export {}
