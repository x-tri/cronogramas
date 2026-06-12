// Tipos e regras do painel de engajamento de mentores (view mentor_engagement).

export interface MentorEngagementRow {
  readonly email: string
  readonly name: string | null
  readonly school_id: string | null
  readonly school_name: string | null
  readonly role: string
  readonly last_login_at: string | null
  readonly logins_7d: number
  readonly pdfs_30d: number
  readonly alunos_30d: number
  readonly planos_30d: number
}

export type EngagementStatus = 'ativo' | 'inativo' | 'nunca_acessou'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/** Ativo = login nos últimos 7 dias; inativo = mais que isso; null = nunca. */
export function engagementStatus(
  lastLoginAt: string | null,
  now: Date = new Date(),
): EngagementStatus {
  if (!lastLoginAt) return 'nunca_acessou'
  const last = new Date(lastLoginAt).getTime()
  if (Number.isNaN(last)) return 'nunca_acessou'
  return now.getTime() - last <= SEVEN_DAYS_MS ? 'ativo' : 'inativo'
}

/** Dias inteiros desde o último login (para o rótulo "há N dias"). */
export function daysSinceLogin(
  lastLoginAt: string,
  now: Date = new Date(),
): number {
  return Math.floor(
    (now.getTime() - new Date(lastLoginAt).getTime()) / (24 * 60 * 60 * 1000),
  )
}
