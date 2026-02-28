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
  DragOverEvent,
} from '@dnd-kit/core'
import type { List, Card } from '../../types'
import ListColumn from './ListColumn'

interface BoardViewProps {
  lists: List[]
  cards: Card[]
  getCardsForList: (listId: number) => Card[]
  onCreateCard: (listId: number, title: string, description?: string) => void
  onUpdateCard: (cardId: number, updates: { title?: string; description?: string }) => void
  onMoveCard: (cardId: number, newListId: number, newPosition: number, oldListId: number, oldPosition: number) => void
  onDeleteCard: (cardId: number, listId: number) => void
  onCreateList: (title: string) => void
}

export default function BoardView({
  lists,
  cards,
  getCardsForList,
  onCreateCard,
  onUpdateCard,
  onMoveCard,
  onDeleteCard,
  onCreateList,
}: BoardViewProps) {
  const [showAddList, setShowAddList] = useState(false)
  const [newListTitle, setNewListTitle] = useState('')
  const [activeCard, setActiveCard] = useState<Card | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts (prevents accidental drags)
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

  const handleDragOver = (event: DragOverEvent) => {
    // Optional: Handle visual feedback while dragging over lists
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)

    if (!over) return

    const activeCard = active.data.current?.card as Card | undefined
    if (!activeCard) return

    // Get the target list ID
    const overData = over.data.current
    let targetListId: number | null = null

    if (overData?.type === 'list') {
      targetListId = overData.listId
    } else if (overData?.type === 'card') {
      targetListId = overData.card.listId
    }

    if (!targetListId) return

    // If dropped in same list at same position, do nothing
    if (targetListId === activeCard.listId) {
      return
    }

    // Get cards in target list to calculate new position
    const targetListCards = getCardsForList(targetListId)
    const newPosition = targetListCards.length

    // Call the move handler
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
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div style={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '16px'
      }}>
        <div style={{
          display: 'flex',
          gap: '16px',
          minHeight: '100%',
          paddingBottom: '16px'
        }}>
          {/* List columns */}
          {lists
            .sort((a, b) => a.position - b.position)
            .map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                cards={getCardsForList(list.id)}
                onCreateCard={onCreateCard}
                onUpdateCard={onUpdateCard}
                onMoveCard={onMoveCard}
                onDeleteCard={onDeleteCard}
              />
            ))}

          {/* Add list button/form */}
          <div style={{
            minWidth: '280px',
            maxWidth: '280px',
            flexShrink: 0
          }}>
            {showAddList ? (
              <div style={{
                background: 'rgba(0, 0, 0, 0.1)',
                backdropFilter: 'blur(10px)',
                padding: '12px',
                borderRadius: '8px'
              }}>
                <form onSubmit={handleCreateList}>
                  <input
                    type="text"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder="Enter list title..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      marginBottom: '8px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="submit"
                      style={{
                        padding: '6px 12px',
                        background: '#0052CC',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddList(false)
                        setNewListTitle('')
                      }}
                      style={{
                        padding: '6px 12px',
                        background: 'transparent',
                        color: 'white',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <button
                onClick={() => setShowAddList(true)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textAlign: 'left'
                }}
              >
                + Add another list
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Drag overlay - shows card while dragging */}
      <DragOverlay>
        {activeCard ? (
          <div style={{
            background: 'white',
            borderRadius: '4px',
            padding: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontSize: '14px',
            minWidth: '264px',
            cursor: 'grabbing'
          }}>
            {activeCard.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}