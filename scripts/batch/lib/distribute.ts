/**
 * Distribuição dos tópicos deduplicados em slots disponíveis da semana.
 *
 * Estratégia (Karpathy #2 — simplest):
 *   - Tópicos ordenados por errorCount DESC (mais erros = prioridade maior)
 *   - Slots ordenados pelo builder (seg→dom; manhã→tarde→noite)
 *   - Atribuição posicional: tópico i ocupa slot i
 *   - Se topicos.length > slots.length: warn + descarta o excedente
 *   - Se topicos.length <= slots.length: slots restantes ficam vazios
 */

import type { DedupedTopic } from './topic-extraction'
import { areaForQuestion } from './topic-extraction'
import type { SlotRef } from './slot-builder'

export interface ScheduledBlock {
  readonly diaSemana: SlotRef['diaSemana']
  readonly turno: SlotRef['turno']
  readonly horarioInicio: string
  readonly horarioFim: string
  readonly titulo: string
  readonly descricao: string
  readonly area: 'LC' | 'CH' | 'CN' | 'MT'
  readonly cor: string
  /** Maior = mais prioritário. Refletivo do errorCount mas truncado a 0/1/2 do schema. */
  readonly prioridade: 0 | 1 | 2
  readonly questionNumbers: readonly number[]
}

/**
 * Cor por área ENEM — fonte única (replicado de src/constants/colors.ts).
 */
const AREA_COLOR: Record<'LC' | 'CH' | 'CN' | 'MT', string> = {
  LC: '#3B82F6',
  CH: '#F97316',
  CN: '#10B981',
  MT: '#EF4444',
}

export function distributeTopicsToSlots(
  topics: readonly DedupedTopic[],
  slots: readonly SlotRef[],
): { scheduled: ScheduledBlock[]; dropped: DedupedTopic[] } {
  // Ordena por errorCount DESC, depois alfabeticamente para estabilidade
  const sorted = [...topics].sort((a, b) => {
    if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount
    return a.topicDisplay.localeCompare(b.topicDisplay)
  })

  const scheduled: ScheduledBlock[] = []
  const limit = Math.min(sorted.length, slots.length)

  for (let i = 0; i < limit; i++) {
    const topic = sorted[i]
    const slot = slots[i]
    // Área pela primeira questão (todos do mesmo tópico estão no mesmo range)
    const area = areaForQuestion(topic.questionNumbers[0])

    scheduled.push({
      diaSemana: slot.diaSemana,
      turno: slot.turno,
      horarioInicio: slot.horarioInicio,
      horarioFim: slot.horarioFim,
      titulo: topic.topicDisplay,
      descricao: `Revisão por erros no simulado · Questões ${topic.questionNumbers
        .map((q) => `Q${q}`)
        .join(', ')}`,
      area,
      cor: AREA_COLOR[area],
      prioridade: topic.errorCount >= 3 ? 2 : topic.errorCount >= 2 ? 1 : 0,
      questionNumbers: topic.questionNumbers,
    })
  }

  const dropped = sorted.slice(limit)
  return { scheduled, dropped }
}
