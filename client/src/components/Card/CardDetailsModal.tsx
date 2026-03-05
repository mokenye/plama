import { useState, useEffect } from 'react'
import type { OptimisticCard, Comment as CardComment } from '../../types'
import { getSocket } from '../../services/socket'
import { apiBase } from '../../services/api'

interface CardDetailsModalProps {
  card: OptimisticCard
  boardMembers: { id: number; name: string; email: string }[]
  boardLabels: string[]
  boardId: number
  currentUserId: number
  onClose: () => void
  onUpdate: (cardId: number, updates: { title?: string; description?: string; dueDate?: string; labels?: string[]; assignees?: number[] }) => void
  onDelete: () => void
}

const PRESET_LABELS = [
  { name: 'Bug', color: 'bg-red-500' },
  { name: 'Feature', color: 'bg-blue-500' },
  { name: 'Urgent', color: 'bg-orange-500' },
  { name: 'Low Priority', color: 'bg-gray-500' },
  { name: 'Design', color: 'bg-purple-500' },
  { name: 'Backend', color: 'bg-green-500' },
  { name: 'Frontend', color: 'bg-cyan-500' },
  { name: 'Testing', color: 'bg-yellow-500' },
]

export default function CardDetailsModal({
  card,
  boardMembers,
  boardLabels,
  boardId,
  currentUserId,
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

  // Comments state
  const [comments, setComments] = useState<CardComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(true)
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
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

  // Load comments
  useEffect(() => {
    const loadComments = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${apiBase}/cards/${card.id}/comments`, {
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

  // Real-time: listen for comments added/deleted by other users
  useEffect(() => {
    let s: ReturnType<typeof getSocket> | null = null
    try { s = getSocket() } catch { return }

    const onCommentAdded = (data: { comment: CardComment }) => {
      if (data.comment.cardId !== card.id) return
      setComments(prev =>
        prev.some(c => c.id === data.comment.id) ? prev : [...prev, data.comment]
      )
    }

    const onCommentDeleted = (data: { commentId: number; cardId: number }) => {
      if (data.cardId !== card.id) return
      setComments(prev => prev.filter(c => c.id !== data.commentId))
    }

    s.on('comment-added', onCommentAdded)
    s.on('comment-deleted', onCommentDeleted)
    return () => {
      s?.off('comment-added', onCommentAdded)
      s?.off('comment-deleted', onCommentDeleted)
    }
  }, [card.id])

  const handleSave = () => {
    if (!hasChanges) return

    const updates: any = {}
    if (title !== card.title && title.trim()) {
      updates.title = title.trim()
    }
    if (description !== (card.description || '')) {
      updates.description = description.trim()
    }
    if (dueDate !== (card.dueDate ? card.dueDate.split('T')[0] : '')) {
      updates.dueDate = dueDate || null
    }
    if (JSON.stringify(selectedLabels) !== JSON.stringify(card.labels || [])) {
      updates.labels = selectedLabels
    }
    if (JSON.stringify(selectedAssignees) !== JSON.stringify(card.assignees || [])) {
      updates.assignees = selectedAssignees
    }

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
      const response = await fetch(`${apiBase}/cards/${card.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
      const response = await fetch(`${apiBase}/cards/${card.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        setComments(comments.filter(c => c.id !== commentId))
      }
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  const toggleLabel = (label: string) => {
    if (selectedLabels.includes(label)) {
      setSelectedLabels(selectedLabels.filter(l => l !== label))
    } else {
      setSelectedLabels([...selectedLabels, label])
    }
  }

  const toggleAssignee = (userId: number) => {
    if (selectedAssignees.includes(userId)) {
      setSelectedAssignees(selectedAssignees.filter(id => id !== userId))
    } else {
      setSelectedAssignees([...selectedAssignees, userId])
    }
  }

  const handleDelete = () => {
    if (confirm('Delete this card? This cannot be undone.')) {
      onDelete()
      onClose()
    }
  }

  const isOverdue = dueDate && new Date(dueDate) < new Date() && !card.description?.includes('[DONE]')

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto py-4 sm:py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (!hasChanges || confirm('You have unsaved changes. Close anyway?')) {
            onClose()
          }
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingTitle(false)
                      handleSave()
                    }
                    if (e.key === 'Escape') {
                      setTitle(card.title)
                      setIsEditingTitle(false)
                    }
                  }}
                  autoFocus
                  className="w-full text-xl font-bold px-2 py-1 border border-brand-500 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              ) : (
                <h2 
                  className="text-xl font-bold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {title}
                </h2>
              )}
              {card.createdByName && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 px-2">
                  Created by {card.createdByName}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                if (!hasChanges || confirm('You have unsaved changes. Close anyway?')) {
                  onClose()
                }
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Due Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              📅 Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {isOverdue && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                ⚠️ Overdue!
              </p>
            )}
          </div>

          {/* Labels */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              🏷️ Labels
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_LABELS.map((label) => (
                <button
                  key={label.name}
                  onClick={() => toggleLabel(label.name)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    selectedLabels.includes(label.name)
                      ? `${label.color} text-white`
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              👥 Assigned To
            </label>
            <div className="flex flex-wrap gap-2">
              {boardMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => toggleAssignee(member.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1 ${
                    selectedAssignees.includes(member.id)
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                  {member.name}
                </button>
              ))}
              {boardMembers.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No members to assign. Invite members to this board first.
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              📝 Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a more detailed description..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              💬 Comments ({comments.length})
            </label>
            
            {/* Add comment form */}
            <form onSubmit={handleAddComment} className="mb-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
                disabled={submittingComment}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none text-sm"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submittingComment}
                className="mt-2 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submittingComment ? 'Posting...' : 'Post Comment'}
              </button>
            </form>

            {/* Comments list */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {loadingComments ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No comments yet</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {comment.userName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(comment.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        {comment.userId === currentUserId && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 text-xs transition"
                            title="Delete comment"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Created
              </label>
              <p className="text-sm text-gray-900 dark:text-white">
                {new Date(card.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Last updated
              </label>
              <p className="text-sm text-gray-900 dark:text-white">
                {new Date(card.updatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {/* Delete button */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleDelete}
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
            >
              🗑️ Delete Card
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {hasChanges ? 'Save Changes' : 'No Changes'}
          </button>
          <button
            onClick={() => {
              if (!hasChanges || confirm('You have unsaved changes. Close anyway?')) {
                onClose()
              }
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}