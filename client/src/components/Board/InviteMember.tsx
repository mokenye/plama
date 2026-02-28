import { useState } from 'react'

interface InviteMemberProps {
  boardId: number
  onMemberAdded: () => void
}

export default function InviteMember({ boardId, onMemberAdded }: InviteMemberProps) {
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setMessage('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/boards/${boardId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.error || 'Failed to add member')
        return
      }

      setMessage(`✓ ${data.message}`)
      setEmail('')
      setTimeout(() => {
        setShowForm(false)
        setMessage('')
        onMemberAdded()
      }, 2000)
    } catch (err) {
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
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@email.com"
          autoFocus
          disabled={loading}
          className="px-3 py-1 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-48 focus:ring-2 focus:ring-white/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm transition disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowForm(false)
            setEmail('')
            setMessage('')
          }}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition"
        >
          Cancel
        </button>
      </form>
      {message && (
        <div className={`absolute top-full mt-2 left-0 text-xs px-3 py-1 rounded-lg ${
          message.startsWith('✓') 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}