import { describe, expect, it } from 'vitest'

import { daysSinceLogin, engagementStatus } from './mentor-engagement'

const AGORA = new Date('2026-06-12T12:00:00Z')

describe('engagementStatus', () => {
  it('login nos últimos 7 dias é ativo', () => {
    expect(engagementStatus('2026-06-11T10:00:00Z', AGORA)).toBe('ativo')
    expect(engagementStatus('2026-06-05T13:00:00Z', AGORA)).toBe('ativo')
  })

  it('login há mais de 7 dias é inativo', () => {
    expect(engagementStatus('2026-05-29T10:00:00Z', AGORA)).toBe('inativo')
  })

  it('sem login (ou data inválida) é nunca_acessou', () => {
    expect(engagementStatus(null, AGORA)).toBe('nunca_acessou')
    expect(engagementStatus('nao-e-data', AGORA)).toBe('nunca_acessou')
  })
})

describe('daysSinceLogin', () => {
  it('conta dias inteiros desde o login', () => {
    expect(daysSinceLogin('2026-05-29T12:00:00Z', AGORA)).toBe(14)
    expect(daysSinceLogin('2026-06-12T08:00:00Z', AGORA)).toBe(0)
  })
})
