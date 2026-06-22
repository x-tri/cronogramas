export function ensurePdfFilename(filename: string | null | undefined, fallback = 'material.pdf'): string {
  const cleaned = filename?.trim()
  const base = cleaned && cleaned.length > 0 ? cleaned : fallback
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`
}

export function saveBlobAsFile(blob: Blob, filename: string): string {
  const safeFilename = ensurePdfFilename(filename)
  const pdfBlob =
    blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
  const file = new File([pdfBlob], safeFilename, { type: 'application/pdf' })
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

export async function downloadFileFromUrl(url: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    if (!response.ok) return false
    const blob = await response.blob()
    saveBlobAsFile(blob, filename)
    return true
  } catch {
    return false
  }
}
