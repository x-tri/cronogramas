import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ResetConfirmModal } from './reset-confirm-modal'

describe('ResetConfirmModal', () => {
  it('renderiza em portal, bloqueia scroll e fecha com Escape', () => {
    const onClose = vi.fn()

    const { unmount } = render(
      <div data-testid="local-parent">
        <ResetConfirmModal
          isOpen
          onClose={onClose}
          onConfirm={vi.fn()}
          studentName="MARIANE GUARA MENDES"
          blockCount={19}
        />
      </div>,
    )

    const dialog = screen.getByRole('dialog', { name: /Refazer Cronograma/i })

    expect(dialog).toBeInTheDocument()
    expect(screen.getByTestId('local-parent')).not.toContainElement(dialog)
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
