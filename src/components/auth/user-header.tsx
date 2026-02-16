import { useAuth } from '../../contexts/auth-context'

export function UserHeader() {
  const { user, logout, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      {/* Avatar com iniciais */}
      <div className="flex items-center justify-center w-7 h-7 bg-[#2eaadc] text-white text-xs font-medium rounded-full">
        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      
      {/* Nome do usuário */}
      <span className="text-sm text-[#37352f]">
        {user.name}
      </span>

      {/* Botão logout */}
      <button
        onClick={logout}
        className="text-xs text-[#6b6b67] hover:text-[#37352f] transition-colors"
        title="Sair"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  )
}
