import { useCronogramaStore } from '../stores/cronograma-store'
import { getWeekBounds } from './week-utils'

function formatWeekRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const startStr = start.toLocaleDateString('pt-BR', options)
  const endStr = end.toLocaleDateString('pt-BR', {
    ...options,
    year: 'numeric',
  })
  return `${startStr} - ${endStr}`
}

function isCurrentWeek(date: Date): boolean {
  const now = new Date()
  const currentWeek = getWeekBounds(now)
  const checkWeek = getWeekBounds(date)
  return currentWeek.start.getTime() === checkWeek.start.getTime()
}

export function WeekSelector() {
  const selectedWeek = useCronogramaStore((state) => state.selectedWeek)
  const setSelectedWeek = useCronogramaStore((state) => state.setSelectedWeek)
  const cronograma = useCronogramaStore((state) => state.cronograma)

  const { start, end } = getWeekBounds(selectedWeek)
  const isCurrent = isCurrentWeek(selectedWeek)

  const goToPreviousWeek = () => {
    const newDate = new Date(selectedWeek)
    newDate.setDate(newDate.getDate() - 7)
    setSelectedWeek(newDate)
  }

  const goToNextWeek = () => {
    const newDate = new Date(selectedWeek)
    newDate.setDate(newDate.getDate() + 7)
    setSelectedWeek(newDate)
  }

  const goToCurrentWeek = () => {
    setSelectedWeek(new Date())
  }

  // Check if cronograma exists for this week
  const hasCronograma = cronograma !== null

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={goToPreviousWeek}
        className="p-1.5 rounded hover:bg-[#f1f1ef] text-[#6b6b67] transition-colors"
        title="Semana anterior"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex items-center gap-2 px-2">
        <div className="text-sm font-medium text-[#37352f] min-w-[140px] text-center">
          {formatWeekRange(start, end)}
        </div>

        {isCurrent && (
          <span className="px-1.5 py-0.5 bg-[#eff6ff] text-[#1d4ed8] text-[10px] font-medium rounded border border-[#bfdbfe]">
            Atual
          </span>
        )}

        {!hasCronograma && (
          <span className="px-1.5 py-0.5 bg-[#fef3c7] text-[#92400e] text-[10px] font-medium rounded border border-[#fcd34d]">
            Novo
          </span>
        )}
      </div>

      <button
        onClick={goToNextWeek}
        className="p-1.5 rounded hover:bg-[#f1f1ef] text-[#6b6b67] transition-colors"
        title="Próxima semana"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!isCurrent && (
        <button
          onClick={goToCurrentWeek}
          className="ml-1 px-2 py-1 text-xs font-medium text-[#37352f] hover:bg-[#f1f1ef] rounded transition-colors"
          title="Ir para semana atual"
        >
          Hoje
        </button>
      )}
    </div>
  )
}
