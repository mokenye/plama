import { useState, useEffect, useRef } from 'react'
import type { OptimisticCard, Comment } from '../../types'

interface CardDetailsModalProps {
  card: OptimisticCard
  boardMembers: { id: number; name: string; email: string }[]
  boardLabels: string[]          // all labels available on this board
  onClose: () => void
  onUpdate: (cardId: number, updates: {
    title?: string
    description?: string
    dueDate?: string
    labels?: string[]
    assignees?: number[]
  }) => void
  onDelete: () => void
}

// Color assigned per label deterministically so it's stable
const LABEL_COLORS = [
  'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-500',
  'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
]

function getLabelColor(label: string, allLabels: string[]) {
  const idx = allLabels.indexOf(label)
  return LABEL_COLORS[(idx >= 0 ? idx : label.length) % LABEL_COLORS.length]
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
      {children}
    </label>
  )
}

export default function CardDetailsModal({
  card,
  boardMembers,
  boardLabels,
  onClose,
  onUpdate,
  onDelete,
}: CardDetailsModalProps) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || '')
  const [dueDate, setDueDate] = useState(card.dueDate ? card.dueDate.split('T')[0] : '')
  const [selectedLabels, setSelectedLabels] = useState<string[]>(card.labels || [])
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>(card.assignees || [])
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // New label creation
  const [newLabelInput, setNewLabelInput] = useState('')
  const [showNewLabelInput, setShowNewLabelInput] = useState(false)
  const newLabelRef = useRef<HTMLInputElement>(null)

  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(true)
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  useEffect(() => {
    const changed =
      title !== card.title ||
      description !== (card.description || '') ||
      dueDate !== (card.dueDate ? card.dueDate.split('T')[0] : '') ||
      JSON.stringify(selectedLabels) !== JSON.stringify(card.labels || []) ||
      JSON.stringify(selectedAssignees) !== JSON.stringify(card.assignees || [])
    setHasChanges(changed)
  }, [title, description, dueDate, selectedLabels, selectedAssignees, card])

  useEffect(() => {
    const loadComments = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`/api/cards/${card.id}/comments`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          const data = await response.json()
          setComments(data.comments)
        }
      } catch (err) {
        console.error('Failed to load comments:', err)
      } finally {
        setLoadingComments(false)
      }
    }
    loadComments()
  }, [card.id])

  useEffect(() => {
    if (showNewLabelInput) newLabelRef.current?.focus()
  }, [showNewLabelInput])

  const handleSave = () => {
    if (!hasChanges) return
    const updates: any = {}
    if (title !== card.title && title.trim()) updates.title = title.trim()
    if (description !== (card.description || '')) updates.description = description.trim()
    if (dueDate !== (card.dueDate ? card.dueDate.split('T')[0] : '')) updates.dueDate = dueDate || null
    if (JSON.stringify(selectedLabels) !== JSON.stringify(card.labels || [])) updates.labels = selectedLabels
    if (JSON.stringify(selectedAssignees) !== JSON.stringify(card.assignees || [])) updates.assignees = selectedAssignees
    if (Object.keys(updates).length > 0) {
      onUpdate(card.id, updates)
      setHasChanges(false)
      onClose()
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || submittingComment) return
    setSubmittingComment(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/cards/${card.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newComment.trim() }),
      })
      if (response.ok) {
        const data = await response.json()
        setComments([...comments, data.comment])
        setNewComment('')
      }
    } catch (err) {
      console.error('Failed to add comment:', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Delete this comment?')) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/cards/${card.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) setComments(comments.filter(c => c.id !== commentId))
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  const toggleLabel = (label: string) =>
    setSelectedLabels(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )

  // Create a new label and immediately select it
  const handleCreateLabel = () => {
    const trimmed = newLabelInput.trim()
    if (!trimmed) return
    if (!selectedLabels.includes(trimmed)) {
      setSelectedLabels(prev => [...prev, trimmed])
    }
    setNewLabelInput('')
    setShowNewLabelInput(false)
  }

  // Remove label from this card only (deselect + remove from available if it was custom)
  const handleRemoveLabel = (label: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedLabels(prev => prev.filter(l => l !== label))
  }

  const toggleAssignee = (userId: number) =>
    setSelectedAssignees(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )

  const handleDelete = () => {
    if (confirm('Delete this card? This cannot be undone.')) { onDelete(); onClose() }
  }

  const isOverdue = dueDate && new Date(dueDate) < new Date()

  // Merge board labels with any labels selected on this card (covers custom ones added elsewhere)
  const allAvailableLabels = Array.from(new Set([...boardLabels, ...selectedLabels])).sort()

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto py-6 sm:py-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (!hasChanges || confirm('You have unsaved changes. Close anyway?')) onClose()
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 flex flex-col max-h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { setIsEditingTitle(false); handleSave() }
                    if (e.key === 'Escape') { setTitle(card.title); setIsEditingTitle(false) }
                  }}
                  autoFocus
                  className="w-full text-base font-semibold px-2 py-1 border border-indigo-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              ) : (
                <h2
                  className="text-base font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 px-2 py-1 -mx-2 rounded-lg transition-colors"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {title}
                </h2>
              )}
              {card.createdByName && (
                <p className="text-xs text-gray-400 mt-0.5 px-2">by {card.createdByName}</p>
              )}
            </div>
            <button
              onClick={() => {
                if (!hasChanges || confirm('You have unsaved changes. Close anyway?')) onClose()
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg flex-shrink-0"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Due Date */}
          <div>
            <SectionLabel>Due date</SectionLabel>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {isOverdue && <p className="text-xs text-red-500 mt-1">Overdue</p>}
          </div>

          {/* Labels */}
          <div>
            <SectionLabel>Labels</SectionLabel>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {allAvailableLabels.map((label) => {
                const isSelected = selectedLabels.includes(label)
                return (
                  <div key={label} className="relative group/label">
                    <button
                      onClick={() => toggleLabel(label)}
                      className={`pl-2.5 pr-6 py-1 rounded-full text-xs font-medium transition-all ${
                        isSelected
                          ? `${getLabelColor(label, allAvailableLabels)} ring-1 ring-inset ring-current/20`
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {isSelected && (
                        <span className="mr-1 opacity-70">✓</span>
                      )}
                      {label}
                    </button>
                    {/* Delete label from card */}
                    {isSelected && (
                      <button
                        onClick={(e) => handleRemoveLabel(label, e)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center rounded-full text-[10px] leading-none opacity-50 hover:opacity-100 transition-opacity"
                        title={`Remove "${label}" from card`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Add new label */}
              {showNewLabelInput ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={newLabelRef}
                    type="text"
                    value={newLabelInput}
                    onChange={(e) => setNewLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCreateLabel() }
                      if (e.key === 'Escape') { setShowNewLabelInput(false); setNewLabelInput('') }
                    }}
                    placeholder="Label name…"
                    maxLength={30}
                    className="px-2 py-0.5 text-xs border border-indigo-400 rounded-full focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-28"
                  />
                  <button
                    onClick={handleCreateLabel}
                    disabled={!newLabelInput.trim()}
                    className="px-2 py-0.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs rounded-full disabled:opacity-40 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setShowNewLabelInput(false); setNewLabelInput('') }}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewLabelInput(true)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                >
                  + New label
                </button>
              )}
            </div>
          </div>

          {/* Assignees */}
          <div>
            <SectionLabel>Assigned to</SectionLabel>
            {boardMembers.length === 0 ? (
              <p className="text-sm text-gray-400">No members — invite someone to this board first.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {boardMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => toggleAssignee(member.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      selectedAssignees.includes(member.id)
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      selectedAssignees.includes(member.id) ? 'bg-white/20' : 'bg-gray-300 dark:bg-gray-500 text-gray-700 dark:text-gray-200'
                    }`}>
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                    {member.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <SectionLabel>Description</SectionLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a more detailed description…"
              rows={4}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none placeholder-gray-400"
            />
          </div>

          {/* Comments */}
          <div>
            <SectionLabel>Comments {comments.length > 0 && `(${comments.length})`}</SectionLabel>
            <form onSubmit={handleAddComment} className="mb-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment…"
                rows={2}
                disabled={submittingComment}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none placeholder-gray-400"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submittingComment}
                className="mt-2 px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submittingComment ? 'Posting…' : 'Post'}
              </button>
            </form>
            <div className="space-y-2.5 max-h-52 overflow-y-auto">
              {loadingComments ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-gray-400">No comments yet</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{comment.userName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">
                          {new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <button onClick={() => handleDeleteComment(comment.id)}
                          className="text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 text-base leading-none transition-colors">
                          ×
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div>
              <SectionLabel>Created</SectionLabel>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {new Date(card.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div>
              <SectionLabel>Last updated</SectionLabel>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {new Date(card.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <button onClick={handleDelete} className="text-sm text-red-400 hover:text-red-500 transition-colors">
              Delete card…
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {hasChanges ? 'Save changes' : 'No changes'}
          </button>
          <button
            onClick={() => {
              if (!hasChanges || confirm('You have unsaved changes. Close anyway?')) onClose()
            }}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}