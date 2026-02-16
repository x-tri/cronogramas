import { AuthProvider, useAuth } from './contexts/auth-context'
import { LoginPage } from './components/auth/login.tsx'
import { AppContent } from './App.tsx'

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  // Simple routing based on auth state
  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <AppContent />
}

export function AppRouter() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
