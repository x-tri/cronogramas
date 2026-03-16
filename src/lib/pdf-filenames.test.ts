import { describe, expect, it } from 'vitest'
import { buildCronogramaPdfFilename, buildCronogramaPdfTitle } from './pdf-filenames'

describe('pdf-filenames', () => {
  it('builds a cronograma filename with student name and matricula', () => {
    const filename = buildCronogramaPdfFilename(
      {
        nome: 'Joao da Silva',
        matricula: '214150129',
      },
      new Date(2026, 2, 16, 12, 0, 0),
    )

    expect(filename).toBe('cronograma-joao-da-silva-214150129-2026-03-16.pdf')
  })

  it('strips accents and preserves a readable title', () => {
    const title = buildCronogramaPdfTitle(
      {
        nome: 'Joao Vitor de Araujo',
        matricula: 'XTRI01',
      },
      new Date(2026, 2, 16, 12, 0, 0),
      new Date(2026, 2, 22, 12, 0, 0),
    )

    expect(title).toContain('Joao Vitor de Araujo')
    expect(title).toContain('16/03/2026')
    expect(title).toContain('22/03/2026')
  })
})
