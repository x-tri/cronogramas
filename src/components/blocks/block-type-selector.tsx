import type { TipoBloco } from '../../types/domain'
import { CORES_TIPOS } from '../../constants/colors'

type BlockTypeSelectorProps = {
  value: TipoBloco
  onChange: (value: TipoBloco) => void
  disabled?: boolean
}

const DROPDOWN_OPTIONS: { value: TipoBloco; label: string }[] = [
  { value: 'estudo', label: 'Estudar' },
  { value: 'revisao', label: 'Revisar' },
  { value: 'simulado', label: 'Corrigir' },
]

export function BlockTypeSelector({
  value,
  onChange,
  disabled,
}: BlockTypeSelectorProps) {
  const selectedColor = CORES_TIPOS[value] ?? CORES_TIPOS.estudo

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Tipo de Atividade
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as TipoBloco)}
          disabled={disabled}
          className={`
            w-full px-3 py-2 pl-8
            border border-gray-300 rounded-lg
            text-gray-900 bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {DROPDOWN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Color indicator */}
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none"
          style={{ backgroundColor: selectedColor }}
        />
      </div>
    </div>
  )
}
