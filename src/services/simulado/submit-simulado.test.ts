/**
 * Testes de integracao do handler submitSimulado.
 *
 * Estrategia: conecta na instancia local do Supabase (supabase start) e usa
 * service_role para setup/teardown. As migrations 015/016/017 ja devem estar
 * aplicadas no DB (via scripts/test-migrations/run.sh).
 *
 * Pre-requisitos:
 *   - supabase start rodando (DB em 127.0.0.1:54322, API em 54321)
 *   - migrations + fixtures aplicadas (via run.sh)
 *
 * Os testes criam seu proprio escopo (UUIDs fixos unicos por teste) e limpam
 * depois. Skippam silenciosamente se a API local nao estiver disponivel, para
 * nao quebrar CI sem infra Supabase.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { submitSimulado, answersMapToArray } from './submit-simulado.ts'

// Chaves default do supabase local (HS256 assinadas com o secret conhecido
// "super-secret-jwt-token-with-at-least-32-characters-long" exposto no env do
// container supabase_rest_*). So validas contra 127.0.0.1.
const LOCAL_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxOTk5OTk5OTk5fQ' +
  '.fBgTyTakexiFCCvLrqJCIKJ5djtLtI1lZZgilPw8kGU'

const SCHOOL_A = '11111111-1111-1111-1111-11111111aaaa'
const SCHOOL_B = '22222222-2222-2222-2222-22222222bbbb'
const STUDENT_A = 'aaaaaaaa-0000-0000-0000-0000000000aa'
const STUDENT_B_OTHER_SCHOOL = 'bbbbbbbb-0000-0000-0000-0000000000bb'

let client: SupabaseClient
let isLocalAvailable = false

beforeAll(async () => {
  client = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  // Ping rapido
  const { error } = await client.from('simulados').select('id').limit(1)
  isLocalAvailable = !error
  if (!isLocalAvailable) {
    console.warn('[submit-simulado.test] Supabase local indisponivel — skippando.')
    return
  }

  // Fixtures: escolas
  await client
    .from('schools')
    .upsert([{ id: SCHOOL_A, name: 'Escola A' }, { id: SCHOOL_B, name: 'Escola B' }])
  // Fixtures: students
  await client.from('students').upsert([
    { id: STUDENT_A, school_id: SCHOOL_A, turma: '3A', name: 'Aluno A' },
    { id: STUDENT_B_OTHER_SCHOOL, school_id: SCHOOL_B, turma: '3B', name: 'Aluno B' },
  ])
})

afterAll(async () => {
  if (!isLocalAvailable) return
  // Limpa tudo que tem student_id em scope
  await client.from('simulado_respostas').delete().in('student_id', [
    STUDENT_A, STUDENT_B_OTHER_SCHOOL,
  ])
  // Apaga simulados de teste (CASCADE cuida dos itens)
  await client.from('simulados').delete().in('school_id', [SCHOOL_A, SCHOOL_B])
})

/** Helper: cria simulado com 180 itens (gabarito= todas 'A', dif=3). */
async function createPublishedSimulado(schoolId: string, title: string): Promise<string> {
  const { data, error } = await client
    .from('simulados')
    .insert({ title, school_id: schoolId })
    .select('id')
    .single<{ id: string }>()
  if (error || !data) throw new Error(`create simulado: ${error?.message}`)
  const sid = data.id

  const rows: Array<{
    simulado_id: string
    numero: number
    area: string
    gabarito: string
    dificuldade: number
    topico: string
    habilidade: string
  }> = []
  const areas: Array<{ area: string; start: number; end: number }> = [
    { area: 'LC', start: 1, end: 45 },
    { area: 'CH', start: 46, end: 90 },
    { area: 'CN', start: 91, end: 135 },
    { area: 'MT', start: 136, end: 180 },
  ]
  for (const a of areas) {
    for (let n = a.start; n <= a.end; n++) {
      rows.push({
        simulado_id: sid,
        numero: n,
        area: a.area,
        gabarito: 'A',
        dificuldade: 3,
        topico: `Topico ${a.area}`,
        habilidade: `H${((n - 1) % 30) + 1}`,
      })
    }
  }
  const { error: itensErr } = await client.from('simulado_itens').insert(rows)
  if (itensErr) throw new Error(`create itens: ${itensErr.message}`)

  const { error: pubErr } = await client
    .from('simulados')
    .update({ status: 'published' })
    .eq('id', sid)
  if (pubErr) throw new Error(`publish: ${pubErr.message}`)

  return sid
}

