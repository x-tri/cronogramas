import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../lib/query-client'
import { supabase } from '../lib/supabase'

export interface SchoolOption {
  id: string
  name: string
}

/**
 * Lista de escolas para selects/filtros do admin — fonte única (antes havia
 * 7 cópias da query `from('schools').select('id, name').order('name')` em
 * componentes, cada uma com seu próprio useState/useEffect).
 *
 * - `userSchoolId`: coordenador escopado vê só a própria escola.
 * - `enabled: false`: pula o fetch (ex.: tela que nem mostra o filtro
 *   quando o usuário é escopado).
 *
 * Cacheado via react-query: abrir várias telas do admin não refaz o fetch.
 */
export function useSchools(
  options: { userSchoolId?: string | null; enabled?: boolean } = {},
): { schools: SchoolOption[]; loading: boolean } {
  const { userSchoolId = null, enabled = true } = options

  const query = useQuery({
    queryKey: queryKeys.schools.list(userSchoolId),
    queryFn: async (): Promise<SchoolOption[]> => {
      let schoolsQuery = supabase.from('schools').select('id, name').order('name')
      if (userSchoolId) schoolsQuery = schoolsQuery.eq('id', userSchoolId)
      const { data, error } = await schoolsQuery
      if (error) throw error
      return (data ?? []) as SchoolOption[]
    },
    enabled,
    staleTime: 10 * 60 * 1000, // escolas raramente mudam
  })

  return { schools: query.data ?? [], loading: enabled && query.isLoading }
}
