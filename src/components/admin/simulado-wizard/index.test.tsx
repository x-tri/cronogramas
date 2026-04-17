/**
 * Testes do orquestrador do wizard (Fase 3.2 B).
 *
 * Foco:
 *   - Renderizacao condicional (open=false nao renderiza)
 *   - Bloqueio de avanco por validacao (meta invalido / itens incompletos)
 *   - Flow feliz: meta -> itens -> preview -> submit -> onCreated + onClose
 *   - Tratamento de erro no RPC
 *   - Botao cancelar reseta estado
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const SCHOOL_A = '11111111-1111-1111-1111-111111111111'

interface RpcCall { fn: string; payload: unknown }

function makeSupabaseMock(options: {
  rpcResult?: { data: unknown; error: { message: string } | null }
  students?: Array<{ turma: string | null }>
} = {}) {
  const rpcCalls: RpcCall[] = []
  const rpc = vi.fn((fn: string, payload: unknown) => {
    rpcCalls.push({ fn, payload })
    return Promise.resolve(
      options.rpcResult ?? { data: 'new-simulado-id', error: null },
    )
  })

  const fromFn = vi.fn((table: string) => {
    const qb: Record<string, unknown> = {
      select: vi.fn(() => qb),
      eq: vi.fn(() => qb),
      order: vi.fn(() => qb),
      then: (onFulfilled: (r: unknown) => unknown) => {
        if (table === 'students') {
          return Promise.resolve({
            data: options.students ?? [{ turma: '3A' }, { turma: '3B' }],
            error: null,
          }).then(onFulfilled)
        }
        return Promise.resolve({ data: [], error: null }).then(onFulfilled)
      },
    }
    return qb
  })

  return {
    client: { from: fromFn, rpc },
    rpcCalls,
  }
}

function mockSupabase(mock: ReturnType<typeof makeSupabaseMock>) {
  vi.doMock('../../../lib/supabase', () => ({
    supabase: mock.client,
  }))
}

async function importWizard() {
  const mod = await import('./index')
  return mod.SimuladoWizard
}

function buildFullCsv(): string {
  const lines = ['numero,conteudo,gabarito,dificuldade']
  for (let n = 1; n <= 180; n++) {
    lines.push(`${n},"Topico ${n}",A,3`)
  }
  return lines.join('\n')
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
    schools: [
      { id: SCHOOL_A, name: 'Escola A' },
      { id: '2222', name: 'Escola B' },
    ],
    isSchoolScoped: false,
    lockedSchoolId: null as string | null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe('SimuladoWizard', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('nao renderiza quando open=false', async () => {
    mockSupabase(makeSupabaseMock())
    const Wizard = await importWizard()
    const props = defaultProps({ open: false })
    render(<Wizard {...props} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renderiza modal com step inicial = meta', async () => {
    mockSupabase(makeSupabaseMock())
    const Wizard = await importWizard()
    render(<Wizard {...defaultProps()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome do simulado/i)).toBeInTheDocument()
  })

  it('botao "Proximo: Itens" desabilitado enquanto meta invalido', async () => {
    mockSupabase(makeSupabaseMock())
    const Wizard = await importWizard()
    render(<Wizard {...defaultProps()} />)
    const nextBtn = screen.getByRole('button', { name: /avancar/i })
    expect(nextBtn).toBeDisabled()
  })

  it('avanca para step items quando meta valido', async () => {
    const user = userEvent.setup()
    mockSupabase(makeSupabaseMock())
    const Wizard = await importWizard()
    render(<Wizard {...defaultProps()} />)

    await user.type(screen.getByLabelText(/Nome do simulado/i), 'Meu Simulado')
    await user.selectOptions(screen.getByLabelText(/Escola/i), SCHOOL_A)

    const nextBtn = screen.getByRole('button', { name: /avancar/i })
    expect(nextBtn).toBeEnabled()
    await user.click(nextBtn)

    // Step items carregado
    await waitFor(() => {
      expect(screen.getByText(/Importar gabarito/i)).toBeInTheDocument()
    })
  })

  it('botao "Proximo: Revisar" desabilitado enquanto itens incompletos', async () => {
    const user = userEvent.setup()
    mockSupabase(makeSupabaseMock())
    const Wizard = await importWizard()
    render(<Wizard {...defaultProps()} />)

    await user.type(screen.getByLabelText(/Nome do simulado/i), 'Teste')
    await user.selectOptions(screen.getByLabelText(/Escola/i), SCHOOL_A)
    await user.click(screen.getByRole('button', { name: /avancar/i }))

    // Step 2: Itens
    await screen.findByText(/Importar gabarito/i)
    const nextBtn = screen.getByRole('button', { name: /avancar/i })
    expect(nextBtn).toBeDisabled() // 0/180
  })

  it('flow completo: meta -> csv paste -> preview -> submit sucesso', async () => {
    const user = userEvent.setup()
    const mock = makeSupabaseMock({
      rpcResult: { data: 'sim-abc-123', error: null },
    })
    mockSupabase(mock)

    const onCreated = vi.fn()
    const onClose = vi.fn()
    const Wizard = await importWizard()
    render(<Wizard {...defaultProps({ onCreated, onClose })} />)

    // Step 1 — meta
    await user.type(
      screen.getByLabelText(/Nome do simulado/i),
      'ENEM Simulado 1',
    )
    await user.selectOptions(screen.getByLabelText(/Escola/i), SCHOOL_A)
    await user.click(screen.getByRole('button', { name: /avancar/i }))

    // Step 2 — items via CSV paste
    await screen.findByText(/Importar gabarito/i)
    const textarea = screen.getByLabelText(/Colar CSV/i)
    // fireEvent mais rapido que user.type para textarea grande
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: buildFullCsv() } })
    await user.click(screen.getByRole('button', { name: /Processar CSV/i }))

    // Dashboard deve mostrar 180/180 completo
    await screen.findByText(/180 \/ 180 itens/i)

    const nextBtn = screen.getByRole('button', { name: /avancar/i })
    expect(nextBtn).toBeEnabled()
    await user.click(nextBtn)

    // Step 3 — preview
    await screen.findByText(/Revise antes de salvar/i)
    expect(screen.getByText('ENEM Simulado 1')).toBeInTheDocument()
    expect(screen.getByText('Escola A')).toBeInTheDocument()

    // Submit
    const saveBtn = screen.getByRole('button', { name: /salvar simulado/i })
    expect(saveBtn).toBeEnabled()
    await user.click(saveBtn)

    await waitFor(() => {
      expect(mock.rpcCalls).toHaveLength(1)
    })
    const call = mock.rpcCalls[0]!
    expect(call.fn).toBe('create_simulado_with_items')
    const payload = call.payload as {
      p_title: string
      p_school_id: string
      p_turmas: string[]
      p_items: unknown[]
    }
    expect(payload.p_title).toBe('ENEM Simulado 1')
    expect(payload.p_school_id).toBe(SCHOOL_A)
    expect(payload.p_items).toHaveLength(180)

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('RPC retorna data nao-string -> mostra error e NAO chama onCreated', async () => {
    const user = userEvent.setup()
    const mock = makeSupabaseMock({
      rpcResult: { data: null, error: null }, // sucesso mas sem ID
    })
    mockSupabase(mock)

    const onCreated = vi.fn()
    const Wizard = await importWizard()
    render(<Wizard {...defaultProps({ onCreated })} />)

    await user.type(screen.getByLabelText(/Nome do simulado/i), 'Edge case')
    await user.selectOptions(screen.getByLabelText(/Escola/i), SCHOOL_A)
    await user.click(screen.getByRole('button', { name: /avancar/i }))

    await screen.findByText(/Importar gabarito/i)
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(screen.getByLabelText(/Colar CSV/i), {
      target: { value: buildFullCsv() },
    })
    await user.click(screen.getByRole('button', { name: /Processar CSV/i }))
    await screen.findByText(/180 \/ 180/i)
    await user.click(screen.getByRole('button', { name: /avancar/i }))

    await screen.findByText(/Revise antes de salvar/i)
    await user.click(screen.getByRole('button', { name: /salvar simulado/i }))

    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent(/resposta invalida/i)
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('mostra errorMessage se RPC retornar erro', async () => {
    const user = userEvent.setup()
    const mock = makeSupabaseMock({
      rpcResult: { data: null, error: { message: 'insufficient_privilege' } },
    })
    mockSupabase(mock)

    const Wizard = await importWizard()
    render(<Wizard {...defaultProps()} />)

    // Meta
    await user.type(screen.getByLabelText(/Nome do simulado/i), 'Erro test')
    await user.selectOptions(screen.getByLabelText(/Escola/i), SCHOOL_A)
    await user.click(screen.getByRole('button', { name: /avancar/i }))

    // Items
    await screen.findByText(/Importar gabarito/i)
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(screen.getByLabelText(/Colar CSV/i), {
      target: { value: buildFullCsv() },
    })
    await user.click(screen.getByRole('button', { name: /Processar CSV/i }))
    await screen.findByText(/180 \/ 180/i)
    await user.click(screen.getByRole('button', { name: /avancar/i }))

    // Preview + submit
    await screen.findByText(/Revise antes de salvar/i)
    await user.click(screen.getByRole('button', { name: /salvar simulado/i }))

    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent(/insufficient_privilege/)
  })

  it('coordinator: escola pre-selecionada e dropdown desabilitado', async () => {
    mockSupabase(makeSupabaseMock())
    const Wizard = await importWizard()
    render(
      <Wizard {...defaultProps({ isSchoolScoped: true, lockedSchoolId: SCHOOL_A })} />,
    )

    // waitFor garante que o useEffect de turmas resolve dentro de act().
    const schoolSelect = await screen.findByLabelText(/Escola/i) as HTMLSelectElement
    await waitFor(() => {
      expect(schoolSelect).toBeDisabled()
      expect(schoolSelect.value).toBe(SCHOOL_A)
    })
  })

  it('cancelar fecha o wizard', async () => {
    const user = userEvent.setup()
    mockSupabase(makeSupabaseMock())
    const onClose = vi.fn()
    const Wizard = await importWizard()
    render(<Wizard {...defaultProps({ onClose })} />)

    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('botao fechar (X) fecha o wizard', async () => {
    const user = userEvent.setup()
    mockSupabase(makeSupabaseMock())
    const onClose = vi.fn()
    const Wizard = await importWizard()
    render(<Wizard {...defaultProps({ onClose })} />)

    await user.click(screen.getByRole('button', { name: /^fechar$/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
