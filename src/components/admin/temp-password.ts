/**
 * Gera senha temporária legível (sem caracteres ambíguos como 0/O, 1/l).
 * Usada no reset de senha de mentores (Mentores & Acessos).
 */
export function generateTempPassword(
  random: () => number = Math.random,
): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(random() * alphabet.length)]
  }
  return out
}
