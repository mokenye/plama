import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { throttle } from 'lodash'
import { emitCursorMove, bindCursorHandler, unbindCursorHandler, type CursorPayload } from '../../services/socket'
import type { List, Card } from '../../types'
import { useBoardStore } from '../../store'
import ListColumn from './ListColumn'
import SortableList from './SortableList'

const CURSOR_COLORS = [
  '#6366F1', '#EC4899', '#10B981', '#F59E0B',
  '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6',
]
const colorForUser = (userId: number) => CURSOR_COLORS[userId % CURSOR_COLORS.length]

interface RemoteCursor {
  userId: number
  userName: string
  x: number
  y: number
  updatedAt: number
}

interface BoardViewProps {
  boardId: number
  currentUserId: number
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
  boardId,
  currentUserId,
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

  // Drop indicator — drives the visual line in ListColumn.
  // Also the single source of truth for where the card will land.
  // onDragEnd reads this ref directly so there's no sync gap.
  const [dropIndicator, setDropIndicator] = useState<{ listId: number; index: number } | null>(null)
  const dropIndicatorRef = useRef<{ listId: number; index: number } | null>(null)

  const clearIndicator = () => {
    dropIndicatorRef.current = null
    setDropIndicator(null)
  }

  const updateIndicator = (listId: number, index: number) => {
    // Skip re-render if position hasn't changed
    if (dropIndicatorRef.current?.listId === listId &&
        dropIndicatorRef.current?.index === index) return
    dropIndicatorRef.current = { listId, index }
    setDropIndicator({ listId, index })
  }

