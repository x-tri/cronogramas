/**
 * Questões comprovadamente corrompidas no banco uhqdkaftqjxenobdfqkd.
 *
 * Fonte da validação:
 * - OCR nas imagens do próprio storage
 * - comparação com stem/support_text/question_options
 * - conferência manual nas capturas do relatório
 *
 * Enquanto a base não for saneada na origem, essas questões ficam fora
 * do caderno recomendado para não entregar material errado ao aluno.
 */

export const QUARANTINED_QUESTION_IDS = new Set<string>([
  // ENEM 2020 Q136: stem de lucro/gráfico, mas storage retorna a imagem da bandeira.
  '855793dd-a525-45e0-a97c-e2c85b3c2cdb',
  // ENEM 2020 Q148: stem da bandeira, mas storage retorna o gráfico "Jovens em atividade...".
  '2665fdd3-c983-4ebe-8896-422c4692d6eb',
])

export function isQuestionQuarantined(questionId: string | null | undefined): boolean {
  if (!questionId) return false
  return QUARANTINED_QUESTION_IDS.has(questionId)
}
