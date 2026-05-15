// CRITICO: polyfill de Buffer precisa rodar ANTES de qualquer import que toque
// @react-pdf/* — layout@4.4.2 chama Buffer.isBuffer no fetchImage sem o browser
// field, o que quebra com "Buffer is not defined" toda vez que uma imagem remota
// é carregada no caderno de questões.
import './polyfills/buffer-shim'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import { AppRouter } from './AppRouter'
import { initializeRepository, RepositoryProvider } from './data/factory'
import { queryClient } from './lib/query-client'
import { clearLegacyAuxiliarySupabaseSessions } from './lib/supabase-session-hygiene'

const CHUNK_RELOAD_STORAGE_KEY = 'xtri:chunk-reload-attempted'

function isChunkLoadError(reason: unknown): boolean {
  const message = reason instanceof Error
    ? reason.message
    : typeof reason === 'string'
      ? reason
      : ''

  return /importing a module script failed|failed to fetch dynamically imported module|loading chunk/i.test(
    message,
  )
}

function reloadOnceAfterChunkFailure(reason: unknown) {
  if (!isChunkLoadError(reason)) return

  if (window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) === '1') {
    return
  }

  window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, '1')
  window.location.reload()
}

window.addEventListener('unhandledrejection', (event) => {
  reloadOnceAfterChunkFailure(event.reason)
})

window.addEventListener('error', (event) => {
  reloadOnceAfterChunkFailure(event.error ?? event.message)
})

// Inicializa o repository uma vez na startup
const { repository, mode, error } = initializeRepository()

// Limpa storage legado de clientes auxiliares que nao devem persistir sessao.
clearLegacyAuxiliarySupabaseSessions()

// Log do modo em uso
console.log(`[App] Repository mode: ${mode}`)
if (error) {
  console.warn('[App] Repository initialization error:', error)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repository={repository} mode={mode}>
        <AppRouter />
      </RepositoryProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
