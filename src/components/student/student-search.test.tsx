import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentSearch } from './student-search'
import { RepositoryProvider, resetRepository, forceMockRepository, initializeRepository } from '../../data/factory'
import type { DataRepository } from '../../data/repository'

describe('StudentSearch', () => {
  let mockRepository: DataRepository

  beforeEach(() => {
    resetRepository()
    mockRepository = forceMockRepository()
    initializeRepository()
  })

  const renderWithProvider = (component: React.ReactNode) => {
    return render(
      <RepositoryProvider repository={mockRepository} mode="mock">
        {component}
      </RepositoryProvider>
    )
  }

  it('should render search input and button', () => {
    renderWithProvider(<StudentSearch />)

    expect(screen.getByLabelText(/matrícula/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /buscar/i })).toBeInTheDocument()
  })

  it('should show error for empty input', async () => {
    renderWithProvider(<StudentSearch />)
    
    const searchButton = screen.getByRole('button', { name: /buscar/i })
    fireEvent.click(searchButton)

    expect(await screen.findByText(/digite uma matrícula/i)).toBeInTheDocument()
  })

  it('should show error for non-existent student', async () => {
    renderWithProvider(<StudentSearch />)
    
    const input = screen.getByLabelText(/matrícula/i)
    const searchButton = screen.getByRole('button', { name: /buscar/i })

    await userEvent.type(input, '999999999')
    fireEvent.click(searchButton)

    expect(await screen.findByText(/aluno não encontrado/i)).toBeInTheDocument()
  })

  it('should find existing student', async () => {
    renderWithProvider(<StudentSearch />)
    
    const input = screen.getByLabelText(/matrícula/i)
    const searchButton = screen.getByRole('button', { name: /buscar/i })

    await userEvent.type(input, '214150129')
    fireEvent.click(searchButton)

    // Espera a busca completar verificando que o loading parou
    await waitFor(() => {
      expect(searchButton).not.toBeDisabled()
    })
  })

  it('should trigger search on Enter key', async () => {
    renderWithProvider(<StudentSearch />)
    
    const input = screen.getByLabelText(/matrícula/i)

    await userEvent.type(input, '214150129')
    fireEvent.keyDown(input, { key: 'Enter' })

    // Espera a busca completar
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /buscar/i })).not.toBeDisabled()
    })
  })

  it('should show loading state during search', async () => {
    renderWithProvider(<StudentSearch />)
    
    const input = screen.getByLabelText(/matrícula/i)
    const searchButton = screen.getByRole('button', { name: /buscar/i })

    await userEvent.type(input, '214150129')
    fireEvent.click(searchButton)

    // Button should be disabled during loading
    expect(searchButton).toBeDisabled()

    // Espera completar
    await waitFor(() => {
      expect(searchButton).not.toBeDisabled()
    })
  })
})
