import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { OptimisticCard } from '../../types'
import CardDetailsModal from './CardDetailsModal'

interface CardItemProps {
  card: OptimisticCard
  boardMembers: { id: number; name: string; email: string }[]
  boardLabels: string[]
  boardId: number
  currentUserId: number
  onUpdate: (cardId: number, updates: { title?: string; description?: string }) => void
  onDelete: () => void
  isDone?: boolean
}

// Subtle tinted label pills instead of solid colors
const LABEL_COLORS: Record<string, string> = {
  'Bug':          'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  'Feature':      'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'Urgent':       'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  'Low Priority': 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  'Design':       'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'Backend':      'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Frontend':     'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  'Testing':      'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-500',
}

export default function CardItem({ card, boardMembers, boardLabels, boardId, currentUserId, onUpdate, onDelete, isDone }: CardItemProps) {
  const [showModal, setShowModal] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${card.id}`,
    data: { type: 'card', card },
  })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date() && !isDone

  return (
    <>
      <div
        ref={setNodeRef}
        data-id={`card-${card.id}`}
        style={style}
        onClick={() => { if (!isDragging) setShowModal(true) }}
        className={`group relative bg-white dark:bg-gray-800 rounded-lg p-3 border transition-all outline-none focus:outline-none touch-none ${
          isDragging
            ? 'opacity-50 shadow-xl cursor-grabbing'
            : card.isOptimistic
            ? 'opacity-60'
            : 'cursor-pointer'
        } ${
          isDone
            ? 'opacity-55 border-gray-100 dark:border-gray-700/40'
            : 'border-gray-100 dark:border-gray-700/60 shadow-sm hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600'
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
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${LABEL_COLORS[label] ?? 'bg-gray-100 text-gray-500'}`}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <p className={`text-sm leading-snug pr-4 break-words ${
          isDone
            ? 'line-through text-gray-400 dark:text-gray-500'
            : 'text-gray-800 dark:text-white'
        }`}>
          {card.title}
          {card.isOptimistic && (
            <span className="block text-xs text-gray-400 italic mt-0.5" style={{ textDecoration: 'none' }}>Saving…</span>
          )}
        </p>

        {/* Description — hidden for done cards to reduce noise */}
        {card.description && !isDone && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 line-clamp-2 break-words leading-relaxed">
            {card.description}
          </p>
        )}

        {/* Footer: due date + assignees */}
        {(card.dueDate || (card.assignees && card.assignees.length > 0)) && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/60">
            {card.dueDate ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'
              }`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {new Date(card.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            ) : <span />}

            {card.assignees && card.assignees.length > 0 && (
              <div className="flex -space-x-1">
                {card.assignees.slice(0, 3).map((assigneeId) => {
                  const member = boardMembers.find(m => m.id === assigneeId)
                  if (!member) return null
                  return (
                    <div
                      key={assigneeId}
                      title={member.name}
                      className="w-4 h-4 rounded-full bg-indigo-400 text-white flex items-center justify-center text-[8px] font-bold border border-white dark:border-gray-800"
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )
                })}
                {card.assignees.length > 3 && (
                  <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 flex items-center justify-center text-[8px] font-bold border border-white dark:border-gray-800">
                    +{card.assignees.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('Delete this card?')) onDelete() }}
          className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-base leading-none"
        >
          ×
        </button>
      </div>

      {showModal && createPortal(
        <CardDetailsModal
          card={card}
          boardMembers={boardMembers}
          boardLabels={boardLabels}
          boardId={boardId}
          currentUserId={currentUserId}
          onClose={() => setShowModal(false)}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />,
        document.body
      )}
    </>
  )
}