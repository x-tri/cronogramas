// Lógica pura do histórico de documentos por aluno — separada do componente
// (pdf-student-history-drawer.tsx) para testabilidade e Fast Refresh.

import type { PdfRecord } from './pdf-types'

export function selectStudentHistory(
  records: readonly PdfRecord[],
  alunoId: string,
): PdfRecord[] {
  return records
    .filter((r) => r.aluno_id === alunoId)
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
}

export interface DownloadAllDeps {
  getUrl: (storagePath: string, filename: string) => Promise<string | null>
  /** Retornar false (ou Promise<false>) conta como falha; void/true conta como sucesso. */
  triggerDownload: (url: string, filename: string) => void | boolean | Promise<void | boolean>
  onProgress?: (done: number, total: number) => void
  delayMs?: number
}

export interface DownloadAllResult {
  ok: number
  failed: number
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Sequencial de propósito: navegadores bloqueiam rajadas de downloads
// disparados programaticamente; o delay entre itens evita o bloqueio.
export async function downloadAllSequential(
  items: readonly PdfRecord[],
  deps: DownloadAllDeps,
): Promise<DownloadAllResult> {
  const delayMs = deps.delayMs ?? 400
  let ok = 0
  let failed = 0

  for (const [index, item] of items.entries()) {
    const url = await deps.getUrl(item.storage_path, item.filename)
    if (url) {
      const downloaded = await deps.triggerDownload(url, item.filename)
      if (downloaded === false) {
        failed += 1
      } else {
        ok += 1
      }
    } else {
      failed += 1
    }
    deps.onProgress?.(index + 1, items.length)
    if (index < items.length - 1 && delayMs > 0) await wait(delayMs)
  }

  return { ok, failed }
}
