/**
 * Parser CSV para import de itens do simulado (Fase 3.2).
 *
 * Formato esperado (primeira linha = cabecalho, case-insensitive):
 *   numero,conteudo,gabarito,dificuldade
 *   1,"Funcoes exponenciais",A,3
 *   2,Geometria analitica,B,4
 *   ...
 *
 * Regras:
 *   - Delimitador: virgula.
 *   - Valores com virgula interna devem ser envoltos em aspas duplas.
 *   - Aspas duplas internas no valor sao escapadas duplicando ("").
 *   - Linhas em branco sao ignoradas.
 *   - Campos extras sao ignorados; campos obrigatorios faltando geram erro.
 *   - Valores:
 *       numero        int 1..180 (unico em todo o arquivo)
 *       gabarito      char A-E (case-insensitive)
 *       dificuldade   int 1..5, texto ou param_b decimal
 *       conteudo      string livre (maps to simulado_itens.topico; opcional)
 *
 * Retorna erros por linha ao inves de levantar excecao, para permitir que o
 * wizard exiba todos os problemas de uma vez.
 */

/** Item processado + pronto para enviar ao RPC. */
export interface SimuladoItemDraft {
  readonly numero: number
  readonly gabarito: string
  readonly dificuldade: number
  /** conteudo no CSV -> topico no DB. */
  readonly topico: string | null
}

export interface ParseError {
  /** Linha 1-indexed no arquivo original (inclui cabecalho). */
  readonly line: number
  readonly message: string
}

export type ParseResult =
  | { readonly ok: true; readonly items: readonly SimuladoItemDraft[] }
  | { readonly ok: false; readonly errors: readonly ParseError[] }

const REQUIRED_HEADERS = ['numero', 'conteudo', 'gabarito', 'dificuldade'] as const
type RequiredHeader = (typeof REQUIRED_HEADERS)[number]

const VALID_GABARITOS = new Set(['A', 'B', 'C', 'D', 'E'])
const DIFICULDADE_TEXTUAL: ReadonlyMap<string, number> = new Map([
  ['veryeasy', 1],
  ['very_easy', 1],
  ['muitofacil', 1],
  ['facilima', 1],
  ['facilimo', 1],
  ['easy', 2],
  ['facil', 2],
  ['baixa', 2],
  ['baixo', 2],
  ['low', 2],
  ['medium', 3],
  ['medio', 3],
  ['media', 3],
  ['intermediaria', 3],
  ['intermediario', 3],
  ['hard', 4],
  ['dificil', 4],
  ['alta', 4],
  ['alto', 4],
  ['high', 4],
  ['veryhard', 5],
  ['very_hard', 5],
  ['muitodificil', 5],
  ['dificilima', 5],
  ['dificilimo', 5],
])

// ---------------------------------------------------------------------------
// Tokenizer minimalista RFC 4180-ish (sem suporte a newlines em quoted).
// ---------------------------------------------------------------------------

/**
 * Auto-detecta o delimitador em uma linha (virgula vs ponto-e-virgula).
 * Excel BR salva CSVs com ';' porque ',' e separador decimal.
 * Se a linha tiver igual ou mais ';' que ',' fora de aspas, usa ';'.
 */
function detectDelimiter(line: string): ',' | ';' {
  let commas = 0
  let semicolons = 0
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      // "" -> literal aspas
      if (inQuotes && line[i + 1] === '"') {
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (!inQuotes) {
      if (ch === ',') commas++
      else if (ch === ';') semicolons++
    }
  }
  return semicolons > commas ? ';' : ','
}

function splitCsvLine(line: string, delimiter: ',' | ';' = ','): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        // "" -> literal aspas dentro de quoted
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else {
      if (ch === delimiter) {
        out.push(cur)
        cur = ''
      } else if (ch === '"' && cur === '') {
        inQuotes = true
      } else {
        cur += ch
      }
    }
  }
  out.push(cur)
  return out
}

function normalizeHeader(h: string): string {
  // Remove BOM (\uFEFF), zero-width chars e whitespace alem de lowercase.
  // Excel BR as vezes salva CSVs com UTF-8 BOM na primeira coluna.
  return h
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .trim()
    .toLowerCase()
}

/** Remove BOM do inicio do texto (UTF-8 BOM = \uFEFF). */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function indexOfHeader(headers: readonly string[], target: RequiredHeader): number {
  return headers.findIndex((h) => h === target)
}

function normalizeTextKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '')
}

function mapParamBToAngoff(paramB: number): number {
  if (paramB < -1) return 1
  if (paramB < 0) return 2
  if (paramB < 1) return 3
  if (paramB < 2) return 4
  return 5
}

function parseDificuldade(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const textual = DIFICULDADE_TEXTUAL.get(normalizeTextKey(trimmed))
  if (textual !== undefined) return textual

  const normalizedNumber = trimmed.replace(',', '.')
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalizedNumber)) return null

  const numeric = Number.parseFloat(normalizedNumber)
  if (!Number.isFinite(numeric)) return null

  const hasDecimalSeparator = /[,.]/.test(trimmed)

  // Mantem compatibilidade com o contrato antigo: Angoff inteiro 1..5.
  if (!hasDecimalSeparator && Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) {
    return numeric
  }

  // CSVs vindos do banco/API podem trazer param_b decimal (-3..+3),
  // frequentemente com virgula decimal em planilhas BR.
  if (numeric >= -4 && numeric <= 4) {
    return mapParamBToAngoff(numeric)
  }

  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) {
    return numeric
  }

  return null
}

