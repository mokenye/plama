import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { apiBase, boardsApi } from '../../services/api'

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

// A single compact trigger that opens a small popover with both invite
// options. Keeps the header from getting crowded at narrow widths.
export default function InviteMember({ boardId, onMemberAdded }: InviteMemberProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [message, setMessage]   = useState('')
  const [linkStatus, setLinkStatus] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const close = () => { setOpen(false); setEmail(''); setMessage('') }

  // Anchor the popover to the button so it renders above the board
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const WIDTH = 256
      const MARGIN = 8
      const idealLeft = rect.right + window.scrollX - WIDTH
      setPos({
        top: rect.bottom + window.scrollY + 6,
        left: Math.max(MARGIN, Math.min(idealLeft, window.innerWidth - WIDTH - MARGIN)),
      })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) close()
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [open])

  const handleCopyLink = async () => {
    setLinkStatus('loading')
    try {
      const { token } = await boardsApi.getInviteLink(boardId)
      const url = `${window.location.origin}/join/${token}`
      await navigator.clipboard.writeText(url)
      setLinkStatus('copied')
      setTimeout(() => setLinkStatus('idle'), 2000)
    } catch {
      setLinkStatus('error')
      setTimeout(() => setLinkStatus('idle'), 2000)
    }
  }

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
      setTimeout(close, 1500)
    } catch {
      setMessage('Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        title="Invite people to this board"
        aria-expanded={open}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, width: 256, zIndex: 9999 }}
          className="rounded-xl border border-white/10 bg-[#181a24] shadow-2xl p-3"
        >
          <button
            onClick={handleCopyLink}
            className="w-full text-left px-3 py-2 rounded-lg text-sm bg-white/[0.06] hover:bg-white/[0.1] text-white transition mb-2"
          >
            {linkStatus === 'loading' ? 'Copying…' : linkStatus === 'copied' ? '✓ Link copied' : linkStatus === 'error' ? 'Failed to copy' : '🔗 Copy invite link'}
          </button>

          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-white/25 uppercase tracking-wider">or by email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleInvite} className="flex items-center gap-1.5">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@email.com"
              disabled={loading}
              className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
            <button type="submit" disabled={loading}
              className="flex-shrink-0 px-2.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition disabled:opacity-50">
              {loading ? '…' : 'Add'}
            </button>
          </form>
          {message && (
            <p className={`mt-2 text-xs ${message.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
              {message}
            </p>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
