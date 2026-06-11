import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useSchools } from './use-schools'

const eqMock = vi.fn()
const orderMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: (...args: unknown[]) => orderMock(...args),
      }),
    }),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const SCHOOLS = [
  { id: 'dom-bosco', name: 'Dom Bosco' },
  { id: 'facex', name: 'FACEX' },
]

beforeEach(() => {
  vi.clearAllMocks()
  // order() resolve direto (sem escopo) e também expõe eq() (com escopo)
  orderMock.mockReturnValue(
    Object.assign(Promise.resolve({ data: SCHOOLS, error: null }), {
      eq: eqMock,
    }),
  )
  eqMock.mockResolvedValue({ data: [SCHOOLS[0]], error: null })
})

describe('useSchools', () => {
  it('carrega a lista completa quando não há escopo', async () => {
    const { result } = renderHook(() => useSchools(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.schools).toEqual(SCHOOLS)
    expect(eqMock).not.toHaveBeenCalled()
  })

  it('coordenador escopado busca apenas a própria escola', async () => {
    const { result } = renderHook(() => useSchools({ userSchoolId: 'dom-bosco' }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(eqMock).toHaveBeenCalledWith('id', 'dom-bosco')
    expect(result.current.schools).toEqual([SCHOOLS[0]])
  })

  it('enabled: false não dispara fetch', async () => {
    const { result } = renderHook(() => useSchools({ enabled: false }), { wrapper })

    expect(result.current.loading).toBe(false)
    expect(result.current.schools).toEqual([])
    expect(orderMock).not.toHaveBeenCalled()
  })
})
