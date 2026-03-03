import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface BoardSettingsProps {
  boardId: number
  currentTitle: string
  currentColor: string
  onClose: () => void
  onUpdate: (title: string, color: string) => void
}

// Curated palette: intentional, slightly desaturated hues that look good as full-bleed backgrounds
const PRESET_COLORS = [
  { name: 'Slate Blue',    value: '#4F6BED' },
  { name: 'Indigo',        value: '#6366F1' },
  { name: 'Violet',        value: '#7C3AED' },
  { name: 'Teal',          value: '#0D9488' },
  { name: 'Emerald',       value: '#059669' },
  { name: 'Amber',         value: '#B45309' },
  { name: 'Rose',          value: '#E11D48' },
  { name: 'Slate',         value: '#475569' },
]

export default function BoardSettings({
  boardId,
  currentTitle,
  currentColor,
  onClose,
  onUpdate,
}: BoardSettingsProps) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(currentTitle)
  const [color, setColor] = useState(currentColor)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), background_color: color }),
      })
      if (!response.ok) throw new Error('Failed to update board')
      onUpdate(title.trim(), color)
      onClose()
    } catch {
      alert('Failed to update board')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/boards/${boardId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to delete board')
      navigate('/')
    } catch {
      alert('Failed to delete board')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Board settings</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Board name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Color
            </label>
            <div className="grid grid-cols-8 gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setColor(preset.value)}
                  title={preset.name}
                  className="relative h-8 rounded-lg transition-transform hover:scale-110 focus:outline-none"
                  style={{ backgroundColor: preset.value }}
                >
                  {color === preset.value && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* Preview */}
            <div
              className="mt-3 h-10 rounded-lg transition-colors"
              style={{ backgroundColor: color }}
            />
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                Delete board…
              </button>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4">
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  This will permanently delete the board and all its cards. Are you sure?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading || !title.trim()}
            className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}