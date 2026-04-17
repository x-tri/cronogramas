/**
 * Testes do AdminSimulados (Fase 3.1).
 *
 * Mocka o supabase client para simular diferentes cenarios:
 *  - Loading
 *  - Erro de fetch
 *  - Lista vazia
 *  - Lista populada (3 simulados com status diferentes)
 *  - Filtro de status
 *  - Filtro de escola (so super_admin)
 *  - CTA "Criar simulado" mostra alert stub
 *  - Coordinator nao enxerga filtro de escola
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Helpers para mockar o query builder do supabase-js (chain fluente)
// ---------------------------------------------------------------------------

interface QueryState {
  readonly table: string
  readonly filters: Array<{ col: string; value: unknown }>
}

type Resolver = (state: QueryState) =>
  | { data: unknown[]; error: null }
  | { data: null; error: { message: string } }

function makeQueryBuilder(state: QueryState, resolver: Resolver) {
  const qb: Record<string, unknown> = {
    select: vi.fn(() => qb),
    order: vi.fn(() => qb),
    eq: vi.fn((col: string, value: unknown) => {
      state = { ...state, filters: [...state.filters, { col, value }] }
      return qb
    }),
    then: (onFulfilled: (r: ReturnType<Resolver>) => unknown) =>
      Promise.resolve(resolver(state)).then(onFulfilled),
  }
  return qb
}

const SCHOOL_A = '11111111-1111-1111-1111-111111111111'
const SCHOOL_B = '22222222-2222-2222-2222-222222222222'

function mockSupabaseWith(resolver: Resolver) {
  vi.doMock('../../lib/supabase', () => ({
    supabase: {
      from: vi.fn((table: string) =>
        makeQueryBuilder({ table, filters: [] }, resolver),
      ),
    },
  }))
}

async function importComponent() {
  const mod = await import('./admin-simulados')
  return mod.AdminSimulados
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCHOOLS = [
  { id: SCHOOL_A, name: 'Escola A' },
  { id: SCHOOL_B, name: 'Escola B' },
]

const SIMULADOS_FIXTURE = [
  {
    id: 's-1',
    title: 'ENEM Simulado 1',
    school_id: SCHOOL_A,
    turmas: ['3A', '3B'],
    status: 'draft' as const,
    published_at: null,
    created_at: '2026-04-01T10:00:00Z',
    simulado_respostas: [{ count: 0 }],
  },
  {
    id: 's-2',
    title: 'ENEM Simulado 2',
    school_id: SCHOOL_A,
    turmas: [],
    status: 'published' as const,
    published_at: '2026-04-10T10:00:00Z',
    created_at: '2026-04-05T10:00:00Z',
    simulado_respostas: [{ count: 42 }],
  },
  {
    id: 's-3',
    title: 'ENEM Simulado 3 (Encerrado)',
    school_id: SCHOOL_B,
    turmas: ['3A'],
    status: 'closed' as const,
    published_at: '2026-03-10T10:00:00Z',
    created_at: '2026-03-05T10:00:00Z',
    simulado_respostas: [{ count: 15 }],
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminSimulados', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('mostra estado vazio + CTA quando nao ha simulados', async () => {
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') return { data: [], error: null }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    expect(
      await screen.findByText(/Nenhum simulado encontrado/i),
    ).toBeInTheDocument()
    // 2 botoes criar: header + empty state CTA
    expect(screen.getAllByRole('button', { name: /criar simulado/i })).toHaveLength(2)
  })

  it('renderiza cards de simulados com titulo, status e respostas', async () => {
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') return { data: SIMULADOS_FIXTURE, error: null }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    expect(await screen.findByText('ENEM Simulado 1')).toBeInTheDocument()
    expect(screen.getByText('ENEM Simulado 2')).toBeInTheDocument()
    expect(screen.getByText('ENEM Simulado 3 (Encerrado)')).toBeInTheDocument()

    // Status badges
    expect(screen.getByLabelText(/Status: Rascunho/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Status: Publicado/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Status: Encerrado/i)).toBeInTheDocument()

    // Contagem de respostas
    expect(screen.getByLabelText(/0 respostas recebidas/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/42 respostas recebidas/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/15 respostas recebidas/i)).toBeInTheDocument()
  })

  it('coordinator: NAO renderiza filtro de escola, escopo fixo', async () => {
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') {
        // Coordinator deve enviar filter eq school_id=SCHOOL_A
        const schoolFilter = state.filters.find((f) => f.col === 'school_id')
        expect(schoolFilter?.value).toBe(SCHOOL_A)
        return { data: SIMULADOS_FIXTURE.slice(0, 2), error: null }
      }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="coordinator" userSchoolId={SCHOOL_A} />)

    await screen.findByText('ENEM Simulado 1')

    // Filtro de escola nao aparece
    expect(screen.queryByLabelText(/^Escola$/i)).not.toBeInTheDocument()
    // Filtro de status aparece (exact label, sem match com badges "Status: X")
    expect(screen.getByLabelText(/^Status$/i)).toBeInTheDocument()
  })

  it('muda filtro de status e refaz o fetch', async () => {
    const user = userEvent.setup()
    let lastStatusFilter: string | null = null

    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') {
        const statusFilter = state.filters.find((f) => f.col === 'status')
        lastStatusFilter = (statusFilter?.value as string) ?? null
        return { data: [], error: null }
      }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    await screen.findByText(/Nenhum simulado encontrado/i)
    expect(lastStatusFilter).toBeNull() // "all" nao aplica eq

    const statusSelect = screen.getByLabelText(/^Status$/i)
    await user.selectOptions(statusSelect, 'published')

    await waitFor(() => {
      expect(lastStatusFilter).toBe('published')
    })
  })

  it('super_admin: renderiza filtro de escola com lista carregada', async () => {
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') return { data: [], error: null }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    const schoolSelect = await screen.findByLabelText(/^Escola$/i)
    expect(schoolSelect).toBeInTheDocument()
    expect(within(schoolSelect).getByRole('option', { name: 'Escola A' })).toBeInTheDocument()
    expect(within(schoolSelect).getByRole('option', { name: 'Escola B' })).toBeInTheDocument()
    expect(within(schoolSelect).getByRole('option', { name: 'Todas as escolas' })).toBeInTheDocument()
  })

  it('click em "Criar simulado" abre o wizard (Fase 3.2)', async () => {
    const user = userEvent.setup()

    mockSupabaseWith(() => ({ data: [], error: null }))
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    await screen.findByText(/Nenhum simulado encontrado/i)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const createBtns = screen.getAllByRole('button', { name: /criar simulado/i })
    await user.click(createBtns[0]!)

    // Wizard modal deve aparecer
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Criar simulado ENEM')
  })

  it('mostra mensagem de erro se o fetch de simulados falhar', async () => {
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') {
        return { data: null, error: { message: 'permission denied' } }
      }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/permission denied/i)
  })

  it('card com turmas vazias mostra "Todas as turmas"', async () => {
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') {
        return { data: [SIMULADOS_FIXTURE[1]], error: null } // turmas: []
      }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    await screen.findByText('ENEM Simulado 2')
    expect(screen.getByText('Todas as turmas')).toBeInTheDocument()
  })

  it('filtro de status "all" por padrao, sem eq(status)', async () => {
    const calls: Array<{ col: string; value: unknown }> = []

    mockSupabaseWith((state) => {
      if (state.table === 'simulados') {
        calls.push(...state.filters)
        return { data: [], error: null }
      }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    await screen.findByText(/Nenhum simulado encontrado/i)
    expect(calls.find((c) => c.col === 'status')).toBeUndefined()
  })

  it('draft card: renderiza botao Publicar + Excluir (sem Encerrar)', async () => {
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') {
        return { data: [SIMULADOS_FIXTURE[0]], error: null } // draft
      }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    await screen.findByText('ENEM Simulado 1')
    expect(screen.getByRole('button', { name: /^Publicar ENEM Simulado 1$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Excluir ENEM Simulado 1$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Encerrar ENEM Simulado 1$/ })).not.toBeInTheDocument()
  })

  it('published card: renderiza botao Encerrar + Excluir (sem Publicar)', async () => {
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') {
        return { data: [SIMULADOS_FIXTURE[1]], error: null } // published
      }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    await screen.findByText('ENEM Simulado 2')
    expect(screen.getByRole('button', { name: /^Encerrar ENEM Simulado 2$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Publicar ENEM Simulado 2$/ })).not.toBeInTheDocument()
  })

  it('closed card: apenas Excluir + Ver respostas (sem Publicar nem Encerrar)', async () => {
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') {
        return { data: [SIMULADOS_FIXTURE[2]], error: null } // closed
      }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    await screen.findByText(/ENEM Simulado 3/)
    expect(screen.queryByRole('button', { name: /Publicar ENEM/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Encerrar ENEM/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Excluir ENEM Simulado 3/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ver respostas de ENEM Simulado 3/i })).toBeInTheDocument()
  })

  it('clicar Publicar abre ConfirmDialog com tone default', async () => {
    const user = userEvent.setup()
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') return { data: [SIMULADOS_FIXTURE[0]], error: null }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    await screen.findByText('ENEM Simulado 1')
    await user.click(screen.getByRole('button', { name: /^Publicar ENEM Simulado 1$/ }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/Publicar simulado/i)
    expect(dialog).toHaveTextContent(/ENEM Simulado 1/)
  })

  it('clicar Excluir abre ConfirmDialog com mensagem permanente', async () => {
    const user = userEvent.setup()
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') return { data: [SIMULADOS_FIXTURE[1]], error: null }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    await screen.findByText('ENEM Simulado 2')
    await user.click(screen.getByRole('button', { name: /^Excluir ENEM Simulado 2$/ }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/Excluir simulado/i)
    expect(dialog).toHaveTextContent(/APAGADO permanentemente/i)
    expect(dialog).toHaveTextContent(/nao pode ser desfeita/i)
  })

  it('Ver respostas abre drawer com titulo', async () => {
    const user = userEvent.setup()
    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') return { data: [SIMULADOS_FIXTURE[1]], error: null }
      if (state.table === 'simulado_respostas') return { data: [], error: null }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    await screen.findByText('ENEM Simulado 2')
    await user.click(screen.getByRole('button', { name: /Ver respostas de ENEM Simulado 2/i }))

    await waitFor(() => {
      const dialogs = screen.getAllByRole('dialog')
      // O drawer tem aria-label com o titulo do simulado
      const respostasDrawer = dialogs.find((d) =>
        d.getAttribute('aria-label')?.includes('ENEM Simulado 2'),
      )
      expect(respostasDrawer).toBeDefined()
      expect(respostasDrawer).toHaveTextContent(/Respostas recebidas/i)
    })
  })

  it('fireEvent no filtro de escola altera o fetch', async () => {
    const schoolFilters: string[] = []

    mockSupabaseWith((state) => {
      if (state.table === 'schools') return { data: SCHOOLS, error: null }
      if (state.table === 'simulados') {
        const f = state.filters.find((x) => x.col === 'school_id')
        if (f) schoolFilters.push(f.value as string)
        return { data: [], error: null }
      }
      return { data: [], error: null }
    })
    const Comp = await importComponent()
    render(<Comp userRole="super_admin" />)

    const schoolSelect = (await screen.findByLabelText(/^Escola$/i)) as HTMLSelectElement
    fireEvent.change(schoolSelect, { target: { value: SCHOOL_B } })

    await waitFor(() => {
      expect(schoolFilters).toContain(SCHOOL_B)
    })
  })
})
