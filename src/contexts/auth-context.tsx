import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

// Tipos
export type User = {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
}

export type AuthContextType = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

// Usuários fixos do sistema
const VALID_USERS = [
  {
    id: 'user-001',
    email: 'XTRIMARISTA1',
    password: 'M@rist@2026',
    name: 'Usuário XTRI 1',
    role: 'user' as const,
  },
  {
    id: 'user-002',
    email: 'XTRIMARISTA2',
    password: 'M@rist@2026',
    name: 'Usuário XTRI 2',
    role: 'user' as const,
  },
]

// Chave do localStorage
const STORAGE_KEY = '@xtri-cronogramas:auth'

// Contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Verificar se já existe sessão ao carregar
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.user && parsed.expiresAt > Date.now()) {
          setUser(parsed.user)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Normalizar email (remover espaços e converter para maiúsculo)
    const normalizedEmail = email.trim().toUpperCase()
    
    // Buscar usuário
    const foundUser = VALID_USERS.find(
      (u) => u.email === normalizedEmail && u.password === password
    )

    if (!foundUser) {
      return { success: false, error: 'Email ou senha incorretos' }
    }

    // Criar sessão (válida por 8 horas)
    const session = {
      user: {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        role: foundUser.role,
      } as User,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 horas
    }

    // Salvar no localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    setUser(session.user)

    return { success: true }
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Hook personalizado
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
