import { enemDataSupabase } from '../lib/enem-data-supabase'

export type SisuCourseCatalogItem = {
  id: number
  codigo: number
  nome: string
  universidade: string
  campus: string | null
  cidade: string
  estado: string
  grau: string | null
  turno: string | null
}

export type SisuWeights = {
  ano: number | null
  peso_redacao: number
  peso_linguagens: number
  peso_matematica: number
  peso_ciencias_humanas: number
  peso_ciencias_natureza: number
  minimo_redacao: number | null
  minimo_linguagens: number | null
  minimo_matematica: number | null
  minimo_ciencias_humanas: number | null
  minimo_ciencias_natureza: number | null
  minimo_enem: number | null
}

export type SisuCutoffSummary = {
  ano: number | null
  notaCorteReferencia: number | null
  codigoModalidadeReferencia: number | null
  modalidadeReferencia: string | null
  capturadoEmReferencia: string | null
  vagasReferencia: number | null
  tipoReferencia: 'ampla_concorrencia' | 'maior_corte' | 'indisponivel'
  origemReferencia: 'aprovados_final' | 'notas_corte' | 'indisponivel'
  notaCorteMaxima: number | null
  notaCorteMedia: number | null
  modalidadesConsideradas: number
  chamadaConvocadosReferencia: number | null
  totalConvocadosAmostra: number
  amostraConvocadosCompleta: boolean
  maiorNotaConvocadoAmostra: number | null
  menorNotaConvocadoAmostra: number | null
}

export type SisuCourseObjective = {
  curso: SisuCourseCatalogItem
  pesos: SisuWeights
  notaCorte: SisuCutoffSummary
}

type SisuCourseRow = {
  id: number
  codigo: number
  nome: string
  universidade: string
  campus: string | null
  cidade: string
  estado: string
  grau: string | null
  turno: string | null
}

type SisuCutoffRow = {
  ano: number
  codigo_modalidade: number
  nome_modalidade: string | null
  nota_corte: number | null
  vagas?: number | null
  capturado_em?: string | null
}

type SisuAprovadoRow = {
  numero_chamada: number | null
  status: string | null
  nota: number | null
}

let catalogPromise: Promise<SisuCourseCatalogItem[]> | null = null
const objectiveCache = new Map<number, Promise<SisuCourseObjective>>()

function sortPtBr(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right, 'pt-BR'))
}

async function loadCatalog(): Promise<SisuCourseCatalogItem[]> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const pageSize = 1000
      const rows: SisuCourseCatalogItem[] = []
      let from = 0

      while (true) {
        const { data, error } = await enemDataSupabase
          .from('sisu_cursos')
          .select('id, codigo, nome, universidade, campus, cidade, estado, grau, turno')
          .order('estado', { ascending: true })
          .order('cidade', { ascending: true })
          .order('universidade', { ascending: true })
          .order('nome', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) {
          throw error
        }

        const batch = ((data ?? []) as SisuCourseRow[])
          .filter((row) => row.estado && row.cidade && row.universidade && row.nome)
          .map((row) => ({
            id: row.id,
            codigo: row.codigo,
            nome: row.nome,
            universidade: row.universidade,
            campus: row.campus,
            cidade: row.cidade,
            estado: row.estado,
            grau: row.grau,
            turno: row.turno,
          }))

        rows.push(...batch)

        if (batch.length < pageSize) {
          break
        }

        from += pageSize
      }

      return rows
    })()
  }

  return catalogPromise
}

export async function listSisuEstados(): Promise<string[]> {
  const catalog = await loadCatalog()
  return sortPtBr([...new Set(catalog.map((item) => item.estado))])
}

export async function listSisuCidades(estado: string): Promise<string[]> {
  const catalog = await loadCatalog()
  return sortPtBr(
    [...new Set(catalog.filter((item) => item.estado === estado).map((item) => item.cidade))],
  )
}

export async function listSisuUniversidades(estado: string, cidade: string): Promise<string[]> {
  const catalog = await loadCatalog()
  return sortPtBr(
    [
      ...new Set(
        catalog
          .filter((item) => item.estado === estado && item.cidade === cidade)
          .map((item) => item.universidade),
      ),
    ],
  )
}

export async function listSisuCursos(
  estado: string,
  cidade: string,
  universidade: string,
): Promise<SisuCourseCatalogItem[]> {
  const catalog = await loadCatalog()
  return catalog
    .filter(
      (item) =>
        item.estado === estado && item.cidade === cidade && item.universidade === universidade,
    )
    .sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'))
}

