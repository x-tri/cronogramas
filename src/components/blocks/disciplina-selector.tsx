import { DISCIPLINAS_BY_AREA } from '../../data/mock-data/subjects'
import type { AreaEnem } from '../../types/domain'
import { CORES_AREAS } from '../../constants/colors'

type DisciplinaSelectorProps = {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
}

const AREA_LABELS: Record<AreaEnem, string> = {
  natureza: 'Ciências da Natureza',
  matematica: 'Matemática',
  linguagens: 'Linguagens',
  humanas: 'Ciências Humanas',
  outros: 'Outros',
}

const AREAS_ORDER: AreaEnem[] = [
  'natureza',
  'matematica',
  'linguagens',
  'humanas',
  'outros',
]

export function DisciplinaSelector({
  value,
  onChange,
  disabled,
}: DisciplinaSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Disciplina (opcional)
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border border-gray-300 rounded-lg
          text-gray-900 bg-white
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <option value="">Nenhuma disciplina</option>
        {AREAS_ORDER.map((area) => {
          const disciplinas = DISCIPLINAS_BY_AREA[area]
          if (!disciplinas?.length) return null
          return (
            <optgroup key={area} label={AREA_LABELS[area]}>
              {disciplinas.map((d) => (
                <option key={d.codigo} value={d.codigo}>
                  {d.nome} - {d.professor}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>

      {/* Color preview */}
      {value && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div
            className="w-4 h-4 rounded"
            style={{
              backgroundColor: (() => {
                for (const area of AREAS_ORDER) {
                  const found = DISCIPLINAS_BY_AREA[area]?.find(
                    (d) => d.codigo === value
                  )
                  if (found) return CORES_AREAS[area]
                }
                return '#6B7280'
              })(),
            }}
          />
          <span>Cor baseada na área do ENEM</span>
        </div>
      )}
    </div>
  )
}
