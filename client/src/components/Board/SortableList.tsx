import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

interface SortableListProps {
  id: string
  children: (dragHandleProps: React.HTMLAttributes<HTMLElement>) => ReactNode
}

/**
 * Wraps a list column with sortable drag-and-drop.
 * Passes drag handle props to children via render prop —
 * children decide which element (e.g. the header) initiates the drag.
 */
export default function SortableList({ id, children }: SortableListProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'list' },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 999 : undefined,
      }}
      className="flex-shrink-0 h-full"
    >
      {children({ ...attributes, ...listeners })}
    </div>
  )
}