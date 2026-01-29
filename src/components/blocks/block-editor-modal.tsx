import { useState } from 'react'
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'
import { BlockTypeSelector } from './block-type-selector'
import { DisciplinaSelector } from './disciplina-selector'
import type {
  BlocoCronograma,
  DiaSemana,
  Prioridade,
  TipoBloco,
  Turno,
} from '../../types/domain'
import { DIAS_SEMANA_LABELS, TURNO_LABELS, PRIORIDADE_LABELS, TIPO_BLOCO_LABELS } from '../../types/domain'
import { getSlotByIndex } from '../../constants/time-slots'
import { useCronogramaStore } from '../../stores/cronograma-store'
import { DISCIPLINAS_BY_CODE } from '../../data/mock-data/subjects'

type BlockEditorModalProps = {
  isOpen: boolean
  onClose: () => void
  dia: DiaSemana
  turno: Turno
  slotIndex: number
  editingBlock?: BlocoCronograma
}

export function BlockEditorModal({
  isOpen,
  onClose,
  dia,
  turno,
  slotIndex,
  editingBlock,
}: BlockEditorModalProps) {
  const slot = getSlotByIndex(turno, slotIndex)
  const addBlock = useCronogramaStore((state) => state.addBlock)
  const updateBlock = useCronogramaStore((state) => state.updateBlock)
  const cronograma = useCronogramaStore((state) => state.cronograma)

  const [tipo, setTipo] = useState<TipoBloco>(editingBlock?.tipo ?? 'estudo')
  const [descricao, setDescricao] = useState(editingBlock?.descricao ?? '')
  const [disciplinaCodigo, setDisciplinaCodigo] = useState<string | null>(
    editingBlock?.disciplinaCodigo ?? null
  )
  const [prioridade, setPrioridade] = useState<Prioridade>(
    editingBlock?.prioridade ?? 0
  )

  // Generate title automatically
  const generateTitle = () => {
    if (disciplinaCodigo) {
      const disciplina = DISCIPLINAS_BY_CODE.get(disciplinaCodigo)
      if (disciplina) return disciplina.nome
    }
    return TIPO_BLOCO_LABELS[tipo]
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!slot) return

    const blockData: Omit<BlocoCronograma, 'id' | 'createdAt'> = {
      cronogramaId: cronograma?.id ?? 'temp',
      diaSemana: dia,
      turno,
      horarioInicio: slot.inicio,
      horarioFim: slot.fim,
      tipo,
      titulo: generateTitle(),
      descricao: descricao.trim() || null,
      disciplinaCodigo,
      cor: null,
      prioridade,
      concluido: editingBlock?.concluido ?? false,
    }

    if (editingBlock) {
      updateBlock(editingBlock.id, blockData)
    } else {
      addBlock({
        ...blockData,
        id: `block-${Date.now()}`,
        createdAt: new Date(),
      })
    }

    onClose()
  }

  if (!slot) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingBlock ? 'Editar Bloco' : 'Novo Bloco'}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {editingBlock ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Slot info */}
        <div className="p-3 bg-gray-50 rounded-lg text-sm">
          <div className="font-medium text-gray-900">
            {DIAS_SEMANA_LABELS[dia]} - {TURNO_LABELS[turno]}
          </div>
          <div className="text-gray-500">
            {slot.inicio} - {slot.fim}
          </div>
        </div>

        {/* Block type */}
        <BlockTypeSelector value={tipo} onChange={setTipo} />

        {/* Disciplina (only for study/review types) */}
        {(tipo === 'estudo' || tipo === 'revisao') && (
          <DisciplinaSelector
            value={disciplinaCodigo}
            onChange={setDisciplinaCodigo}
          />
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descrição (opcional)
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes sobre a atividade..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Prioridade
          </label>
          <div className="flex gap-2">
            {([0, 1, 2] as Prioridade[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrioridade(p)}
                className={`
                  flex-1 py-2 px-3 rounded-lg border text-sm
                  transition-all duration-150
                  ${
                    prioridade === p
                      ? 'border-2 border-blue-500 bg-blue-50 font-medium'
                      : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                {PRIORIDADE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}
