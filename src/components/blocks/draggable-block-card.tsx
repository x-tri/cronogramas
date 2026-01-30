import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { BlocoCronograma } from '../../types/domain'
import { BlockCard } from './block-card'

type DraggableBlockCardProps = {
  block: BlocoCronograma
  onEdit?: () => void
  onDelete?: () => void
  onChangePriority?: (newPriority: 0 | 1 | 2) => void
  onToggleComplete?: () => void
}

export function DraggableBlockCard({
  block,
  onEdit,
  onDelete,
  onChangePriority,
  onToggleComplete,
}: DraggableBlockCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
  })

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined

  return (
    <div ref={setNodeRef} style={style}>
      <BlockCard
        block={block}
        onEdit={onEdit}
        onDelete={onDelete}
        onChangePriority={onChangePriority}
        onToggleComplete={onToggleComplete}
        isDragging={isDragging}
        dragHandleProps={{ ...listeners, ...attributes }}
      />
    </div>
  )
}
