import { useState, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { List, Card } from '../../types'
import CardItem from '../Card/CardItem'

interface ListColumnProps {
  list: List
  cards: Card[]
  boardMembers: { id: number; name: string; email: string }[]
  boardLabels: string[]
  boardId: number
  currentUserId: number
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
  isFirst?: boolean
  onCreateCard: (listId: number, title: string, description?: string) => void
  onUpdateCard: (cardId: number, updates: { title?: string; description?: string }) => void
  onMoveCard: (cardId: number, newListId: number, newPosition: number, oldListId: number, oldPosition: number) => void
  onDeleteCard: (cardId: number, listId: number) => void
  onDeleteList: (listId: number) => void
}

export default function ListColumn({
  list,
  cards,
  boardMembers,
  boardLabels,
  boardId,
  currentUserId,
  dragHandleProps,
  isFirst,
  onCreateCard,
  onUpdateCard,
  onDeleteCard,
  onDeleteList,
}: ListColumnProps) {
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [showMenu, setShowMenu] = useState(false)

  // Close menu on Escape
  useEffect(() => {
    if (!showMenu) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setShowMenu(false) }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [showMenu])

  const { setNodeRef, isOver } = useDroppable({
    id: `list-${list.id}`,
    data: { type: 'list', listId: list.id }
  })

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCardTitle.trim()) return

    onCreateCard(list.id, newCardTitle.trim())
    setNewCardTitle('')
    setShowAddCard(false)
  }

  return (
    <div
      ref={setNodeRef}
      className={`w-[280px] flex-shrink-0 rounded-xl p-3 flex flex-col transition-colors
        h-full max-h-full
        ${isOver ? 'bg-black/20 dark:bg-black/30' : 'bg-black/10 dark:bg-black/20'}
        backdrop-blur-md border border-white/20`}
    >
      {/* List header — drag handle for list reordering */}
      <div className="flex justify-between items-center mb-3 relative">
        <h3
          {...dragHandleProps}
          className="text-white font-semibold text-sm flex-1 cursor-grab active:cursor-grabbing select-none"
          title="Drag to reorder list"
        >
          {list.title}
        </h3>
        <span className="text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded-full mr-2">
          {cards.length}
        </span>
        {/* Menu button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded p-1 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
        
        {/* Dropdown menu */}
        {showMenu && (
          <div className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10 min-w-[120px]">
            <button
              onClick={() => {
                onDeleteList(list.id)
                setShowMenu(false)
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Delete list
            </button>
          </div>
        )}
      </div>

      {/* Cards */}
      <SortableContext
        items={cards.map(c => `card-${c.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 overflow-y-auto space-y-2 mb-2">
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              boardMembers={boardMembers}
              boardLabels={boardLabels}
              boardId={boardId}
              currentUserId={currentUserId}
              onUpdate={onUpdateCard}
              onDelete={() => onDeleteCard(card.id, list.id)}
              isDone={list.title.toLowerCase() === 'done'}
            />
          ))}
        </div>
      </SortableContext>

      {/* Add card form/button */}
      {showAddCard ? (
        <form onSubmit={handleCreateCard} className="mt-auto">
          <textarea
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setShowAddCard(false)
                setNewCardTitle('')
              }
            }}
            placeholder="Enter card title..."
            autoFocus
            rows={3}
            className="w-full px-2 py-2 border-none rounded-lg text-sm mb-2 resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-white/50"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm transition"
            >
              Add card
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddCard(false)
                setNewCardTitle('')
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-lg text-sm transition"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAddCard(true)}
          {...(isFirst ? { 'data-add-card': '' } : {})}
          className="w-full p-2 text-left text-white/90 hover:bg-white/10 rounded-lg text-sm transition mt-auto"
        >
          + Add a card
        </button>
      )}
    </div>
  )
}