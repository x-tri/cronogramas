import { useState } from 'react'
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'
import { BlockTypeSelector } from './block-type-selector'
import { DisciplinaSelector } from './disciplina-selector'
import { EnemContentSelector } from './enem-content-selector'
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
  const removeBlock = useCronogramaStore((state) => state.removeBlock)
  const cronograma = useCronogramaStore((state) => state.cronograma)
  const currentStudent = useCronogramaStore((state) => state.currentStudent)
  const createCronograma = useCronogramaStore((state) => state.createCronograma)
  const isSaving = useCronogramaStore((state) => state.isSaving)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [tipo, setTipo] = useState<TipoBloco>(editingBlock?.tipo ?? 'estudo')
  const [descricao, setDescricao] = useState(editingBlock?.descricao ?? '')
  const [disciplinaCodigo, setDisciplinaCodigo] = useState<string | null>(
    editingBlock?.disciplinaCodigo ?? null
  )
  const [enemContent, setEnemContent] = useState<string | null>(null)
  const [prioridade, setPrioridade] = useState<Prioridade>(
    editingBlock?.prioridade ?? 0
  )
  const [error, setError] = useState<string | null>(null)

  // Generate title automatically — ENEM content takes priority over disciplina
  const generateTitle = () => {
    if (enemContent) {
      // If we also have a disciplina, combine: "Disciplina — Conteúdo"
      if (disciplinaCodigo) {
        const disciplina = DISCIPLINAS_BY_CODE.get(disciplinaCodigo)
        if (disciplina) return `${disciplina.nome} — ${enemContent}`
      }
      return enemContent
    }
    if (disciplinaCodigo) {
      const disciplina = DISCIPLINAS_BY_CODE.get(disciplinaCodigo)
      if (disciplina) return disciplina.nome
    }
    return TIPO_BLOCO_LABELS[tipo]
  }

  const ensureCronogramaId = async (): Promise<string> => {
    if (cronograma?.id) return cronograma.id
    if (!currentStudent) throw new Error('Selecione um aluno primeiro')

    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay() + 1)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const newCronograma = await createCronograma(
      currentStudent.id,
      weekStart,
      weekEnd
    )
    return newCronograma.id
  }

  const handleBlock = async () => {
    if (!slot || !currentStudent) {
      setError('Selecione um aluno primeiro')
      return
    }
    setError(null)
    try {
      const cronogramaId = await ensureCronogramaId()
      await addBlock({
        cronogramaId,
        diaSemana: dia,
        turno,
        horarioInicio: slot.inicio,
        horarioFim: slot.fim,
        tipo: 'rotina',       // Uses 'rotina' in DB (constraint-safe), detected as blocked by title
        titulo: 'Bloqueado',
        descricao: null,
        disciplinaCodigo: null,
        cor: null,
        prioridade: 0,
        concluido: false,
      })
      onClose()
    } catch (err) {
      console.error('Failed to block slot:', err)
      setError(err instanceof Error ? err.message : 'Erro ao bloquear horário')
    }
  }

  const handleDelete = async () => {
    if (!editingBlock) return
    setError(null)
    try {
      await removeBlock(editingBlock.id)
      onClose()
    } catch (err) {
      console.error('Failed to delete block:', err)
      setError(err instanceof Error ? err.message : 'Erro ao excluir bloco')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!slot) return
    if (!currentStudent) {
      setError('Selecione um aluno primeiro')
      return
    }

    setError(null)

    try {
      const cronogramaId = await ensureCronogramaId()

      const blockData: Omit<BlocoCronograma, 'id' | 'createdAt'> = {
        cronogramaId,
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
        await updateBlock(editingBlock.id, blockData)
      } else {
        await addBlock(blockData)
      }

      onClose()
    } catch (err) {
      console.error('Failed to save block:', err)
      setError(err instanceof Error ? err.message : 'Erro ao salvar bloco')
    }
  }

  if (!slot) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingBlock ? 'Editar Bloco' : 'Novo Bloco'}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <div className="text-sm text-red-600 text-right">{error}</div>
          )}
          {/* Delete confirmation inline */}
          {showDeleteConfirm ? (
            <div className="flex items-center justify-between gap-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-sm text-red-700 font-medium">Excluir este bloco?</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isSaving}>
                  Não
                </Button>
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Excluindo...' : 'Sim, excluir'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between gap-3">
              {/* Delete button — only when editing an existing block */}
              {editingBlock ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Excluir
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} isLoading={isSaving}>
                  {editingBlock ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </div>
          )}
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

        {/* Quick block button - only when creating, not editing */}
        {!editingBlock && (
          <button
            type="button"
            onClick={handleBlock}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-medium text-sm rounded-lg border border-red-200 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            Bloquear este horário
          </button>
        )}

        {/* Block type */}
        <BlockTypeSelector value={tipo} onChange={setTipo} />

        {/* Disciplina (only for study/review types) */}
        {(tipo === 'estudo' || tipo === 'revisao') && (
          <DisciplinaSelector
            value={disciplinaCodigo}
            onChange={setDisciplinaCodigo}
          />
        )}

        {/* Conteúdo ENEM (only for study/review types) */}
        {(tipo === 'estudo' || tipo === 'revisao') && (
          <EnemContentSelector
            value={enemContent}
            onChange={setEnemContent}
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
