import { saveBlobAsDownload } from './pdf-download'

export interface ZipEntryInput {
  readonly filename: string
  readonly blob: Blob
}

const textEncoder = new TextEncoder()
const ZIP_MIME_TYPE = 'application/zip'
const UTF8_FLAG = 0x0800

let crcTable: Uint32Array | null = null

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable

  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  crcTable = table
  return table
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date: Date): { date: number; time: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  }
}

function writeUint16(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff
  buffer[offset + 1] = (value >>> 8) & 0xff
}

function writeUint32(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff
  buffer[offset + 1] = (value >>> 8) & 0xff
  buffer[offset + 2] = (value >>> 16) & 0xff
  buffer[offset + 3] = (value >>> 24) & 0xff
}

function concatParts(parts: readonly Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function sanitizeEntryName(filename: string): string {
  const cleaned = filename
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code > 31 && code !== 127
    })
    .join('')
  return cleaned.length > 0 ? cleaned : 'documento.pdf'
}

function uniquifyFilenames(entries: readonly ZipEntryInput[]): ZipEntryInput[] {
  const seen = new Map<string, number>()

  return entries.map((entry) => {
    const sanitized = sanitizeEntryName(entry.filename)
    const current = seen.get(sanitized) ?? 0
    seen.set(sanitized, current + 1)

    if (current === 0) return { ...entry, filename: sanitized }

    const dotIndex = sanitized.lastIndexOf('.')
    const suffix = ` (${current + 1})`
    const filename =
      dotIndex > 0
        ? `${sanitized.slice(0, dotIndex)}${suffix}${sanitized.slice(dotIndex)}`
        : `${sanitized}${suffix}`
    return { ...entry, filename }
  })
}

function ensureZipFilename(filename: string): string {
  const cleaned = filename.trim().length > 0 ? filename.trim() : 'documentos.zip'
  return /\.zip$/i.test(cleaned) ? cleaned : `${cleaned}.zip`
}

function blobToBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.readAsArrayBuffer(blob)
  })
}

export async function createZipBlob(
  entries: readonly ZipEntryInput[],
  now = new Date(),
): Promise<Blob> {
  const files = uniquifyFilenames(entries)
  const { date, time } = dosDateTime(now)
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const filenameBytes = textEncoder.encode(file.filename)
    const data = await blobToBytes(file.blob)
    const crc = crc32(data)

    const localHeader = new Uint8Array(30 + filenameBytes.length)
    writeUint32(localHeader, 0, 0x04034b50)
    writeUint16(localHeader, 4, 20)
    writeUint16(localHeader, 6, UTF8_FLAG)
    writeUint16(localHeader, 8, 0)
    writeUint16(localHeader, 10, time)
    writeUint16(localHeader, 12, date)
    writeUint32(localHeader, 14, crc)
    writeUint32(localHeader, 18, data.length)
    writeUint32(localHeader, 22, data.length)
    writeUint16(localHeader, 26, filenameBytes.length)
    writeUint16(localHeader, 28, 0)
    localHeader.set(filenameBytes, 30)

    const centralHeader = new Uint8Array(46 + filenameBytes.length)
    writeUint32(centralHeader, 0, 0x02014b50)
    writeUint16(centralHeader, 4, 20)
    writeUint16(centralHeader, 6, 20)
    writeUint16(centralHeader, 8, UTF8_FLAG)
    writeUint16(centralHeader, 10, 0)
    writeUint16(centralHeader, 12, time)
    writeUint16(centralHeader, 14, date)
    writeUint32(centralHeader, 16, crc)
    writeUint32(centralHeader, 20, data.length)
    writeUint32(centralHeader, 24, data.length)
    writeUint16(centralHeader, 28, filenameBytes.length)
    writeUint16(centralHeader, 30, 0)
    writeUint16(centralHeader, 32, 0)
    writeUint16(centralHeader, 34, 0)
    writeUint16(centralHeader, 36, 0)
    writeUint32(centralHeader, 38, 0)
    writeUint32(centralHeader, 42, offset)
    centralHeader.set(filenameBytes, 46)

    localParts.push(localHeader, data)
    centralParts.push(centralHeader)
    offset += localHeader.length + data.length
  }

  const centralDirectory = concatParts(centralParts)
  const endRecord = new Uint8Array(22)
  writeUint32(endRecord, 0, 0x06054b50)
  writeUint16(endRecord, 4, 0)
  writeUint16(endRecord, 6, 0)
  writeUint16(endRecord, 8, files.length)
  writeUint16(endRecord, 10, files.length)
  writeUint32(endRecord, 12, centralDirectory.length)
  writeUint32(endRecord, 16, offset)
  writeUint16(endRecord, 20, 0)

  const zipBytes = concatParts([...localParts, centralDirectory, endRecord])
  const zipBuffer = new ArrayBuffer(zipBytes.byteLength)
  new Uint8Array(zipBuffer).set(zipBytes)
  return new Blob([zipBuffer], { type: ZIP_MIME_TYPE })
}

export async function saveBlobsAsZip(
  entries: readonly ZipEntryInput[],
  filename: string,
): Promise<string> {
  const safeFilename = ensureZipFilename(filename)
  const zipBlob = await createZipBlob(entries)
  return saveBlobAsDownload(zipBlob, safeFilename, ZIP_MIME_TYPE)
}
