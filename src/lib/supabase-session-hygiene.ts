import { QUESTION_BANK_PROJECT_REF } from './question-bank-supabase'

const AUXILIARY_PROJECT_REFS = [
  QUESTION_BANK_PROJECT_REF,
  'qgqliquusdkkwnfuzdwi',
]

function parseSupabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null

  try {
    return new URL(url).hostname.split('.')[0] ?? null
  } catch {
    return null
  }
}

export function clearLegacyAuxiliarySupabaseSessions(): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return
  }

  const dedicatedProjectRef = parseSupabaseProjectRef(
    import.meta.env.VITE_SIMULADO_SUPABASE_URL,
  )
  const primaryProjectRef = parseSupabaseProjectRef(import.meta.env.VITE_SUPABASE_URL)
  const refs = new Set(AUXILIARY_PROJECT_REFS)

  if (dedicatedProjectRef && dedicatedProjectRef !== primaryProjectRef) {
    refs.add(dedicatedProjectRef)
  }

  for (const ref of refs) {
    window.localStorage.removeItem(`sb-${ref}-auth-token`)
    window.sessionStorage.removeItem(`sb-${ref}-auth-token`)
  }
}
