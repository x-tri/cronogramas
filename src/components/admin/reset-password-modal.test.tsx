import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { generateTempPassword } from './temp-password'

const rpcMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u' } }, error: null }) },
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}))
vi.mock('../../services/audit', () => ({ logAudit: vi.fn() }))

import { ResetPasswordModal } from './admin-coordenadores'

const MENTOR = {
  id: 'pu-1',
  auth_uid: 'auth-1',
  email: 'felipe.martins@dbosco.com.br',
  name: 'Felipe Martins',
  school_id: '4c8b9c6a-8a3c-48a7-b913-9eb2acf8a25e',
  role: 'coordinator',
  allowed_series: ['3º Ano'],
  is_active: true,
  created_at: '2026-01-01',
  invite_code: null,
  invite_used_at: null,
  school: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  rpcMock.mockResolvedValue({ data: { success: true, message: 'ok' }, error: null })
})

describe('generateTempPassword', () => {
  it('gera 8 caracteres legíveis sem ambíguos', () => {
    const senha = generateTempPassword(() => 0.5)
    expect(senha).toHaveLength(8)
    expect(senha).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]+$/)
  })
})

describe('ResetPasswordModal', () => {
  it('chama a RPC preservando papel, escola e séries do mentor', async () => {
    render(<ResetPasswordModal user={MENTOR} onClose={vi.fn()} />)

    const input = screen.getByLabelText(/senha temporária/i, { selector: 'input' })
    fireEvent.change(input, { target: { value: 'nova-senha-123' } })
    fireEvent.click(screen.getByRole('button', { name: /resetar senha/i }))

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1))
    expect(rpcMock).toHaveBeenCalledWith('add_project_user', {
      p_email: 'felipe.martins@dbosco.com.br',
      p_password: 'nova-senha-123',
      p_name: 'Felipe Martins',
      p_role: 'coordinator',
      p_school_id: '4c8b9c6a-8a3c-48a7-b913-9eb2acf8a25e',
      p_allowed_series: ['3º Ano'],
    })

    // tela de sucesso com a senha para copiar
    expect(await screen.findByText(/senha temporária definida/i)).toBeInTheDocument()
    expect(screen.getByText('nova-senha-123')).toBeInTheDocument()
  })

  it('senha curta nao dispara a RPC', async () => {
    render(<ResetPasswordModal user={MENTOR} onClose={vi.fn()} />)

    const input = screen.getByLabelText(/senha temporária/i, { selector: 'input' })
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /resetar senha/i }))

    await waitFor(() =>
      expect(screen.getByText(/pelo menos 6 caracteres/i)).toBeInTheDocument(),
    )
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('falha da RPC mostra a mensagem e nao mostra sucesso', async () => {
    rpcMock.mockResolvedValue({
      data: { success: false, message: 'Apenas super_admin pode adicionar usuarios' },
      error: null,
    })

    render(<ResetPasswordModal user={MENTOR} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /resetar senha/i }))

    expect(
      await screen.findByText(/apenas super_admin/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/senha temporária definida/i)).not.toBeInTheDocument()
  })
})
