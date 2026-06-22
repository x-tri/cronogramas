// Ações de PDF com signed URL compartilhadas entre a auditoria de downloads
// (admin-pdfs.tsx) e o drawer de histórico por aluno
// (pdf-student-history-drawer.tsx) — fonte única para abrir/copiar/baixar.

import { getSignedPdfUrl } from '../../services/pdf-storage'
import {
  downloadFileFromUrl as downloadPdfFromUrl,
  ensurePdfFilename,
  fetchBlobFromUrl as fetchPdfBlobFromUrl,
  saveBlobAsFile as savePdfBlobAsFile,
} from '../../lib/pdf-download'

const LINK_ERROR_MESSAGE =
  'Não foi possível gerar o link. Verifique permissões no bucket.'

export function saveBlobAsFile(blob: Blob, filename: string): void {
  savePdfBlobAsFile(blob, filename)
}

/**
 * Baixa via fetch + blob same-origin em vez de âncora cross-origin.
 * Âncora apontando para outro domínio ignora o atributo `download` e alguns
 * navegadores nomeiam o arquivo com UUID mesmo com Content-Disposition
 * correto (incidente 2026-06-11 — PDFs baixando como "5fab20d6-..." sem
 * extensão). Blob é same-origin, então o `download` é sempre respeitado.
 */
export async function downloadFileFromUrl(url: string, filename: string): Promise<boolean> {
  return downloadPdfFromUrl(url, filename)
}

export async function fetchBlobFromUrl(url: string): Promise<Blob | null> {
  return fetchPdfBlobFromUrl(url)
}

export async function openPdfInNewTab(storagePath: string): Promise<void> {
  const url = await getSignedPdfUrl(storagePath)
  if (!url) {
    alert(LINK_ERROR_MESSAGE)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function copyPdfLink(storagePath: string, filename?: string): Promise<void> {
  const safeFilename = filename ? ensurePdfFilename(filename) : undefined
  const url = await getSignedPdfUrl(
    storagePath,
    undefined,
    safeFilename ? { downloadAs: safeFilename } : undefined,
  )
  if (!url) {
    alert(LINK_ERROR_MESSAGE)
    return
  }
  await navigator.clipboard.writeText(url)
  alert('Link copiado! (válido por 1 hora)')
}

export async function downloadPdfFile(
  storagePath: string,
  filename: string,
): Promise<void> {
  const safeFilename = ensurePdfFilename(filename)
  const url = await getSignedPdfUrl(storagePath, undefined, { downloadAs: safeFilename })
  if (!url) {
    alert(LINK_ERROR_MESSAGE)
    return
  }
  const ok = await downloadFileFromUrl(url, safeFilename)
  if (!ok) alert(LINK_ERROR_MESSAGE)
}
