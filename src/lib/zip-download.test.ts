import { describe, expect, it, vi } from 'vitest'

import { createZipBlob, saveBlobsAsZip } from './zip-download'

function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.readAsArrayBuffer(blob)
  })
}

describe('zip-download', () => {
  it('cria ZIP com nomes normalizados e extensao zip', async () => {
    const zip = await createZipBlob(
      [
        { filename: 'cronograma.pdf', blob: new Blob(['a'], { type: 'application/pdf' }) },
        { filename: 'pasta/caderno.pdf', blob: new Blob(['b'], { type: 'application/pdf' }) },
      ],
      new Date('2026-06-22T10:00:00Z'),
    )

    const bytes = await readBlobBytes(zip)
    const text = new TextDecoder().decode(bytes)

    expect(zip.type).toBe('application/zip')
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
    expect(text).toContain('cronograma.pdf')
    expect(text).toContain('pasta-caderno.pdf')
  })

  it('salva ZIP por anchor com filename estavel', async () => {
    const anchors: HTMLAnchorElement[] = []
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName === 'a') anchors.push(element as HTMLAnchorElement)
      return element
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:zip')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const filename = await saveBlobsAsZip(
      [{ filename: 'cronograma.pdf', blob: new Blob(['a'], { type: 'application/pdf' }) }],
      'documentos-214150437',
    )

    expect(filename).toBe('documentos-214150437.zip')
    expect(anchors[0].download).toBe('documentos-214150437.zip')
  })
})
