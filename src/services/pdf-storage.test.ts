import { describe, expect, it } from 'vitest'

import { buildPdfStoragePath } from './pdf-storage'

describe('pdf-storage', () => {
  it('normaliza acentos no path do Supabase Storage', () => {
    const path = buildPdfStoragePath({
      schoolId: 'school-id',
      turma: 'Turma C',
      filename: 'caderno-questoes-roberto-nóbrega-serquiz-fonseca.pdf',
    })

    expect(path).toBe(
      'school-id/Turma-C/caderno-questoes-roberto-nobrega-serquiz-fonseca.pdf',
    )
  })

  it('garante extensão PDF no path do Supabase Storage', () => {
    const path = buildPdfStoragePath({
      schoolId: 'school-id',
      turma: 'Turma C',
      filename: 'caderno-questoes-sem-extensao',
    })

    expect(path).toBe('school-id/Turma-C/caderno-questoes-sem-extensao.pdf')
  })
})
