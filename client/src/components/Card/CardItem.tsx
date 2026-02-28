import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { OptimisticCard } from '../../types'

interface CardItemProps {
  card: OptimisticCard
  onUpdate: (cardId: number, updates: { title?: string; description?: string }) => void
  onDelete: () => void
}

export default function CardItem({ card, onUpdate, onDelete }: CardItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(card.title)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `card-${card.id}`,
    data: { type: 'card', card }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleSave = () => {
    if (editTitle.trim() && editTitle !== card.title) {
      onUpdate(card.id, { title: editTitle.trim() })
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setEditTitle(card.title)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-md border border-gray-200 dark:border-gray-700"
      >
        <textarea
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          autoFocus
          rows={3}
          className="w-full border-none outline-none text-sm resize-none bg-transparent text-gray-900 dark:text-white focus:ring-0"
        />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700 transition-all ${
        isDragging 
          ? 'opacity-50 shadow-2xl cursor-grabbing' 
          : card.isOptimistic 
          ? 'opacity-60' 
          : 'hover:shadow-md cursor-grab'
      }`}
      {...attributes}
      {...listeners}
    >
      <div
        onClick={(e) => {
          if (!isDragging) {
            setIsEditing(true)
          }
        }}
        className="text-sm text-gray-900 dark:text-white leading-relaxed pr-6"
      >
        {card.title}
        {card.isOptimistic && (
          <span className="block text-xs text-gray-500 dark:text-gray-400 italic mt-1">
            Saving...
          </span>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (confirm('Delete this card?')) {
            onDelete()
          }
        }}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity text-xs"
      >
        ×
      </button>

      {card.description && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          {card.description}
        </div>
      )}

      {card.createdByName && (
        <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          {card.createdByName}
        </div>
      )}
    </div>
  )
}