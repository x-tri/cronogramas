import { useState, useMemo } from 'react'
import { ENEM_AREAS, EXTRA_ACTIVITIES } from '../../constants/enem-subjects'

type EnemContentSelectorProps = {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
}

const AREA_COLORS: Record<string, string> = {
  'Linguagens': '#3b82f6',
  'Ciências Humanas': '#f97316',
  'Matemática': '#ef4444',
  'Ciências da Natureza': '#10b981',
}

export function EnemContentSelector({ value, onChange, disabled }: EnemContentSelectorProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Flatten all options for search
  const allOptions = useMemo(() => {
    const options: { label: string; area: string; subject: string; type: 'topic' | 'extra' }[] = []

    for (const area of ENEM_AREAS) {
      for (const subject of area.subjects) {
        for (const topic of subject.topics) {
          options.push({
            label: topic.label,
            area: area.label,
            subject: subject.label,
            type: 'topic',
          })
        }
      }
    }

    for (const activity of EXTRA_ACTIVITIES) {
      options.push({
        label: activity,
        area: 'Atividades',
        subject: 'Extra',
        type: 'extra',
      })
    }

    return options
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return null // show grouped view when no search
    const q = search.toLowerCase()
    return allOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.subject.toLowerCase().includes(q) ||
        o.area.toLowerCase().includes(q)
    )
  }, [search, allOptions])

  const handleSelect = (label: string) => {
    onChange(label)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = () => {
    onChange(null)
    setSearch('')
  }

  // Find current selection info
  const selectedInfo = useMemo(() => {
    if (!value) return null
    const found = allOptions.find((o) => o.label === value)
    return found || { label: value, area: '', subject: '', type: 'topic' as const }
  }, [value, allOptions])

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        Conteúdo ENEM
      </label>

      <div className="relative">
        {/* Selected value display / trigger */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full px-3 py-2 border rounded-lg text-left text-sm
            transition-colors flex items-center justify-between gap-2
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white hover:border-gray-400 cursor-pointer'}
            ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-300'}
          `}
        >
          {selectedInfo ? (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: AREA_COLORS[selectedInfo.area] || '#8b5cf6' }}
              />
              <span className="truncate text-gray-900">{selectedInfo.label}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{selectedInfo.subject}</span>
            </div>
          ) : (
            <span className="text-gray-400">Selecione o conteúdo...</span>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            {value && (
              <span
                onClick={(e) => { e.stopPropagation(); handleClear() }}
                className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => { setIsOpen(false); setSearch('') }} />
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 flex flex-col overflow-hidden">
              {/* Search input */}
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar conteúdo..."
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20"
                  />
                </div>
              </div>

              {/* Options list */}
              <div className="overflow-y-auto flex-1">
                {filtered ? (
                  // Search results
                  filtered.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      Nenhum conteúdo encontrado
                    </div>
                  ) : (
                    <div className="py-1">
                      {filtered.map((opt, i) => (
                        <button
                          key={`${opt.area}-${opt.subject}-${opt.label}-${i}`}
                          type="button"
                          onClick={() => handleSelect(opt.label)}
                          className={`
                            w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors
                            ${value === opt.label ? 'bg-blue-50' : ''}
                          `}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: AREA_COLORS[opt.area] || '#8b5cf6' }}
                          />
                          <span className="flex-1 text-gray-900">{opt.label}</span>
                          <span className="text-[10px] text-gray-400">{opt.subject}</span>
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  // Grouped view (no search)
                  <div className="py-1">
                    {ENEM_AREAS.map((area) => (
                      <div key={area.label}>
                        {/* Area header */}
                        <div
                          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 sticky top-0 bg-gray-50 border-b border-gray-100"
                          style={{ color: AREA_COLORS[area.label] || '#6b7280' }}
                        >
                          <span
                            className="w-2 h-2 rounded-sm"
                            style={{ backgroundColor: AREA_COLORS[area.label] || '#6b7280' }}
                          />
                          {area.label}
                        </div>

                        {area.subjects.map((subject) => (
                          <div key={subject.label}>
                            {/* Subject sub-header */}
                            <div className="px-3 py-1 text-[11px] font-semibold text-gray-500 bg-white">
                              {subject.label}
                            </div>
                            {subject.topics.map((topic) => (
                              <button
                                key={topic.label}
                                type="button"
                                onClick={() => handleSelect(topic.label)}
                                className={`
                                  w-full px-3 pl-6 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors
                                  ${value === topic.label ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                                `}
                              >
                                <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                                {topic.label}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Extra activities */}
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-600 flex items-center gap-2 sticky top-0 bg-gray-50 border-b border-gray-100">
                        <span className="w-2 h-2 rounded-sm bg-purple-500" />
                        Atividades Extras
                      </div>
                      {EXTRA_ACTIVITIES.map((activity) => (
                        <button
                          key={activity}
                          type="button"
                          onClick={() => handleSelect(activity)}
                          className={`
                            w-full px-3 pl-6 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors
                            ${value === activity ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                          `}
                        >
                          <span className="w-1 h-1 rounded-full bg-purple-300 flex-shrink-0" />
                          {activity}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
