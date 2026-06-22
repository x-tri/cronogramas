import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { PdfRecord } from './pdf-types'
import { PdfStudentHistoryDrawer } from './pdf-student-history-drawer'
import { downloadAllAsZip, downloadAllSequential, selectStudentHistory } from './pdf-student-history'

function makeRecord(overrides: Partial<PdfRecord>): PdfRecord {
  return {
    id: 'pdf-1',
    school_id: 'school-1',
    aluno_id: 'aluno-1',
    aluno_nome: 'Mariane Guara Mendes',
    turma: 'Turma 301',
    matricula: '001-008423',
    tipo: 'cronograma',
    filename: 'cronograma.pdf',
    storage_path: 'school-1/aluno-1/cronograma.pdf',
    file_size: 8192,
    created_at: '2026-05-15T10:00:00Z',
    download_count: 0,
    first_downloaded_at: null,
    last_downloaded_at: null,
    ...overrides,
  }
}

describe('selectStudentHistory', () => {
  it('filtra pelo aluno e ordena do mais recente para o mais antigo', () => {
    const records = [
      makeRecord({ id: 'a', created_at: '2026-05-15T10:00:00Z' }),
      makeRecord({ id: 'outro-aluno', aluno_id: 'aluno-2' }),
      makeRecord({ id: 'b', created_at: '2026-06-11T10:00:00Z' }),
    ]

    const history = selectStudentHistory(records, 'aluno-1')

    expect(history.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('retorna vazio quando o aluno nao tem documentos', () => {
    expect(selectStudentHistory([makeRecord({})], 'aluno-x')).toEqual([])
  })
})

describe('downloadAllSequential', () => {
  it('baixa todos em sequencia e reporta progresso', async () => {
    const items = [
      makeRecord({ id: 'a', storage_path: 'p/a.pdf', filename: 'a.pdf' }),
      makeRecord({ id: 'b', storage_path: 'p/b.pdf', filename: 'b.pdf' }),
    ]
    const calls: string[] = []
    const progress: number[] = []

    const result = await downloadAllSequential(items, {
      getUrl: async (path) => `https://signed/${path}`,
      triggerDownload: (url) => {
        calls.push(url)
      },
      onProgress: (done) => progress.push(done),
      delayMs: 0,
    })

    expect(calls).toEqual(['https://signed/p/a.pdf', 'https://signed/p/b.pdf'])
    expect(progress).toEqual([1, 2])
    expect(result).toEqual({ ok: 2, failed: 0 })
  })

  it('normaliza filename sem extensão antes de assinar e baixar', async () => {
    const items = [
      makeRecord({ id: 'a', storage_path: 'p/a.pdf', filename: 'uuid-sem-extensao' }),
    ]
    const getUrl = vi.fn(async () => 'https://signed/p/a.pdf')
    const triggerDownload = vi.fn()

    const result = await downloadAllSequential(items, {
      getUrl,
      triggerDownload,
      delayMs: 0,
    })

    expect(getUrl).toHaveBeenCalledWith('p/a.pdf', 'uuid-sem-extensao.pdf')
    expect(triggerDownload).toHaveBeenCalledWith('https://signed/p/a.pdf', 'uuid-sem-extensao.pdf')
    expect(result).toEqual({ ok: 1, failed: 0 })
  })

  it('triggerDownload assíncrono que retorna false conta como falha', async () => {
    const items = [
      makeRecord({ id: 'a', storage_path: 'p/a.pdf' }),
      makeRecord({ id: 'b', storage_path: 'p/b.pdf' }),
    ]

    const result = await downloadAllSequential(items, {
      getUrl: async (path) => `https://signed/${path}`,
      // simula fetch+blob: primeiro falha (rede), segundo baixa
      triggerDownload: async (url) => !url.includes('a.pdf'),
      delayMs: 0,
    })

    expect(result).toEqual({ ok: 1, failed: 1 })
  })

  it('continua quando uma URL falha e contabiliza a falha', async () => {
    const items = [
      makeRecord({ id: 'a', storage_path: 'p/a.pdf' }),
      makeRecord({ id: 'b', storage_path: 'p/b.pdf' }),
    ]
    const calls: string[] = []

    const result = await downloadAllSequential(items, {
      getUrl: async (path) => (path.includes('a.pdf') ? null : `https://signed/${path}`),
      triggerDownload: (url) => {
        calls.push(url)
      },
      delayMs: 0,
    })

    expect(calls).toEqual(['https://signed/p/b.pdf'])
    expect(result).toEqual({ ok: 1, failed: 1 })
  })
})

describe('downloadAllAsZip', () => {
  it('baixa os PDFs e salva um ZIP unico', async () => {
    const items = [
      makeRecord({ id: 'a', storage_path: 'p/a.pdf', filename: 'a.pdf' }),
      makeRecord({ id: 'b', storage_path: 'p/b.pdf', filename: 'uuid-sem-extensao' }),
    ]
    const getUrl = vi.fn(async (path: string) => `https://signed/${path}`)
    const fetchBlob = vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' }))
    const saveZip = vi.fn()
    const progress: number[] = []

    const result = await downloadAllAsZip(items, {
      getUrl,
      fetchBlob,
      saveZip,
      zipFilename: 'documentos-001.zip',
      onProgress: (done) => progress.push(done),
    })

    expect(getUrl).toHaveBeenNthCalledWith(1, 'p/a.pdf', 'a.pdf')
    expect(getUrl).toHaveBeenNthCalledWith(2, 'p/b.pdf', 'uuid-sem-extensao.pdf')
    expect(saveZip).toHaveBeenCalledWith(
      [
        { filename: 'a.pdf', blob: expect.any(Blob) },
        { filename: 'uuid-sem-extensao.pdf', blob: expect.any(Blob) },
      ],
      'documentos-001.zip',
    )
    expect(progress).toEqual([1, 2])
    expect(result).toEqual({ ok: 2, failed: 0 })
  })

  it('continua quando um PDF nao baixa e salva ZIP com os demais', async () => {
    const items = [
      makeRecord({ id: 'a', storage_path: 'p/a.pdf', filename: 'a.pdf' }),
      makeRecord({ id: 'b', storage_path: 'p/b.pdf', filename: 'b.pdf' }),
    ]
    const saveZip = vi.fn()

    const result = await downloadAllAsZip(items, {
      getUrl: async (path) => (path.includes('a.pdf') ? null : `https://signed/${path}`),
      fetchBlob: async () => new Blob(['pdf'], { type: 'application/pdf' }),
      saveZip,
      zipFilename: 'documentos.zip',
    })

    expect(saveZip).toHaveBeenCalledWith(
      [{ filename: 'b.pdf', blob: expect.any(Blob) }],
      'documentos.zip',
    )
    expect(result).toEqual({ ok: 1, failed: 1 })
  })
})

describe('PdfStudentHistoryDrawer', () => {
  it('mostra os documentos do aluno com tipo, badge de download e contadores', () => {
    const records = [
      makeRecord({ id: 'a', tipo: 'cronograma', download_count: 2 }),
      makeRecord({
        id: 'b',
        tipo: 'relatorio',
        created_at: '2026-06-01T10:00:00Z',
      }),
      makeRecord({
        id: 'c',
        tipo: 'caderno_questoes',
        created_at: '2026-06-11T10:00:00Z',
      }),
      makeRecord({ id: 'outro', aluno_id: 'aluno-2', aluno_nome: 'Outra Aluna' }),
    ]

    render(
      <PdfStudentHistoryDrawer
        open
        alunoId="aluno-1"
        records={records}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Mariane Guara Mendes')).toBeInTheDocument()
    expect(screen.getByText('Cronograma semanal')).toBeInTheDocument()
    expect(screen.getByText('Relatório de desempenho')).toBeInTheDocument()
    expect(screen.getByText('Caderno de questões')).toBeInTheDocument()
    expect(screen.queryByText('Outra Aluna')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /baixar tudo \(.zip\)/i })).toBeInTheDocument()
    // 1 baixado de 3
    expect(screen.getByText(/1 de 3 baixados/i)).toBeInTheDocument()
  })

  it('mostra estado vazio quando o aluno nao tem documentos', () => {
    render(
      <PdfStudentHistoryDrawer open alunoId="aluno-x" records={[]} onClose={vi.fn()} />,
    )

    expect(screen.getByText(/nenhum documento gerado/i)).toBeInTheDocument()
  })

  it('nao renderiza nada quando fechado', () => {
    const { container } = render(
      <PdfStudentHistoryDrawer
        open={false}
        alunoId="aluno-1"
        records={[makeRecord({})]}
        onClose={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
