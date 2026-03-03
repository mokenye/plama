import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import type { List, Card } from '../../types'
import ListColumn from './ListColumn'

interface BoardViewProps {
  lists: List[]
  cards: Card[]
  boardMembers: { id: number; name: string; email: string }[]
  boardLabels: string[]
  getCardsForList: (listId: number) => Card[]
  onCreateCard: (listId: number, title: string, description?: string) => void
  onUpdateCard: (cardId: number, updates: { title?: string; description?: string }) => void
  onMoveCard: (cardId: number, newListId: number, newPosition: number, oldListId: number, oldPosition: number) => void
  onDeleteCard: (cardId: number, listId: number) => void
  onCreateList: (title: string) => void
  onDeleteList: (listId: number) => void
}

export default function BoardView({
  lists,
  cards,
  boardMembers,
  boardLabels,
  getCardsForList,
  onCreateCard,
  onUpdateCard,
  onMoveCard,
  onDeleteCard,
  onCreateList,
  onDeleteList,
}: BoardViewProps) {
  const [showAddList, setShowAddList] = useState(false)
  const [newListTitle, setNewListTitle] = useState('')
  const [activeCard, setActiveCard] = useState<Card | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListTitle.trim()) return
    
    onCreateList(newListTitle.trim())
    setNewListTitle('')
    setShowAddList(false)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const card = active.data.current?.card as Card | undefined
    if (card) {
      setActiveCard(card)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)

    if (!over) return

    const activeCard = active.data.current?.card as Card | undefined
    if (!activeCard) return

    const overData = over.data.current
    let targetListId: number | null = null

    if (overData?.type === 'list') {
      targetListId = overData.listId
    } else if (overData?.type === 'card') {
      targetListId = overData.card.listId
    }

    if (!targetListId) return
    if (targetListId === activeCard.listId) return

    const targetListCards = getCardsForList(targetListId)
    const newPosition = targetListCards.length

    onMoveCard(
      activeCard.id,
      targetListId,
      newPosition,
      activeCard.listId,
      activeCard.position
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
        <div className="flex flex-col md:flex-row gap-4 min-h-full pb-4">
          {/* List columns */}
          {lists
            .sort((a, b) => a.position - b.position)
            .map((list, index) => (
              <ListColumn
                key={list.id}
                list={list}
                isFirst={index === 0}
                cards={getCardsForList(list.id)}
                boardMembers={boardMembers}
                boardLabels={boardLabels}
                onCreateCard={onCreateCard}
                onUpdateCard={onUpdateCard}
                onMoveCard={onMoveCard}
                onDeleteCard={onDeleteCard}
                onDeleteList={onDeleteList}
              />
            ))}

          {/* Add list button/form */}
          <div className="w-full md:min-w-[280px] md:max-w-[280px] md:flex-shrink-0">
            {showAddList ? (
              <div className="bg-black/10 dark:bg-black/20 backdrop-blur-md p-3 rounded-xl border border-white/20">
                <form onSubmit={handleCreateList}>
                  <input
                    type="text"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setShowAddList(false)
                        setNewListTitle('')
                      }
                    }}
                    placeholder="Enter list title..."
                    autoFocus
                    className="w-full px-3 py-2 border-none rounded-lg text-sm mb-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-white/50"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm transition"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddList(false)
                        setNewListTitle('')
                      }}
                      className="px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-lg text-sm transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <button
                data-add-list
                onClick={() => setShowAddList(true)}
                className="w-full p-3 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-xl text-sm font-medium text-left transition"
              >
                + Add another list
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeCard ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-2xl text-sm min-w-[264px] cursor-grabbing border border-gray-200 dark:border-gray-700">
            {activeCard.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}