function normalizeWeights(row?: Partial<SisuWeights> | null): SisuWeights {
  return {
    ano: row?.ano ?? null,
    peso_redacao: row?.peso_redacao ?? 1,
    peso_linguagens: row?.peso_linguagens ?? 1,
    peso_matematica: row?.peso_matematica ?? 1,
    peso_ciencias_humanas: row?.peso_ciencias_humanas ?? 1,
    peso_ciencias_natureza: row?.peso_ciencias_natureza ?? 1,
    minimo_redacao: row?.minimo_redacao ?? null,
    minimo_linguagens: row?.minimo_linguagens ?? null,
    minimo_matematica: row?.minimo_matematica ?? null,
    minimo_ciencias_humanas: row?.minimo_ciencias_humanas ?? null,
    minimo_ciencias_natureza: row?.minimo_ciencias_natureza ?? null,
    minimo_enem: row?.minimo_enem ?? null,
  }
}

function isValidCutoff(value: number | null): value is number {
  return typeof value === 'number' && value > 0
}

function isAmplaConcorrencia(row: SisuCutoffRow): boolean {
  return row.codigo_modalidade === 41 || row.nome_modalidade?.toLowerCase().includes('ampla concorr') === true
}

function emptyCutoffSummary(): SisuCutoffSummary {
  return {
    ano: null,
    notaCorteReferencia: null,
    codigoModalidadeReferencia: null,
    modalidadeReferencia: null,
    capturadoEmReferencia: null,
    vagasReferencia: null,
    tipoReferencia: 'indisponivel',
    origemReferencia: 'indisponivel',
    notaCorteMaxima: null,
    notaCorteMedia: null,
    modalidadesConsideradas: 0,
    chamadaConvocadosReferencia: null,
    totalConvocadosAmostra: 0,
    amostraConvocadosCompleta: false,
    maiorNotaConvocadoAmostra: null,
    menorNotaConvocadoAmostra: null,
  }
}

export function summarizeSisuCutoffs(rows: SisuCutoffRow[]): SisuCutoffSummary {
  const validRows = rows.filter((row) => isValidCutoff(row.nota_corte))
  if (validRows.length === 0) {
    return emptyCutoffSummary()
  }

  const anoReferencia = validRows.reduce((maxYear, row) => Math.max(maxYear, row.ano), validRows[0].ano)
  const rowsAno = validRows.filter((row) => row.ano === anoReferencia)
  const ampla = rowsAno.find(isAmplaConcorrencia) ?? null
  const rowReferencia = ampla ?? rowsAno.reduce((best, row) => {
    if (!best) return row
    return (row.nota_corte ?? 0) > (best.nota_corte ?? 0) ? row : best
  }, rowsAno[0] ?? null)
  const notasAno = rowsAno.map((row) => row.nota_corte as number)

  return {
    ano: anoReferencia,
    notaCorteReferencia: rowReferencia?.nota_corte ?? null,
    codigoModalidadeReferencia: rowReferencia?.codigo_modalidade ?? null,
    modalidadeReferencia: rowReferencia?.nome_modalidade ?? null,
    capturadoEmReferencia: rowReferencia?.capturado_em ?? null,
    vagasReferencia: rowReferencia?.vagas ?? null,
    tipoReferencia: ampla ? 'ampla_concorrencia' : 'maior_corte',
    origemReferencia: 'notas_corte',
    notaCorteMaxima: notasAno.length > 0 ? Math.max(...notasAno) : null,
    notaCorteMedia: notasAno.length > 0
      ? notasAno.reduce((total, value) => total + value, 0) / notasAno.length
      : null,
    modalidadesConsideradas: rowsAno.length,
    chamadaConvocadosReferencia: null,
    totalConvocadosAmostra: 0,
    amostraConvocadosCompleta: false,
    maiorNotaConvocadoAmostra: null,
    menorNotaConvocadoAmostra: null,
  }
}

function summarizeConvocadosSample(
  rows: SisuAprovadoRow[],
  vagasReferencia: number | null,
): Pick<
  SisuCutoffSummary,
  | 'notaCorteReferencia'
  | 'origemReferencia'
  | 'chamadaConvocadosReferencia'
  | 'totalConvocadosAmostra'
  | 'amostraConvocadosCompleta'
  | 'maiorNotaConvocadoAmostra'
  | 'menorNotaConvocadoAmostra'