async function cleanupSimulado(id: string): Promise<void> {
  await client.from('simulados').delete().eq('id', id)
}

describe('answersMapToArray', () => {
  it('converte objeto {"1":"A","2":"B"} em array de 180', () => {
    const arr = answersMapToArray({ '1': 'A', '2': 'b', '180': 'E' })
    expect(arr).toHaveLength(180)
    expect(arr[0]).toBe('A')
    expect(arr[1]).toBe('B') // uppercase
    expect(arr[2]).toBe('') // branco
    expect(arr[179]).toBe('E')
  })

  it('ignora letras invalidas', () => {
    const arr = answersMapToArray({ '1': 'F', '2': 'Z', '3': '-' })
    expect(arr[0]).toBe('')
    expect(arr[1]).toBe('')
    expect(arr[2]).toBe('')
  })
})

describe('submitSimulado — integracao (requer supabase local)', () => {
  it('acerta todas -> TRI no teto + 180 acertos', async () => {
    if (!isLocalAvailable) return
    const sid = await createPublishedSimulado(SCHOOL_A, 'SIM-integ-1')
    try {
      const answers: Record<string, string> = {}
      for (let n = 1; n <= 180; n++) answers[String(n)] = 'A'

      const result = await submitSimulado({
        client,
        studentId: STUDENT_A,
        payload: { simulado_id: sid, answers },
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.totais.acertos).toBe(180)
      expect(result.data.totais.erros).toBe(0)
      expect(result.data.totais.branco).toBe(0)
      expect(result.data.tri.LC).toBeGreaterThan(500)
      expect(result.data.tri.MT).toBeGreaterThan(500)
      expect(Object.keys(result.data.erros_por_topico)).toHaveLength(0)
    } finally {
      await cleanupSimulado(sid)
    }
  })

  it('tudo errado (B quando gabarito=A) -> piso + 180 erros', async () => {
    if (!isLocalAvailable) return
    const sid = await createPublishedSimulado(SCHOOL_A, 'SIM-integ-2')
    try {
      const answers: Record<string, string> = {}
      for (let n = 1; n <= 180; n++) answers[String(n)] = 'B'

      const result = await submitSimulado({
        client,
        studentId: STUDENT_A,
        payload: { simulado_id: sid, answers },
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.totais.erros).toBe(180)
      expect(result.data.totais.acertos).toBe(0)
      // Mapa de erros deve acumular por topico e habilidade
      expect(Object.values(result.data.erros_por_topico).reduce((a, b) => a + b, 0)).toBe(180)
    } finally {
      await cleanupSimulado(sid)
    }
  })

  it('bloqueia submissao dupla (ja_submitted)', async () => {
    if (!isLocalAvailable) return
    const sid = await createPublishedSimulado(SCHOOL_A, 'SIM-integ-3')
    try {
      const answers: Record<string, string> = {}
      for (let n = 1; n <= 180; n++) answers[String(n)] = 'A'

      const first = await submitSimulado({
        client, studentId: STUDENT_A, payload: { simulado_id: sid, answers },
      })
      expect(first.ok).toBe(true)

      const second = await submitSimulado({
        client, studentId: STUDENT_A, payload: { simulado_id: sid, answers },
      })
      expect(second.ok).toBe(false)
      if (second.ok) return
      expect(second.error.kind).toBe('already_submitted')
    } finally {
      await cleanupSimulado(sid)
    }
  })

  it('bloqueia aluno de outra escola (student_not_eligible)', async () => {
    if (!isLocalAvailable) return
    const sid = await createPublishedSimulado(SCHOOL_A, 'SIM-integ-4')
    try {
      const answers: Record<string, string> = {}
      for (let n = 1; n <= 180; n++) answers[String(n)] = 'A'
      const result = await submitSimulado({
        client, studentId: STUDENT_B_OTHER_SCHOOL, payload: { simulado_id: sid, answers },
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.kind).toBe('student_not_eligible')
    } finally {
      await cleanupSimulado(sid)
    }
  })

  it('bloqueia simulado em draft (simulado_not_published)', async () => {
    if (!isLocalAvailable) return
    const { data, error } = await client
      .from('simulados')
      .insert({ title: 'SIM-integ-draft', school_id: SCHOOL_A })
      .select('id')
      .single<{ id: string }>()
    if (error || !data) throw new Error(error?.message)
    const sid = data.id
    try {
      const answers: Record<string, string> = {}
      for (let n = 1; n <= 180; n++) answers[String(n)] = 'A'
      const result = await submitSimulado({
        client, studentId: STUDENT_A, payload: { simulado_id: sid, answers },
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.kind).toBe('simulado_not_published')
    } finally {
      await cleanupSimulado(sid)
    }
  })

  it('payload invalido (sem simulado_id) -> invalid_payload', async () => {
    if (!isLocalAvailable) return
    const result = await submitSimulado({
      client, studentId: STUDENT_A, payload: { answers: {} },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('invalid_payload')
  })

  it('simulado_id inexistente -> simulado_not_found', async () => {
    if (!isLocalAvailable) return
    // UUID v4 valido mas inexistente no DB
    const fakeId = '99999999-9999-4999-8999-999999999999'
    const answers: Record<string, string> = {}
    for (let n = 1; n <= 180; n++) answers[String(n)] = 'A'
    const result = await submitSimulado({
      client, studentId: STUDENT_A, payload: { simulado_id: fakeId, answers },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('simulado_not_found')
  })

  it('race de insert simultaneo -> segundo recebe already_submitted (nao db_error)', async () => {
    if (!isLocalAvailable) return
    const sid = await createPublishedSimulado(SCHOOL_A, 'SIM-integ-race')
    try {
      const answers: Record<string, string> = {}
      for (let n = 1; n <= 180; n++) answers[String(n)] = 'A'

      // Dispara as 2 submissoes em paralelo — a 2a tem que cair no branch
      // de unique_violation (23505) remapeado para already_submitted.
      const [first, second] = await Promise.all([
        submitSimulado({ client, studentId: STUDENT_A, payload: { simulado_id: sid, answers } }),
        submitSimulado({ client, studentId: STUDENT_A, payload: { simulado_id: sid, answers } }),
      ])

      const oks = [first, second].filter((r) => r.ok).length
      const fails = [first, second].filter((r) => !r.ok)
      expect(oks).toBe(1)
      expect(fails).toHaveLength(1)
      const loser = fails[0]!
      if (loser.ok) return
      expect(loser.error.kind).toBe('already_submitted')
    } finally {
      await cleanupSimulado(sid)
    }
  })

  it('metade dos itens em branco -> calcula corretamente', async () => {
    if (!isLocalAvailable) return
    const sid = await createPublishedSimulado(SCHOOL_A, 'SIM-integ-branco')
    try {
      const answers: Record<string, string> = {}
      // So responde 90 (primeiras questoes de cada area)
      for (let n = 1; n <= 22; n++) answers[String(n)] = 'A'
      for (let n = 46; n <= 67; n++) answers[String(n)] = 'A'
      for (let n = 91; n <= 112; n++) answers[String(n)] = 'A'
      for (let n = 136; n <= 157; n++) answers[String(n)] = 'A'

      const result = await submitSimulado({
        client, studentId: STUDENT_A, payload: { simulado_id: sid, answers },
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.totais.acertos).toBe(88) // 22 * 4 areas
      expect(result.data.totais.respondidas).toBe(88)
      expect(result.data.totais.branco).toBe(92)
      // Cada area deve ter 22 acertos + 0 erros + 23 brancos
      expect(result.data.por_area.LC).toEqual({ acertos: 22, erros: 0, branco: 23 })
      expect(result.data.por_area.MT).toEqual({ acertos: 22, erros: 0, branco: 23 })
    } finally {
      await cleanupSimulado(sid)
    }
  })
})
