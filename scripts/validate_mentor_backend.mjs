import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_ENV_FILE = '.env.local'
const CORE_TABLES = [
  'mentor_plans',
  'mentor_plan_items',
  'mentor_analysis_runs',
  'mentor_alerts',
  'mentor_alert_feedback',
]
const TAXONOMY_TABLES = ['content_topics', 'exam_question_topics']
const V2_CHECKS = [
  {
    type: 'columns',
    table: 'mentor_plans',
    select: 'capability_state,generation_mode,mapped_pairs,total_pairs,coverage_percent,distinct_topics',
    label: 'colunas V2 de mentor_plans',
  },
  {
    type: 'columns',
    table: 'mentor_plan_items',
    select: 'topic_id,fallback_label,fallback_area_sigla,fallback_habilidade',
    label: 'colunas V2 de mentor_plan_items',
  },
  {
    type: 'join',
    table: 'exam_question_topics',
    select: 'id,topic:content_topics(id)',
    label: 'join exam_question_topics -> content_topics',
  },
  {
    type: 'rpc',
    name: 'get_school_names',
    body: { school_ids: [] },
    label: 'RPC get_school_names(uuid[])',
  },
]

function parseArgs(argv) {
  const options = {
    envFile: DEFAULT_ENV_FILE,
    json: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--env-file') {
      options.envFile = argv[index + 1] ?? DEFAULT_ENV_FILE
      index += 1
    }
  }

  return options
}

function loadEnvFile(envFile) {
  const filePath = resolve(process.cwd(), envFile)
  if (!existsSync(filePath)) {
    return {}
  }

  const result = {}
  const lines = readFileSync(filePath, 'utf-8').split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    result[key] = value
  }

  return result
}

function getRuntimeConfig(options) {
  const envFromFile = loadEnvFile(options.envFile)
  const env = {
    ...envFromFile,
    ...process.env,
  }

  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_KEY

  if (!url || !key) {
    throw new Error(
      'VITE_SUPABASE_URL e VITE_SUPABASE_KEY são obrigatórias para validar o backend do mentor.',
    )
  }

  return {
    url,
    key,
    projectRef: new URL(url).hostname.split('.')[0] ?? 'desconhecido',
    envFile: options.envFile,
  }
}

async function apiRequest(config, path, init = {}) {
  const response = await fetch(`${config.url}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })

  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  }
}

async function checkTable(config, table, select = 'id') {
  return apiRequest(
    config,
    `/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`,
  )
}

async function checkRpc(config, rpcName, body) {
  return apiRequest(config, `/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    body,
  })
}

function classifyResponse(response) {
  if (response.ok) {
    return 'ok'
  }

  const message = String(response.body?.message ?? '')

  if (response.status === 404 && message.includes('schema cache')) {
    return 'missing'
  }

  if (response.status === 404) {
    return 'missing'
  }

  if (response.status === 401 || response.status === 403) {
    return 'forbidden'
  }

  return 'error'
}

function buildCapabilityState(results) {
  const coreReady = CORE_TABLES.every((table) => results.tables[table]?.status === 'ok')
  const taxonomyReady = TAXONOMY_TABLES.every((table) => results.tables[table]?.status === 'ok')
  const v2Ready = results.contracts.every((item) => item.status === 'ok')

  if (!coreReady) return 'core_missing'
  if (!taxonomyReady) return 'taxonomy_missing'
  if (!v2Ready) return 'taxonomy_partial'
  return 'ready'
}

function formatStatus(status) {
  switch (status) {
    case 'ok':
      return 'OK'
    case 'missing':
      return 'AUSENTE'
    case 'forbidden':
      return 'SEM_PERMISSAO'
    default:
      return 'ERRO'
  }
}

function summarizeBody(body) {
  if (!body) return ''
  if (Array.isArray(body)) {
    return `rows=${body.length}`
  }

  const message = body.message ?? body.error_description ?? body.error ?? null
  if (message) return String(message)

  return JSON.stringify(body)
}

function renderTextReport(report) {
  const lines = [
    `Projeto: ${report.projectRef}`,
    `Fonte de configuração: ${report.envFile}`,
    `Estado de capability: ${report.capabilityState}`,
    '',
    'Tabelas:',
  ]

  for (const [table, result] of Object.entries(report.tables)) {
    lines.push(`- ${table}: ${formatStatus(result.status)} (${result.httpStatus}) ${result.summary}`)
  }

  lines.push('')
  lines.push('Contrato V2:')

  for (const result of report.contracts) {
    lines.push(`- ${result.label}: ${formatStatus(result.status)} (${result.httpStatus}) ${result.summary}`)
  }

  lines.push('')
  lines.push('Próximos passos:')

  if (report.capabilityState === 'core_missing') {
    lines.push('- Aplicar as migrations 008 e 009 no projeto comwcnmvnuzqqbypjtqn.')
    lines.push('- Fazer refresh do schema cache do PostgREST após a migração.')
  } else if (report.capabilityState === 'taxonomy_missing') {
    lines.push('- Validar criação das tabelas content_topics e exam_question_topics.')
    lines.push('- Rodar o backfill de taxonomia antes de testar o plano completo.')
  } else if (report.capabilityState === 'taxonomy_partial') {
    lines.push('- Validar colunas V2, RPC get_school_names e join crítico exam_question_topics -> content_topics.')
    lines.push('- Confirmar cobertura mínima antes de liberar fluxo taxonomy_complete.')
  } else {
    lines.push('- Backend pronto para teste do fluxo mentor-centric.')
  }

  return lines.join('\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const config = getRuntimeConfig(options)

  const tableEntries = await Promise.all(
    [...CORE_TABLES, ...TAXONOMY_TABLES, 'cronogramas'].map(async (table) => {
      const response = await checkTable(config, table)
      return [
        table,
        {
          status: classifyResponse(response),
          httpStatus: response.status,
          summary: summarizeBody(response.body),
        },
      ]
    }),
  )

  const contractChecks = await Promise.all(
    V2_CHECKS.map(async (check) => {
      const response =
        check.type === 'rpc'
          ? await checkRpc(config, check.name, check.body)
          : await checkTable(config, check.table, check.select)

      return {
        label: check.label,
        status: classifyResponse(response),
        httpStatus: response.status,
        summary: summarizeBody(response.body),
      }
    }),
  )

  const report = {
    projectRef: config.projectRef,
    envFile: config.envFile,
    tables: Object.fromEntries(tableEntries),
    contracts: contractChecks,
  }

  const capabilityState = buildCapabilityState(report)
  const finalReport = {
    ...report,
    capabilityState,
  }

  if (options.json) {
    console.log(JSON.stringify(finalReport, null, 2))
  } else {
    console.log(renderTextReport(finalReport))
  }

  if (capabilityState !== 'ready') {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
