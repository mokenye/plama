import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { UndoAction } from '../../hooks/useUndo'

const UNDO_DELAY_MS = 4000

interface UndoToastProps {
  actions: UndoAction[]
}

function ToastItem({ action }: { action: UndoAction }) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / UNDO_DELAY_MS) * 100)
      setProgress(remaining)
      if (remaining > 0) requestAnimationFrame(tick)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="relative overflow-hidden bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl border border-white/10 min-w-[260px] max-w-sm">
      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-indigo-400 transition-none"
        style={{ width: `${progress}%` }}
      />
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-sm text-white/90 flex-1">{action.message}</span>
        <button
          onClick={action.onUndo}
          className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold uppercase tracking-wide transition-colors flex-shrink-0"
        >
          Undo
        </button>
      </div>
    </div>
  )
}

export default function UndoToast({ actions }: UndoToastProps) {
  if (actions.length === 0) return null
  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[99998] items-center">
      {actions.map(action => (
        <ToastItem key={action.id} action={action} />
      ))}
    </div>,
    document.body
  )
}