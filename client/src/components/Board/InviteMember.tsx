import { useState, useEffect, useRef } from 'react'
import { apiBase } from '../../services/api'

interface BoardMember {
  id: number
  name: string
  email: string
  role: string
}

interface InviteMemberProps {
  boardId: number
  onMemberAdded: (member: BoardMember) => void
}

export default function InviteMember({ boardId, onMemberAdded }: InviteMemberProps) {
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [message, setMessage]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleCancel = () => { setShowForm(false); setEmail(''); setMessage('') }

  useEffect(() => {
    if (!showForm) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showForm])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setMessage('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${apiBase}/boards/${boardId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await response.json()
      if (!response.ok) { setMessage(data.error || 'Failed to add member'); return }

      setMessage(`✓ ${data.message}`)
      setEmail('')
      // Pass the new member back so BoardPage can update the store immediately
      if (data.member) onMemberAdded(data.member)
      setTimeout(() => { setShowForm(false); setMessage('') }, 2000)
    } catch {
      setMessage('Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-lg text-sm transition"
      >
        + Invite
      </button>
    )
  }

  return (
    <div className="relative">
      <form onSubmit={handleInvite} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="user@email.com"
          autoFocus
          disabled={loading}
          className="px-3 py-1 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-48 focus:ring-2 focus:ring-white/50"
        />
        <button type="submit" disabled={loading}
          className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition disabled:opacity-50">
          {loading ? 'Adding…' : 'Add'}
        </button>
        <button type="button" onClick={handleCancel}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition">
          Cancel
        </button>
      </form>
      {message && (
        <div className={`absolute top-full mt-2 left-0 text-xs px-3 py-1 rounded-lg whitespace-nowrap ${
          message.startsWith('✓') ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}