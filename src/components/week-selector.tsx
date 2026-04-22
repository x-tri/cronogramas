import { useCronogramaStore } from '../stores/cronograma-store'
import { getWeekBounds } from './week-utils'

type WeekSelectorProps = {
  variant?: 'default' | 'compact'
}

function formatWeekRange(start: Date, end: Date): string {
  const d = (dt: Date) => `${dt.getDate()}/${dt.getMonth() + 1}`
  return `${d(start)} – ${d(end)}`
}

function isCurrentWeek(date: Date): boolean {
  const now = new Date()
  const currentWeek = getWeekBounds(now)
  const checkWeek = getWeekBounds(date)
  return currentWeek.start.getTime() === checkWeek.start.getTime()
}

export function WeekSelector({ variant = 'default' }: WeekSelectorProps) {
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
  const isCompact = variant === 'compact'

  if (isCompact) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={goToPreviousWeek}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#475569] transition-colors hover:bg-[#f8fafc]"
          title="Semana anterior"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1">
          <span className="text-xs font-semibold text-[#111827] whitespace-nowrap">
            {formatWeekRange(start, end)}
          </span>
          {isCurrent && (
            <span className="rounded-full bg-[#eff6ff] px-1.5 py-px text-[9px] font-bold text-[#2563eb]">
              Atual
            </span>
          )}
          {!hasCronograma && (
            <span className="rounded-full bg-[#fef3c7] px-1.5 py-px text-[9px] font-bold text-[#92400e]">
              Novo
            </span>
          )}
        </div>

        <button
          onClick={goToNextWeek}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#475569] transition-colors hover:bg-[#f8fafc]"
          title="Próxima semana"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {!isCurrent && (
          <button
            onClick={goToCurrentWeek}
            className="h-7 rounded-lg border border-[#dbe5f3] bg-white px-2 text-[10px] font-bold text-[#2563eb] transition-colors hover:bg-[#f8fbff]"
            title="Ir para semana atual"
          >
            Hoje
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={goToPreviousWeek}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white text-[#475569] transition-colors hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#0f172a]"
        title="Semana anterior"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="min-w-[220px] flex-1 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-[#111827]">
            {formatWeekRange(start, end)}
          </div>

          {isCurrent && (
            <span className="rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
              Atual
            </span>
          )}

          {!hasCronograma && (
            <span className="rounded-full border border-[#fcd34d] bg-[#fef3c7] px-2 py-0.5 text-[10px] font-semibold text-[#92400e]">
              Novo
            </span>
          )}
        </div>

        <p className="mt-1 text-xs text-[#64748b]">
          {isCurrent
            ? 'Semana em andamento para o aluno selecionado.'
            : 'Use as setas para revisar semanas anteriores ou futuras.'}
        </p>
      </div>

      <button
        onClick={goToNextWeek}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white text-[#475569] transition-colors hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#0f172a]"
        title="Próxima semana"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!isCurrent && (
        <button
          onClick={goToCurrentWeek}
          className="inline-flex h-11 items-center rounded-2xl border border-[#dbe5f3] bg-white px-3.5 text-xs font-semibold text-[#1d4ed8] transition-colors hover:border-[#bfdbfe] hover:bg-[#f8fbff]"
          title="Ir para semana atual"
        >
          Ir para atual
        </button>
      )}
    </div>
  )
}
