import { useAuth } from '../../contexts/auth-context'
import { LoginPage } from './login'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[#37352f] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">Verificando sessão...</span>
        </div>
      </div>
    )
  }

  // Se não estiver autenticado, mostrar login
  if (!isAuthenticated) {
    return <LoginPage />
  }

  // Se estiver autenticado, mostrar conteúdo
  return <>{children}</>
}
