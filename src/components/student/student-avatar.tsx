import { useState } from 'react'

type StudentAvatarProps = {
  nome: string
  matricula: string
  size?: 'sm' | 'md' | 'lg'
}

export function StudentAvatar({ nome, matricula, size = 'md' }: StudentAvatarProps) {
  const [hasError, setHasError] = useState(false)

  const initials = nome
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')

  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-16 h-16 text-xl',
    lg: 'w-24 h-24 text-3xl',
  }

  const photoUrl = `/fotogramas/${matricula}.jpg`

  if (hasError) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-md`}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={photoUrl}
      alt={nome}
      onError={() => setHasError(true)}
      className={`${sizeClasses[size]} rounded-full object-cover shadow-md`}
    />
  )
}