> {
  const convocados = rows.filter(
    (row) => row.status?.toLowerCase() === 'convocado' && typeof row.nota === 'number' && row.nota > 0,
  )

  if (convocados.length === 0) {
    return {
      notaCorteReferencia: null,
      origemReferencia: 'indisponivel',
      chamadaConvocadosReferencia: null,
      totalConvocadosAmostra: 0,
      amostraConvocadosCompleta: false,
      maiorNotaConvocadoAmostra: null,
      menorNotaConvocadoAmostra: null,
    }
  }

  const chamadaFinal = convocados.reduce(
    (maxCall, row) => Math.max(maxCall, row.numero_chamada ?? 0),
    0,
  )

  const notasChamadaFinal = convocados
    .filter((row) => row.numero_chamada === chamadaFinal)
    .map((row) => row.nota as number)

  const todasNotas = convocados.map((row) => row.nota as number)

  return {
    notaCorteReferencia: notasChamadaFinal.length > 0 ? Math.min(...notasChamadaFinal) : null,
    origemReferencia: notasChamadaFinal.length > 0 ? 'aprovados_final' : 'notas_corte',
    chamadaConvocadosReferencia: chamadaFinal || null,
    totalConvocadosAmostra: todasNotas.length,
    amostraConvocadosCompleta:
      typeof vagasReferencia === 'number' && vagasReferencia > 0
        ? todasNotas.length >= vagasReferencia
        : false,
    maiorNotaConvocadoAmostra: Math.max(...todasNotas),
    menorNotaConvocadoAmostra: Math.min(...todasNotas),
  }
}

export async function getSisuCourseObjective(courseId: number): Promise<SisuCourseObjective> {
  if (!objectiveCache.has(courseId)) {
    objectiveCache.set(courseId, (async () => {
      const catalog = await loadCatalog()
      const curso = catalog.find((item) => item.id === courseId)

      if (!curso) {
        throw new Error('Curso do SISU não encontrado no catálogo')
      }

      const [{ data: pesosData, error: pesosError }, { data: notasData, error: notasError }] = await Promise.all([
        enemDataSupabase
          .from('sisu_pesos')
          .select(
            'ano, peso_redacao, peso_linguagens, peso_matematica, peso_ciencias_humanas, peso_ciencias_natureza, minimo_redacao, minimo_linguagens, minimo_matematica, minimo_ciencias_humanas, minimo_ciencias_natureza, minimo_enem',
          )
          .eq('curso_id', courseId)
          .order('ano', { ascending: false })
          .limit(1),
        enemDataSupabase
          .from('sisu_notas_corte')
          .select('ano, codigo_modalidade, nome_modalidade, nota_corte, vagas, capturado_em')
          .eq('curso_id', courseId)
          .order('ano', { ascending: false })
          .limit(200),
      ])

      if (pesosError) {
        throw pesosError
      }

      if (notasError) {
        throw notasError
      }

      const pesos = normalizeWeights((pesosData?.[0] as Partial<SisuWeights> | undefined) ?? null)
      const notaCorte = summarizeSisuCutoffs((notasData ?? []) as SisuCutoffRow[])

      if (notaCorte.ano && notaCorte.codigoModalidadeReferencia) {
        const { data: aprovadosData, error: aprovadosError } = await enemDataSupabase
          .from('sisu_aprovados')
          .select('numero_chamada, status, nota')
          .eq('curso_id', courseId)
          .eq('ano', notaCorte.ano)
          .eq('codigo_modalidade', notaCorte.codigoModalidadeReferencia)
          .order('numero_chamada', { ascending: false })
          .limit(5000)

        if (!aprovadosError) {
          const sample = summarizeConvocadosSample(
            (aprovadosData ?? []) as SisuAprovadoRow[],
            notaCorte.vagasReferencia,
          )

          notaCorte.chamadaConvocadosReferencia = sample.chamadaConvocadosReferencia
          notaCorte.totalConvocadosAmostra = sample.totalConvocadosAmostra
          notaCorte.amostraConvocadosCompleta = sample.amostraConvocadosCompleta
          notaCorte.maiorNotaConvocadoAmostra = sample.maiorNotaConvocadoAmostra
          notaCorte.menorNotaConvocadoAmostra = sample.menorNotaConvocadoAmostra

          if (sample.notaCorteReferencia != null) {
            notaCorte.notaCorteReferencia = sample.notaCorteReferencia
            notaCorte.origemReferencia = sample.origemReferencia
          }
        }
      }

      return {
        curso,
        pesos,
        notaCorte,
      }
    })())
  }

  return objectiveCache.get(courseId)!
}
