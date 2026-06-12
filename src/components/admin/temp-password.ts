/**
 * Gera senha temporária legível (sem caracteres ambíguos como 0/O, 1/l).
 * Usada no reset de senha de mentores (Mentores & Acessos).
 *
 * Usa crypto.getRandomValues (CSPRNG) — Math.random é previsível e não
 * serve para credenciais, mesmo temporárias com troca forçada no primeiro
 * login. A fonte é injetável apenas para testes determinísticos.
 */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const PASSWORD_LENGTH = 10

export function generateTempPassword(
  randomValues: (buffer: Uint32Array) => Uint32Array = (buffer) =>
    crypto.getRandomValues(buffer),
): string {
  const buffer = randomValues(new Uint32Array(PASSWORD_LENGTH))
  let out = ''
  for (let i = 0; i < PASSWORD_LENGTH; i += 1) {
    out += ALPHABET[buffer[i] % ALPHABET.length]
  }
  return out
}