function isBlankDataRow(
  cols: readonly string[],
  indexes: Record<RequiredHeader, number>,
): boolean {
  return REQUIRED_HEADERS.every((header) => {
    const value = cols[indexes[header]] ?? ''
    return value.trim().length === 0
  })
}

// ---------------------------------------------------------------------------
// Parse principal
// ---------------------------------------------------------------------------

export interface ParseOptions {
  /**
   * Se verdadeiro, rejeita o arquivo se nao tiver exatamente 180 itens validos.
   * Default: false (permite parse parcial com avisos).
   */
  readonly requireFullExam?: boolean
}

export function parseSimuladoCsv(
  raw: string,
  options: ParseOptions = {},
): ParseResult {
  const errors: ParseError[] = []

  // Remove BOM se presente (UTF-8 BOM frequente em CSVs do Excel)
  const cleanRaw = stripBom(raw)
  const allLines = cleanRaw.split(/\r?\n/)
  const nonEmpty = allLines
    .map((content, index) => ({ content, line: index + 1 }))
    .filter((entry) => entry.content.trim().length > 0)

  if (nonEmpty.length === 0) {
    return { ok: false, errors: [{ line: 1, message: 'CSV vazio' }] }
  }

  // Detecta delimitador a partir do cabecalho (Excel BR usa ';')
  const headerEntry = nonEmpty[0]!
  const delimiter = detectDelimiter(headerEntry.content)

  const headers = splitCsvLine(headerEntry.content, delimiter).map(normalizeHeader)
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
  if (missing.length > 0) {
    return {
      ok: false,
      errors: [
        {
          line: headerEntry.line,
          message: `cabecalho precisa conter: ${REQUIRED_HEADERS.join(', ')}. Faltando: ${missing.join(', ')}.`,
        },
      ],
    }
  }

  const idx: Record<RequiredHeader, number> = {
    numero: indexOfHeader(headers, 'numero'),
    conteudo: indexOfHeader(headers, 'conteudo'),
    gabarito: indexOfHeader(headers, 'gabarito'),
    dificuldade: indexOfHeader(headers, 'dificuldade'),
  }

  const items: SimuladoItemDraft[] = []
  const numerosVistos = new Map<number, number>()

  for (const { content, line } of nonEmpty.slice(1)) {
    const cols = splitCsvLine(content, delimiter)
    if (isBlankDataRow(cols, idx)) {
      continue
    }

    // numero
    const numeroRaw = (cols[idx.numero] ?? '').trim()
    const numero = Number.parseInt(numeroRaw, 10)
    if (!Number.isFinite(numero)) {
      errors.push({ line, message: `numero invalido: "${numeroRaw}"` })
      continue
    }
    if (numero < 1 || numero > 180) {
      errors.push({ line, message: `numero fora da faixa 1..180: ${numero}` })
      continue
    }

    // gabarito
    const gabaritoRaw = (cols[idx.gabarito] ?? '').trim().toUpperCase()
    if (!VALID_GABARITOS.has(gabaritoRaw)) {
      errors.push({ line, message: `gabarito invalido: "${gabaritoRaw}" (esperado A-E)` })
      continue
    }

    // dificuldade
    const dificuldadeRaw = (cols[idx.dificuldade] ?? '').trim()
    const dificuldade = parseDificuldade(dificuldadeRaw)
    if (dificuldade === null) {
      errors.push({
        line,
        message: `dificuldade invalida: "${dificuldadeRaw}" (esperado 1..5, texto ou param_b decimal)`,
      })
      continue
    }

    // conteudo (opcional — vira null se vazio)
    const conteudoRaw = (cols[idx.conteudo] ?? '').trim()
    const topico = conteudoRaw.length > 0 ? conteudoRaw : null

    // Duplicata de numero
    const previous = numerosVistos.get(numero)
    if (previous !== undefined) {
      errors.push({
        line,
        message: `numero ${numero} duplicado (ja aparece na linha ${previous})`,
      })
      continue
    }
    numerosVistos.set(numero, line)

    items.push({ numero, gabarito: gabaritoRaw, dificuldade, topico })
  }

  if (options.requireFullExam && errors.length === 0 && items.length !== 180) {
    errors.push({
      line: 0,
      message: `Esperados 180 itens, encontrados ${items.length}.`,
    })
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  // Ordena por numero para estabilidade
  const sorted = [...items].sort((a, b) => a.numero - b.numero)
  return { ok: true, items: sorted }
}

/**
 * Conta completude por area dado um array de itens parciais (mesmo se parse
 * retornou erro, podemos inspecionar progresso). Util para dashboards no
 * wizard Fase 3.2.
 */
export function countByArea(
  items: readonly SimuladoItemDraft[],
): Record<'LC' | 'CH' | 'CN' | 'MT', number> {
  const counts: Record<'LC' | 'CH' | 'CN' | 'MT', number> = {
    LC: 0, CH: 0, CN: 0, MT: 0,
  }
  for (const it of items) {
    if (it.numero >= 1 && it.numero <= 45) counts.LC++
    else if (it.numero >= 46 && it.numero <= 90) counts.CH++
    else if (it.numero >= 91 && it.numero <= 135) counts.CN++
    else if (it.numero >= 136 && it.numero <= 180) counts.MT++
  }
  return counts
}
