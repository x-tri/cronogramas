export function ensurePdfFilename(filename: string | null | undefined, fallback = 'material.pdf'): string {
  const cleaned = filename?.trim()
  const base = cleaned && cleaned.length > 0 ? cleaned : fallback
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`
}

export function saveBlobAsDownload(blob: Blob, filename: string, mimeType?: string): string {
  const safeFilename = filename.trim().length > 0 ? filename.trim() : 'download'
  const finalBlob =
    mimeType && blob.type !== mimeType ? new Blob([blob], { type: mimeType }) : blob
  const file = new File([finalBlob], safeFilename, { type: mimeType ?? finalBlob.type })
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeFilename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()

  // Revogar cedo demais pode abortar o download ou deixar o browser nomear por UUID.
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
    anchor.remove()
  }, 30_000)

  return safeFilename
}

export function saveBlobAsFile(blob: Blob, filename: string): string {
  const safeFilename = ensurePdfFilename(filename)
  return saveBlobAsDownload(blob, safeFilename, 'application/pdf')
}

export async function fetchBlobFromUrl(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.blob()
  } catch {
    return null
  }
}

export async function downloadFileFromUrl(url: string, filename: string): Promise<boolean> {
  const blob = await fetchBlobFromUrl(url)
  if (!blob) return false
  saveBlobAsFile(blob, filename)
  return true
}
