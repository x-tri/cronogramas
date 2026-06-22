import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadFileFromUrl, ensurePdfFilename, fetchBlobFromUrl, saveBlobAsFile } from './pdf-download'

const createObjectURL = vi.fn(() => 'blob:pdf-download')
const revokeObjectURL = vi.fn()

describe('pdf-download', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL
    delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL
    vi.unstubAllGlobals()
  })

  it('garante extensão PDF no nome do arquivo', () => {
    expect(ensurePdfFilename('caderno-de-questoes')).toBe('caderno-de-questoes.pdf')
    expect(ensurePdfFilename('cronograma.pdf')).toBe('cronograma.pdf')
    expect(ensurePdfFilename('')).toBe('material.pdf')
  })

  it('salva blob com filename estável no atributo download', () => {
    const anchors: HTMLAnchorElement[] = []
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName === 'a') anchors.push(element as HTMLAnchorElement)
      return element
    })

    const filename = saveBlobAsFile(new Blob(['pdf'], { type: 'text/plain' }), 'uuid-sem-extensao')

    expect(filename).toBe('uuid-sem-extensao.pdf')
    expect(anchors[0].download).toBe('uuid-sem-extensao.pdf')
    expect(anchors[0].href).toBe('blob:pdf-download')
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce()

    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pdf-download')
  })

  it('baixa URL assinada como blob antes de disparar o download', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(downloadFileFromUrl('https://signed.local/pdf', 'lista.pdf')).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith('https://signed.local/pdf')
    expect(createObjectURL).toHaveBeenCalledOnce()
  })

  it('retorna blob da URL assinada sem disparar download', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchBlobFromUrl('https://signed.local/pdf')).resolves.toBe(blob)
  })
})
