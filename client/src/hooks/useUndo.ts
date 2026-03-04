import { useRef, useState, useCallback } from 'react'

export interface UndoAction {
  id: string
  message: string
  onUndo: () => void
}

const UNDO_DELAY_MS = 4000 // time before action actually fires

/**
 * useUndo — wraps a destructive action with a toast + cancel window.
 *
 * Usage:
 *   const { pendingActions, scheduleAction, cancelAction } = useUndo()
 *   scheduleAction('Card deleted', () => actuallyDeleteCard(id))
 */
export function useUndo() {
  const [pendingActions, setPendingActions] = useState<UndoAction[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const scheduleAction = useCallback((message: string, action: () => void): string => {
    const id = `undo-${Date.now()}-${Math.random()}`

    setPendingActions(prev => [...prev, { id, message, onUndo: () => cancelAction(id) }])

    timers.current[id] = setTimeout(() => {
      action()
      setPendingActions(prev => prev.filter(a => a.id !== id))
      delete timers.current[id]
    }, UNDO_DELAY_MS)

    return id
  }, [])

  const cancelAction = useCallback((id: string) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setPendingActions(prev => prev.filter(a => a.id !== id))
  }, [])

  return { pendingActions, scheduleAction, cancelAction }
}