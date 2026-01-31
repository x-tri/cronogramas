import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.tsx'
import { initializeRepository, RepositoryProvider } from './data/factory'
import { queryClient } from './lib/query-client'

// Inicializa o repository uma vez na startup
const { repository, mode, error } = initializeRepository()

// Log do modo em uso
console.log(`[App] Repository mode: ${mode}`)
if (error) {
  console.warn('[App] Repository initialization error:', error)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repository={repository} mode={mode}>
        <App />
      </RepositoryProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
