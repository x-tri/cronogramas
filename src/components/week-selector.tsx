import { useCronogramaStore } from '../stores/cronograma-store'

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  const day = start.getDay()
  // Move to Monday (day 1). If Sunday (0), go back 6 days
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

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
    <div className="flex items-center gap-2">
      <button
        onClick={goToPreviousWeek}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        title="Semana anterior"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-gray-700 min-w-[160px] text-center">
          {formatWeekRange(start, end)}
        </div>

        {isCurrent && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            Atual
          </span>
        )}

        {!hasCronograma && (
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
            Sem cronograma
          </span>
        )}
      </div>

      <button
        onClick={goToNextWeek}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        title="Próxima semana"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!isCurrent && (
        <button
          onClick={goToCurrentWeek}
          className="ml-2 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Ir para semana atual"
        >
          Hoje
        </button>
      )}
    </div>
  )
}

export { getWeekBounds }
