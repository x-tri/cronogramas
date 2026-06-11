// Ações de PDF com signed URL compartilhadas entre a auditoria de downloads
// (admin-pdfs.tsx) e o drawer de histórico por aluno
// (pdf-student-history-drawer.tsx) — fonte única para abrir/copiar/baixar.

import { getSignedPdfUrl } from '../../services/pdf-storage'

const LINK_ERROR_MESSAGE =
  'Não foi possível gerar o link. Verifique permissões no bucket.'

export function triggerBrowserDownload(url: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export async function openPdfInNewTab(storagePath: string): Promise<void> {
  const url = await getSignedPdfUrl(storagePath)
  if (!url) {
    alert(LINK_ERROR_MESSAGE)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function copyPdfLink(storagePath: string): Promise<void> {
  const url = await getSignedPdfUrl(storagePath)
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
  const url = await getSignedPdfUrl(storagePath, undefined, { downloadAs: filename })
  if (!url) {
    alert(LINK_ERROR_MESSAGE)
    return
  }
  triggerBrowserDownload(url, filename)
}
