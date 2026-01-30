import { useState } from 'react'
import { Button } from '../ui/button'
import { analyzeStudentSimulado } from '../../services/simulado-analyzer'
import type { SimuladoResult, TopicSummary } from '../../types/supabase'
import type { BlocoCronograma, DiaSemana, Turno } from '../../types/domain'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { DIAS_SEMANA, TURNOS } from '../../types/domain'
import { TURNOS_CONFIG } from '../../constants/time-slots'
import { getColorFromQuestionNumber } from '../../constants/colors'

type SimuladoAnalyzerProps = {
  matricula: string
}

export function SimuladoAnalyzer({ matricula }: SimuladoAnalyzerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<SimuladoResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const blocks = useCronogramaStore((state) => state.blocks)
  const officialSchedule = useCronogramaStore((state) => state.officialSchedule)
  const addBlock = useCronogramaStore((state) => state.addBlock)
  const cronograma = useCronogramaStore((state) => state.cronograma)
  const currentStudent = useCronogramaStore((state) => state.currentStudent)
  const createCronograma = useCronogramaStore((state) => state.createCronograma)

  const handleAnalyze = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await analyzeStudentSimulado(matricula)
      if (data) {
        setResult(data)
      } else {
        setError('Nenhum simulado encontrado para este aluno')
      }
    } catch (err) {
      setError('Erro ao analisar simulado')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const getAvailableSlots = (): Array<{
    dia: DiaSemana
    turno: Turno
    slotIndex: number
    inicio: string
    fim: string
  }> => {
    const available: Array<{
      dia: DiaSemana
      turno: Turno
      slotIndex: number
      inicio: string
      fim: string
    }> = []

    for (const dia of DIAS_SEMANA) {
      for (const turno of TURNOS) {
        const slots = TURNOS_CONFIG[turno].slots

        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i]

          // Check if slot is occupied by official schedule
          const isOfficial = officialSchedule.some(
            (h) =>
              h.diaSemana === dia &&
              h.turno === turno &&
              h.horarioInicio === slot.inicio
          )

          // Check if slot already has a block
          const hasBlock = blocks.some(
            (b) =>
              b.diaSemana === dia &&
              b.turno === turno &&
              b.horarioInicio === slot.inicio
          )

          if (!isOfficial && !hasBlock) {
            available.push({
              dia,
              turno,
              slotIndex: i,
              inicio: slot.inicio,
              fim: slot.fim,
            })
          }
        }
      }
    }

    return available
  }

  const handleDistribute = async () => {
    if (!result || !currentStudent) return

    try {
      // Ensure cronograma exists
      let activeCronograma = cronograma
      if (!activeCronograma) {
        const today = new Date()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay() + 1)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)

        activeCronograma = await createCronograma(
          currentStudent.id,
          weekStart,
          weekEnd
        )
      }

      const availableSlots = getAvailableSlots()
      const topicsToDistribute = result.topicsSummary.slice(
        0,
        availableSlots.length
      )

      for (let index = 0; index < topicsToDistribute.length; index++) {
        const topic = topicsToDistribute[index]
        const slot = availableSlots[index]
        if (!slot) continue

        // Get color based on question number (Q1-45: LC, Q46-90: CH, Q91-135: CN, Q136-180: MT)
        const firstQuestion = topic.questions[0] ?? 1
        const areaColor = getColorFromQuestionNumber(firstQuestion)

        const blockData: Omit<BlocoCronograma, 'id' | 'createdAt'> = {
          cronogramaId: activeCronograma.id,
          diaSemana: slot.dia,
          turno: slot.turno,
          horarioInicio: slot.inicio,
          horarioFim: slot.fim,
          tipo: 'revisao',
          titulo: topic.topic,
          descricao: `${topic.count} erro${topic.count > 1 ? 's' : ''} neste tópico (Q${topic.questions.join(', Q')})`,
          disciplinaCodigo: null,
          cor: areaColor,
          prioridade: topic.count >= 3 ? 2 : topic.count >= 2 ? 1 : 0,
          concluido: false,
        }

        await addBlock(blockData)
      }

      setResult(null)
    } catch (err) {
      console.error('Failed to distribute blocks:', err)
      setError('Erro ao distribuir blocos')
    }
  }

  if (!result) {
    return (
      <div className="flex items-center gap-3">
        <Button
          onClick={handleAnalyze}
          isLoading={isLoading}
          variant="secondary"
          size="sm"
        >
          Analisar Simulado
        </Button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            {result.exam.title}
          </h3>
          <p className="text-sm text-gray-500">
            {result.studentAnswer.correct_answers} acertos •{' '}
            {result.studentAnswer.wrong_answers} erros •{' '}
            {result.studentAnswer.blank_answers} em branco
          </p>
        </div>
        <button
          onClick={() => setResult(null)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-4 gap-2">
        <ScoreBar label="LC" value={result.studentAnswer.tri_lc} />
        <ScoreBar label="CH" value={result.studentAnswer.tri_ch} />
        <ScoreBar label="CN" value={result.studentAnswer.tri_cn} />
        <ScoreBar label="MT" value={result.studentAnswer.tri_mt} />
      </div>

      {/* Topics to review */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Tópicos para revisar ({result.topicsSummary.length})
        </h4>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {result.topicsSummary.map((topic, i) => (
            <TopicItem key={i} topic={topic} />
          ))}
        </div>
      </div>

      {/* Distribute button */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button variant="secondary" onClick={() => setResult(null)}>
          Cancelar
        </Button>
        <Button onClick={handleDistribute}>
          Distribuir {result.topicsSummary.length} Tópicos
        </Button>
      </div>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const score = value ?? 0
  const percentage = Math.min(100, Math.max(0, (score - 300) / 5)) // Scale 300-800 to 0-100

  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs font-medium mt-1">{score.toFixed(0)}</div>
    </div>
  )
}

function TopicItem({ topic }: { topic: TopicSummary }) {
  return (
    <div className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-sm">
      <span className="truncate flex-1" title={topic.topic}>
        {topic.topic}
      </span>
      <span
        className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
          topic.count >= 3
            ? 'bg-red-100 text-red-700'
            : topic.count >= 2
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-600'
        }`}
      >
        {topic.count}
      </span>
    </div>
  )
}
