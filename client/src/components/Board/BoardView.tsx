import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import type { List, Card } from '../../types'
import ListColumn from './ListColumn'
import SortableList from './SortableList'

interface BoardViewProps {
  lists: List[]
  cards: Card[]
  boardMembers: { id: number; name: string; email: string }[]
  boardLabels: string[]
  getCardsForList: (listId: number) => Card[]
  onCreateCard: (listId: number, title: string, description?: string) => void
  onUpdateCard: (cardId: number, updates: { title?: string; description?: string }) => void
  onMoveCard: (cardId: number, newListId: number, newPosition: number, oldListId: number, oldPosition: number) => void
  onReorderCards: (listId: number, cardIds: number[]) => void
  onMoveList: (listId: number, newPosition: number, oldPosition: number) => void
  onDeleteCard: (cardId: number, listId: number) => void
  onCreateList: (title: string) => void
  onDeleteList: (listId: number) => void
}

type DragType = 'card' | 'list' | null

export default function BoardView({
  lists,
  cards,
  boardMembers,
  boardLabels,
  getCardsForList,
  onCreateCard,
  onUpdateCard,
  onMoveCard,
  onReorderCards,
  onMoveList,
  onDeleteCard,
  onCreateList,
  onDeleteList,
}: BoardViewProps) {
  const [showAddList, setShowAddList] = useState(false)
  const [newListTitle, setNewListTitle] = useState('')
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [activeList, setActiveList] = useState<List | null>(null)
  const [dragType, setDragType] = useState<DragType>(null)

  // Optimistic local list order for smooth list dragging
  const [localListOrder, setLocalListOrder] = useState<number[] | null>(null)
  const orderedLists = localListOrder
    ? localListOrder.map(id => lists.find(l => l.id === id)!).filter(Boolean)
    : [...lists].sort((a, b) => a.position - b.position)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListTitle.trim()) return
    onCreateList(newListTitle.trim())
    setNewListTitle('')
    setShowAddList(false)
  }

  // ── Drag start ──────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string

    if (id.startsWith('list-')) {
      const listId = parseInt(id.replace('list-', ''))
      const list = lists.find(l => l.id === listId) ?? null
      setActiveList(list)
      setDragType('list')
      // Initialise local order for smooth drag
      setLocalListOrder(orderedLists.map(l => l.id))
    } else {
      const cardId = parseInt(id.replace('card-', ''))
      const card = cards.find(c => c.id === cardId) ?? null
      setActiveCard(card)
      setDragType('card')
    }
  }

  // ── Drag over: update local list order preview ──────────────────────────
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string

    if (activeId.startsWith('list-') && overId.startsWith('list-')) {
      const activeIdx = orderedLists.findIndex(l => `list-${l.id}` === activeId)
      const overIdx   = orderedLists.findIndex(l => `list-${l.id}` === overId)
      if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
        const newOrder = arrayMove(orderedLists, activeIdx, overIdx).map(l => l.id)
        setLocalListOrder(newOrder)
      }
    }
  }, [orderedLists])

  // ── Drag end ────────────────────────────────────────────────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)
    setActiveList(null)
    setDragType(null)

    if (!over) { setLocalListOrder(null); return }

    const activeId = active.id as string
    const overId   = over.id as string

    // ── List reorder ──────────────────────────────────────────────────────
    if (activeId.startsWith('list-')) {
      const finalOrder = localListOrder ?? orderedLists.map(l => l.id)
      setLocalListOrder(null)

      const listId  = parseInt(activeId.replace('list-', ''))
      const oldIdx  = [...lists].sort((a, b) => a.position - b.position).findIndex(l => l.id === listId)
      const newIdx  = finalOrder.indexOf(listId)

      if (oldIdx !== newIdx) onMoveList(listId, newIdx, oldIdx)
      return
    }

    // ── Card drag ─────────────────────────────────────────────────────────
    const cardId   = parseInt(activeId.replace('card-', ''))
    const dragCard = cards.find(c => c.id === cardId)
    if (!dragCard) return

    // Determine target list
    let targetListId: number | null = null
    if (overId.startsWith('list-')) {
      targetListId = parseInt(overId.replace('list-', ''))
    } else if (overId.startsWith('card-')) {
      const overCardId = parseInt(overId.replace('card-', ''))
      const overCard   = cards.find(c => c.id === overCardId)
      if (overCard) targetListId = overCard.listId
    }

    if (!targetListId) return

    const targetCards = getCardsForList(targetListId)

    if (targetListId !== dragCard.listId) {
      // ── Move between lists ──────────────────────────────────────────────
      const newPosition = overId.startsWith('card-')
        ? targetCards.findIndex(c => `card-${c.id}` === overId)
        : targetCards.length
      onMoveCard(cardId, targetListId, Math.max(0, newPosition), dragCard.listId, dragCard.position)
    } else {
      // ── Reorder within same list ────────────────────────────────────────
      const sameListCards = getCardsForList(targetListId)
      const oldIdx = sameListCards.findIndex(c => c.id === cardId)
      const newIdx = overId.startsWith('card-')
        ? sameListCards.findIndex(c => `card-${c.id}` === overId)
        : sameListCards.length - 1

      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const reordered = arrayMove(sameListCards, oldIdx, newIdx)
        onReorderCards(targetListId, reordered.map(c => c.id))
      }
    }
  }

  const listIds: UniqueIdentifier[] = orderedLists.map(l => `list-${l.id}`)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-x-auto overflow-y-hidden">
        <div className="p-4 h-full">
        <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 h-full items-stretch" style={{ minWidth: 'max-content' }}>
            {orderedLists.map((list, index) => (
              <SortableList key={list.id} id={`list-${list.id}`}>
                {(dragHandleProps) => (
                  <ListColumn
                    list={list}
                    isFirst={index === 0}
                    cards={getCardsForList(list.id)}
                    boardMembers={boardMembers}
                    boardLabels={boardLabels}
                    dragHandleProps={dragHandleProps}
                    onCreateCard={onCreateCard}
                    onUpdateCard={onUpdateCard}
                    onMoveCard={onMoveCard}
                    onDeleteCard={onDeleteCard}
                    onDeleteList={onDeleteList}
                  />
                )}
              </SortableList>
            ))}

            {/* Add list */}
            <div className="w-[280px] flex-shrink-0 self-start">
              {showAddList ? (
                <div className="bg-black/10 dark:bg-black/20 backdrop-blur-md p-3 rounded-xl border border-white/20">
                  <form onSubmit={handleCreateList}>
                    <input
                      type="text"
                      value={newListTitle}
                      onChange={e => setNewListTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') { e.stopPropagation(); setShowAddList(false); setNewListTitle('') }
                      }}
                      placeholder="Enter list title..."
                      autoFocus
                      className="w-full px-3 py-2 border-none rounded-lg text-sm mb-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-white/50"
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition">Add</button>
                      <button type="button" onClick={() => { setShowAddList(false); setNewListTitle('') }}
                        className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition">Cancel</button>
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
        </SortableContext>
        </div>
      </div>

      <DragOverlay>
        {dragType === 'card' && activeCard && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-2xl text-sm min-w-[264px] cursor-grabbing border border-gray-200 dark:border-gray-700 opacity-90">
            {activeCard.title}
          </div>
        )}
        {dragType === 'list' && activeList && (
          <div className="bg-black/20 backdrop-blur rounded-xl p-3 shadow-2xl min-w-[280px] max-w-[280px] cursor-grabbing border border-white/20 opacity-90">
            <p className="text-white font-semibold text-sm">{activeList.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}