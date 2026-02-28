import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { List, Card } from '../../types'
import CardItem from '../Card/CardItem'

interface ListColumnProps {
  list: List
  cards: Card[]
  onCreateCard: (listId: number, title: string, description?: string) => void
  onUpdateCard: (cardId: number, updates: { title?: string; description?: string }) => void
  onMoveCard: (cardId: number, newListId: number, newPosition: number, oldListId: number, oldPosition: number) => void
  onDeleteCard: (cardId: number, listId: number) => void
}

export default function ListColumn({
  list,
  cards,
  onCreateCard,
  onUpdateCard,
  onDeleteCard,
}: ListColumnProps) {
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')

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
      className={`min-w-[280px] max-w-[280px] flex-shrink-0 rounded-xl p-3 flex flex-col max-h-[calc(100vh-120px)] transition-colors ${
        isOver 
          ? 'bg-black/20 dark:bg-black/30' 
          : 'bg-black/10 dark:bg-black/20'
      } backdrop-blur-md border border-white/20`}
    >
      {/* List header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-semibold text-sm">
          {list.title}
        </h3>
        <span className="text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded-full">
          {cards.length}
        </span>
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
              onUpdate={onUpdateCard}
              onDelete={() => onDeleteCard(card.id, list.id)}
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
          className="w-full p-2 text-left text-white/90 hover:bg-white/10 rounded-lg text-sm transition mt-auto"
        >
          + Add a card
        </button>
      )}
    </div>
  )
}