  // ── Cursor tracking ─────────────────────────────────────────────────────
  const [cursors, setCursors] = useState<Map<number, RemoteCursor>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  const emitThrottled = useCallback(
    throttle((x: number, y: number) => {
      emitCursorMove({ boardId, x, y })
    }, 30),
    [boardId]
  )

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    emitThrottled(
      ((e.clientX - rect.left) / rect.width) * 100,
      ((e.clientY - rect.top) / rect.height) * 100,
    )
  }, [emitThrottled])

  useEffect(() => {
    const handler = (data: CursorPayload) => {
      if (data.userId === currentUserId) return
      setCursors(prev => {
        const next = new Map(prev)
        next.set(data.userId, { ...data, updatedAt: Date.now() })
        return next
      })
    }
    bindCursorHandler(handler)
    return () => unbindCursorHandler(handler)
  }, [currentUserId])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setCursors(prev => {
        const stale = [...prev.values()].filter(c => now - c.updatedAt > 5000)
        if (stale.length === 0) return prev
        const next = new Map(prev)
        stale.forEach(c => next.delete(c.userId))
        return next
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [])

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

  // ── Collision detection ─────────────────────────────────────────────────
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeId = args.active.id as string
    if (activeId.startsWith('list-')) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(c =>
          (c.id as string).startsWith('list-')
        ),
      })
    }
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) return pointerCollisions
    return rectIntersection(args)
  }, [])

  // ── Pointer Y — centre of the dragged card's current translated rect ────
  const resolvePointerY = (event: DragOverEvent): number => {
    const r = event.active.rect.current.translated
    if (r) return r.top + r.height / 2
    return event.over!.rect.top + event.over!.rect.height / 2
  }

  // ── Drag start ──────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    clearIndicator()
    const id = event.active.id as string
    if (id.startsWith('list-')) {
      const listId = parseInt(id.replace('list-', ''))
      setActiveList(lists.find(l => l.id === listId) ?? null)
      setDragType('list')
      setLocalListOrder(orderedLists.map(l => l.id))
    } else {
      const cardId = parseInt(id.replace('card-', ''))
      setActiveCard(cards.find(c => c.id === cardId) ?? null)
      setDragType('card')
    }
  }

  // ── Drag over ───────────────────────────────────────────────────────────
  // Resolves the drop position and updates the indicator.
  // onDragEnd reads dropIndicatorRef directly — no pendingDrop needed.
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string

    // ── List reorder preview ──────────────────────────────────────────────
    if (activeId.startsWith('list-') && overId.startsWith('list-')) {
      const currentOrder = localListOrder ?? orderedLists.map(l => l.id)
      const currentLists = currentOrder.map(id => lists.find(l => l.id === id)!).filter(Boolean)
      const activeIdx = currentLists.findIndex(l => `list-${l.id}` === activeId)
      const overIdx   = currentLists.findIndex(l => `list-${l.id}` === overId)
      if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
        setLocalListOrder(arrayMove(currentLists, activeIdx, overIdx).map(l => l.id))
      }
      return
    }

    if (!activeId.startsWith('card-')) return

    // Always read from store — never from stale React closure
    const cardId = parseInt(activeId.replace('card-', ''))
    const liveCards = useBoardStore.getState().cards
    const dragCard = liveCards.find(c => c.id === cardId)
    if (!dragCard) return

    const liveCardsForList = (listId: number) =>
      liveCards.filter(c => c.listId === listId).sort((a, b) => a.position - b.position)

    let targetListId: number | null = null
    if (overId.startsWith('list-')) {
      targetListId = parseInt(overId.replace('list-', ''))
    } else if (overId.startsWith('card-')) {
      const overCardId = parseInt(overId.replace('card-', ''))
      targetListId = liveCards.find(c => c.id === overCardId)?.listId ?? null
    }
    if (!targetListId) return

    const pointerY = resolvePointerY(event)
    // Exclude dragged card so indices are correct in target list
    const targetCards = liveCardsForList(targetListId).filter(c => c.id !== cardId)

    if (targetListId !== dragCard.listId) {
      // ── Cross-list ──────────────────────────────────────────────────────
      let index: number
      if (overId.startsWith('card-')) {
        const overIdx = targetCards.findIndex(c => `card-${c.id}` === overId)
        const midpoint = over.rect.top + over.rect.height / 2
        index = pointerY > midpoint ? overIdx + 1 : overIdx
      } else {
        if (targetCards.length === 0) {
          index = 0
        } else {
          index = targetCards.length
          let bestDist = Infinity
          targetCards.forEach((c, idx) => {
            const el = document.querySelector(`[data-id="card-${c.id}"]`) as HTMLElement | null
            if (!el) return
            const rect = el.getBoundingClientRect()
            const centre = rect.top + rect.height / 2
            const dist = Math.abs(pointerY - centre)
            if (dist < bestDist) {
              bestDist = dist
              index = pointerY < centre ? idx : idx + 1
            }
          })
        }
      }
      updateIndicator(targetListId, Math.max(0, index))
    } else {
      // ── Same-list reorder ───────────────────────────────────────────────
      const sameListCards = liveCardsForList(targetListId)
      const oldIdx = sameListCards.findIndex(c => c.id === cardId)
      const newIdx = overId.startsWith('card-')
        ? sameListCards.findIndex(c => `card-${c.id}` === overId)
        : sameListCards.length - 1
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        updateIndicator(targetListId, newIdx)
      }
    }
  }, [localListOrder, orderedLists, lists])

  // ── Drag end ─────────────────────────────────────────────────────────────
  // Reads dropIndicatorRef (not a separate pendingDrop) so indicator and
  // committed position are guaranteed identical.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    // Capture indicator BEFORE clearing it — this is what we commit
    const indicator = dropIndicatorRef.current
    setActiveCard(null)
    setActiveList(null)
    setDragType(null)
    clearIndicator()

    if (!over) { setLocalListOrder(null); return }

    const activeId = active.id as string

    // ── List reorder commit ───────────────────────────────────────────────
    if (activeId.startsWith('list-')) {
      const finalOrder = localListOrder ?? orderedLists.map(l => l.id)
      setLocalListOrder(null)
      const listId = parseInt(activeId.replace('list-', ''))
      const oldIdx = [...lists].sort((a, b) => a.position - b.position).findIndex(l => l.id === listId)
      const newIdx = finalOrder.indexOf(listId)
      if (oldIdx !== newIdx) onMoveList(listId, newIdx, oldIdx)
      return
    }

    // ── Card drop commit ──────────────────────────────────────────────────
    // Commit using the indicator captured at the top of this handler.
    // dropIndicatorRef is already cleared so we use the local capture.
    if (!indicator) return

    const cardId = parseInt(activeId.replace('card-', ''))
    const liveCards = useBoardStore.getState().cards
    const dragCard = liveCards.find(c => c.id === cardId)
    if (!dragCard) return

    const liveCardsForList = (listId: number) =>
      liveCards.filter(c => c.listId === listId).sort((a, b) => a.position - b.position)

    const { listId: targetListId, index: newPosition } = indicator

    if (targetListId !== dragCard.listId) {
      onMoveCard(cardId, targetListId, newPosition, dragCard.listId, dragCard.position)
    } else {
      const sameListCards = liveCardsForList(targetListId)
      const reordered = arrayMove(sameListCards, sameListCards.findIndex(c => c.id === cardId), newPosition)
      onReorderCards(targetListId, reordered.map(c => c.id))
    }
  }

  const listIds: UniqueIdentifier[] = orderedLists.map(l => `list-${l.id}`)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={containerRef}
        className="relative h-full flex flex-col"
        onMouseMove={handleMouseMove}
      >
        {/* Remote cursors overlay */}
        {[...cursors.values()].map(cursor => (
          <div
            key={cursor.userId}
            className="pointer-events-none absolute z-50 flex items-center gap-1"
            style={{
              left: `${cursor.x}%`,
              top: `${cursor.y}%`,
              transform: 'translate(-50%, -50%)',
              transition: 'left 80ms linear, top 80ms linear',
            }}
          >
            <div className="relative flex-shrink-0">
              <span
                className="absolute inline-flex h-1.5 w-1.5 rounded-full opacity-50 animate-ping"
                style={{ backgroundColor: colorForUser(cursor.userId) }}
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: colorForUser(cursor.userId) }}
              />
            </div>
            <span
              className="text-xs font-medium whitespace-nowrap"
              style={{ color: colorForUser(cursor.userId) }}
            >
              {(cursor.userName ?? '?').split(' ')[0]}
            </span>
          </div>
        ))}

        <div className="h-full overflow-x-auto overflow-y-hidden" id="board-scroll-area">
          <div className="p-3 sm:p-4 h-full">
            <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-3 sm:gap-4 h-full items-stretch" style={{ minWidth: 'max-content' }}>
                {orderedLists.map((list, index) => (
                  <SortableList key={list.id} id={`list-${list.id}`}>
                    {(dragHandleProps) => (
                      <ListColumn
                        list={list}
                        isFirst={index === 0}
                        cards={getCardsForList(list.id)}
                        boardMembers={boardMembers}
                        boardLabels={boardLabels}
                        boardId={boardId}
                        currentUserId={currentUserId}
                        dragHandleProps={dragHandleProps}
                        dropIndicatorIndex={dropIndicator?.listId === list.id ? dropIndicator.index : null}
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

        {/* Right-edge fade */}
        <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-black/20 to-transparent" />
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