import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBoardsStore } from '../../store'

interface Member {
  id: number
  name: string
  email: string
  role: string
  avatarUrl?: string
}

interface BoardSettingsProps {
  boardId: number
  currentTitle: string
  currentColor: string
  isOwner: boolean
  members: Member[]
  currentUserId: number
  onClose: () => void
  onUpdate: (title: string, color: string) => void
  onMemberRemoved: (userId: number) => void
}

const PRESET_COLORS = [
  { name: 'Plama Indigo',   value: '#6366F1' },
  { name: 'Indigo Deep',    value: '#4338CA' },
  { name: 'Ocean Blue',     value: '#0052CC' },
  { name: 'Sky',            value: '#0284C7' },
  { name: 'Teal',           value: '#0D9488' },
  { name: 'Cyan',           value: '#00A3BF' },
  { name: 'Forest',         value: '#00875A' },
  { name: 'Emerald',        value: '#059669' },
  { name: 'Lime',           value: '#65A30D' },
  { name: 'Violet',         value: '#7C3AED' },
  { name: 'Purple',         value: '#5243AA' },
  { name: 'Fuchsia',        value: '#A21CAF' },
  { name: 'Pink',           value: '#E774BB' },
  { name: 'Rose',           value: '#E11D48' },
  { name: 'Red',            value: '#DE350B' },
  { name: 'Orange',         value: '#FF8B00' },
  { name: 'Amber',          value: '#D97706' },
  { name: 'Yellow',         value: '#CA8A04' },
  { name: 'Slate',          value: '#475569' },
  { name: 'Gray',           value: '#505F79' },
]

const UNDO_DELAY_MS = 5000

function MemberAvatar({ member }: { member: Member }) {
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
      {member.name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function BoardSettings({
  boardId,
  currentTitle,
  currentColor,
  isOwner,
  members,
  currentUserId,
  onClose,
  onUpdate,
  onMemberRemoved,
}: BoardSettingsProps) {
  const navigate    = useNavigate()
  const removeBoard = useBoardsStore((s) => s.removeBoard)

  const [title, setTitle]   = useState(currentTitle)
  const [color, setColor]   = useState(currentColor)
  const [loading, setLoading] = useState(false)

  // Remove member state
  const [removingId, setRemovingId]           = useState<number | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null)

  // Delete board undo state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteScheduled, setDeleteScheduled]     = useState(false)
  const [undoTimer, setUndoTimer]                 = useState<ReturnType<typeof setTimeout> | null>(null)
  const [progress, setProgress]                   = useState(100)

  // ── Save settings ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), background_color: color }),
      })
      if (!res.ok) throw new Error()
      onUpdate(title.trim(), color)
      onClose()
    } catch {
      alert('Failed to update board')
    } finally {
      setLoading(false)
    }
  }

  // ── Remove member ──────────────────────────────────────────────────────────
  const handleRemoveMember = async (userId: number) => {
    setRemovingId(userId)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/boards/${boardId}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      onMemberRemoved(userId)
      setConfirmRemoveId(null)
    } catch {
      alert('Failed to remove member')
    } finally {
      setRemovingId(null)
    }
  }

  // ── Delete board ───────────────────────────────────────────────────────────
  const actuallyDelete = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/boards/${boardId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      removeBoard(boardId)
      navigate('/')
    } catch {
      alert('Failed to delete board')
      setDeleteScheduled(false)
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(false)
    setDeleteScheduled(true)
    setProgress(100)
    const start = Date.now()
    const rafTick = () => {
      const remaining = Math.max(0, 100 - ((Date.now() - start) / UNDO_DELAY_MS) * 100)
      setProgress(remaining)
      if (remaining > 0) requestAnimationFrame(rafTick)
    }
    requestAnimationFrame(rafTick)
    const timer = setTimeout(actuallyDelete, UNDO_DELAY_MS)
    setUndoTimer(timer)
  }

  const handleUndo = () => {
    if (undoTimer) clearTimeout(undoTimer)
    setUndoTimer(null)
    setDeleteScheduled(false)
    setProgress(100)
  }

  // Non-owners in the list (owner can't be removed)
  const removableMembers = members.filter(m => m.role !== 'owner')

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Board Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none">×</button>
        </div>

        {/* Scrollable content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Board Name</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Background Color</label>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map(preset => (
                <button key={preset.value} onClick={() => setColor(preset.value)}
                  className={`h-10 rounded-lg transition-all ${color === preset.value ? 'ring-4 ring-indigo-500 ring-offset-2 scale-105' : 'hover:scale-105 hover:brightness-110'}`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          {/* Members */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Members <span className="text-gray-400 font-normal">({members.length})</span>
            </h3>
            <ul className="space-y-2">
              {members.map(member => (
                <li key={member.id} className="flex items-center gap-3">
                  <MemberAvatar member={member} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {member.name}
                      {member.id === currentUserId && (
                        <span className="ml-1.5 text-xs text-gray-400">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.email}</p>
                  </div>

                  {/* Role badge */}
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                    member.role === 'owner'
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {member.role}
                  </span>

                  {/* Remove button — owner only, not for self or other owners */}
                  {isOwner && member.role !== 'owner' && (
                    confirmRemoveId === member.id ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingId === member.id}
                          className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition disabled:opacity-50"
                        >
                          {removingId === member.id ? '…' : 'Remove'}
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveId(member.id)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        title={`Remove ${member.name}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Delete board — owner only */}
          {isOwner && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              {deleteScheduled ? (
                <div className="relative overflow-hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 transition-none" style={{ width: `${progress}%` }} />
                  <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                    Board will be deleted in {Math.ceil((progress / 100) * (UNDO_DELAY_MS / 1000))}s…
                  </p>
                  <button onClick={handleUndo} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold">
                    Undo
                  </button>
                </div>
              ) : !showDeleteConfirm ? (
                <button onClick={() => setShowDeleteConfirm(true)} className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium">
                  Delete Board
                </button>
              ) : (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                    Delete this board and all its lists and cards? You'll have 5 seconds to undo.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleDeleteClick} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm">Yes, Delete</button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded text-sm">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isOwner && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500">Only the board owner can delete this board.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <button onClick={handleSave} disabled={loading || !title.trim()}
            className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition">
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}