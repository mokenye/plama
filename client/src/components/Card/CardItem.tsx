import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { OptimisticCard } from '../../types'
import CardDetailsModal from './CardDetailsModal'

interface CardItemProps {
  card: OptimisticCard
  boardMembers: { id: number; name: string; email: string }[]
  onUpdate: (cardId: number, updates: { title?: string; description?: string }) => void
  onDelete: () => void
}

export default function CardItem({ card, boardMembers, onUpdate, onDelete }: CardItemProps) {
  const [showModal, setShowModal] = useState(false)

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

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onClick={() => {
          if (!isDragging) {
            setShowModal(true)
          }
        }}
        className={`group relative bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700 transition-all ${
          isDragging 
            ? 'opacity-50 shadow-2xl cursor-grabbing' 
            : card.isOptimistic 
            ? 'opacity-60' 
            : 'hover:shadow-md cursor-pointer'
        }`}
        {...attributes}
        {...listeners}
      >
        {/* Labels */}
        {card.labels && card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {card.labels.map((label) => (
              <span
                key={label}
                className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="text-sm text-gray-900 dark:text-white leading-relaxed pr-6 break-words overflow-wrap-anywhere">
          {card.title}
          {card.isOptimistic && (
            <span className="block text-xs text-gray-500 dark:text-gray-400 italic mt-1">
              Saving...
            </span>
          )}
        </div>

        {/* Due Date */}
        {card.dueDate && (
          <div className={`text-xs mt-2 flex items-center gap-1 ${
            new Date(card.dueDate) < new Date() 
              ? 'text-red-600 dark:text-red-400 font-medium' 
              : 'text-gray-600 dark:text-gray-400'
          }`}>
            📅 {new Date(card.dueDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
            {new Date(card.dueDate) < new Date() && <span className="text-xs">⚠️</span>}
          </div>
        )}

        {/* Assignees */}
        {card.assignees && card.assignees.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            {card.assignees.slice(0, 3).map((assigneeId) => {
              const member = boardMembers.find(m => m.id === assigneeId)
              if (!member) return null
              return (
                <div
                  key={assigneeId}
                  className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold"
                  title={member.name}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )
            })}
            {card.assignees.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-bold">
                +{card.assignees.length - 3}
              </div>
            )}
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm('Delete this card?')) {
              onDelete()
            }
          }}
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity text-xs z-10"
        >
          ×
        </button>

        {card.description && (
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 line-clamp-2 break-words">
            {card.description}
          </div>
        )}

        {card.createdByName && (
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-2 truncate">
            {card.createdByName}
          </div>
        )}
      </div>

      {/* Card Details Modal */}
      {showModal && (
        <CardDetailsModal
          card={card}
          boardMembers={boardMembers}
          onClose={() => setShowModal(false)}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </>
  )
}