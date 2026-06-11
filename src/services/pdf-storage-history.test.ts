import { beforeEach, describe, expect, it, vi } from 'vitest'

// Incidente 2026-06-11 (FACEX): regenerar o PDF da mesma semana criava
// linhas duplicadas em pdf_history apontando para o MESMO objeto (upsert);
// apagar uma duplicata na auditoria removia o objeto compartilhado e
// orfanava as demais ("Não foi possível gerar o link").

const storageRemove = vi.fn()
const storageUpload = vi.fn()
const createSignedUrl = vi.fn()
const tableCalls: Array<{ table: string; op: string; args: unknown }> = []

// Estado configurável por teste
let existingHistoryIdForPath: string | null = null
let otherRowsForPath = 0

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: storageUpload,
        remove: storageRemove,
        createSignedUrl,
      }),
    },
    from: (table: string) => {
      const builder = {
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count) {
            // deletePdf: contagem de outras linhas com o mesmo path
            const promise = Promise.resolve({ count: otherRowsForPath, error: null })
            return Object.assign(promise, {
              eq: () => Object.assign(promise, { neq: () => promise }),
              neq: () => promise,
            })
          }
          // uploadPdf: procura linha existente por storage_path
          const result = existingHistoryIdForPath
            ? { data: { id: existingHistoryIdForPath }, error: null }
            : { data: null, error: null }
          const chain = {
            eq: () => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: () => Promise.resolve(result),
          }
          return chain
        },
        insert: (values: unknown) => {
          tableCalls.push({ table, op: 'insert', args: values })
          return Promise.resolve({ error: null })
        },
        update: (values: unknown) => {
          tableCalls.push({ table, op: 'update', args: values })
          return { eq: () => Promise.resolve({ error: null }) }
        },
        delete: () => ({
          eq: () => {
            tableCalls.push({ table, op: 'delete', args: null })
            return Promise.resolve({ error: null })
          },
        }),
      }
      return builder
    },
  },
}))

vi.mock('./audit', () => ({ logAudit: vi.fn() }))
vi.mock('../lib/project-user', () => ({
  getCurrentProjectUser: vi.fn().mockResolvedValue(null),
}))

import { deletePdf, uploadPdf } from './pdf-storage'

const UPLOAD_PARAMS = {
  blob: new Blob(['%PDF-fake'], { type: 'application/pdf' }),
  filename: 'cronograma_001_2026-06-08.pdf',
  schoolId: 'b0d15331-520f-4bc4-9d61-4ae3c8928656',
  alunoId: 'aluno-1',
  alunoNome: 'Aluno Teste',
  turma: '3ª SÉRIE BM',
  matricula: '001',
  tipo: 'cronograma' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  tableCalls.length = 0
  existingHistoryIdForPath = null
  otherRowsForPath = 0
  storageUpload.mockResolvedValue({ error: null })
  storageRemove.mockResolvedValue({ error: null })
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })
})

describe('uploadPdf — histórico sem duplicatas', () => {
  it('primeira geração insere linha nova no pdf_history', async () => {
    const result = await uploadPdf(UPLOAD_PARAMS)

    expect(result).not.toBeNull()
    const historyOps = tableCalls.filter((c) => c.table === 'pdf_history')
    expect(historyOps.map((c) => c.op)).toEqual(['insert'])
  })

  it('regeração (mesmo storage_path) ATUALIZA a linha existente em vez de duplicar', async () => {
    existingHistoryIdForPath = 'row-existente'

    const result = await uploadPdf(UPLOAD_PARAMS)

    expect(result).not.toBeNull()
    const historyOps = tableCalls.filter((c) => c.table === 'pdf_history')
    expect(historyOps.map((c) => c.op)).toEqual(['update'])
  })
})

describe('deletePdf — objeto compartilhado', () => {
  it('última linha do path remove o objeto do storage', async () => {
    otherRowsForPath = 0

    await deletePdf('row-1', 'escola/turma/arquivo.pdf')

    expect(storageRemove).toHaveBeenCalledWith(['escola/turma/arquivo.pdf'])
  })

  it('com outras linhas apontando para o mesmo path, NÃO remove o objeto', async () => {
    otherRowsForPath = 2

    await deletePdf('row-1', 'escola/turma/arquivo.pdf')

    expect(storageRemove).not.toHaveBeenCalled()
    const deleteOps = tableCalls.filter((c) => c.table === 'pdf_history' && c.op === 'delete')
    expect(deleteOps).toHaveLength(1)
  })
})
