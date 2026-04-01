import { enemDataSupabase, isDedicatedEnemDataSupabaseConfigured } from '../lib/enem-data-supabase'
import type { EnemPlanArea } from '../data/enem/base-historica-enem-2009-2025'
import type { PrioritizedTopic } from './enem-priority'

export type EnemSkillInsight = {
  area: EnemPlanArea
  numeroHabilidade: number
  identificador: string
  descricao: string
  itemCount: number | null
}

type EnemSkillRow = {
  area: 'CH' | 'CN' | 'LC' | 'MT'
  numero_habilidade: number
  descricao: string
  identificador: string
}

const skillCatalogCache = new Map<string, Promise<EnemSkillRow[]>>()
const itemCountCache = new Map<string, Promise<number | null>>()

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueTokens(value: string): string[] {
  return [...new Set(normalizeText(value).split(' ').filter((token) => token.length > 2))]
}

function toAreaCode(area: EnemPlanArea): 'CH' | 'CN' | 'LC' | 'MT' {
  switch (area) {
    case 'ch':
      return 'CH'
    case 'cn':
      return 'CN'
    case 'lc':
      return 'LC'
    case 'mt':
      return 'MT'
  }
}

async function getSkillCatalog(area: EnemPlanArea): Promise<EnemSkillRow[]> {
  const areaCode = toAreaCode(area)

  if (!skillCatalogCache.has(areaCode)) {
    skillCatalogCache.set(areaCode, (async () => {
      const { data, error } = await enemDataSupabase
        .from('enem_habilidades')
        .select('area, numero_habilidade, descricao, identificador')
        .eq('area', areaCode)
        .order('numero_habilidade', { ascending: true })

      if (error) {
        throw error
      }

      return (data ?? []) as EnemSkillRow[]
    })())
  }

  return skillCatalogCache.get(areaCode)!
}

async function getItemCount(area: EnemPlanArea, numeroHabilidade: number): Promise<number | null> {
  const areaCode = toAreaCode(area)
  const cacheKey = `${areaCode}:${numeroHabilidade}`

  if (!itemCountCache.has(cacheKey)) {
    itemCountCache.set(cacheKey, (async () => {
      const { count, error } = await enemDataSupabase
        .from('enem_itens')
        .select('*', { count: 'exact', head: true })
        .eq('area', areaCode)
        .eq('numero_habilidade', numeroHabilidade)

      if (error) {
        throw error
      }

      return count ?? null
    })())
  }

  return itemCountCache.get(cacheKey)!
}

function resolveBestSkill(topic: PrioritizedTopic, skills: EnemSkillRow[]): EnemSkillRow | null {
  const topicTokens = uniqueTokens([
    topic.displayLabel,
    topic.matchedHistoricalTopic ?? '',
    topic.areaLabel,
  ].join(' '))

  let bestMatch: EnemSkillRow | null = null
  let bestScore = 0

  for (const skill of skills) {
    const descriptionTokens = uniqueTokens(skill.descricao)
    const overlap = topicTokens.filter((token) => descriptionTokens.includes(token)).length

    if (overlap === 0) {
      continue
    }

    const score = overlap * 10
    if (score > bestScore) {
      bestScore = score
      bestMatch = skill
    }
  }

  return bestMatch
}

export async function getEnemSkillInsights(
  prioritizedTopics: PrioritizedTopic[],
): Promise<Map<string, EnemSkillInsight>> {
  const insights = new Map<string, EnemSkillInsight>()

  if (!isDedicatedEnemDataSupabaseConfigured() || prioritizedTopics.length === 0) {
    return insights
  }

  try {
    const areas = [...new Set(prioritizedTopics.map((topic) => topic.area))]
    const skillsByArea = new Map<EnemPlanArea, EnemSkillRow[]>()

    await Promise.all(
      areas.map(async (area) => {
        skillsByArea.set(area, await getSkillCatalog(area))
      }),
    )

    await Promise.all(
      prioritizedTopics.map(async (topic) => {
        const areaSkills = skillsByArea.get(topic.area) ?? []
        const bestSkill = resolveBestSkill(topic, areaSkills)

        if (!bestSkill) {
          return
        }

        const itemCount = await getItemCount(topic.area, bestSkill.numero_habilidade)
        insights.set(`${topic.area}:${topic.displayLabel}`, {
          area: topic.area,
          numeroHabilidade: bestSkill.numero_habilidade,
          identificador: bestSkill.identificador,
          descricao: bestSkill.descricao,
          itemCount,
        })
      }),
    )
  } catch (error) {
    console.warn('[ENEM DATA] Falha ao carregar habilidades ENEM:', error)
  }

  return insights
}
