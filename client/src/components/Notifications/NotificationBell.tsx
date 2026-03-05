import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { getSocket } from '../../services/socket'
import { apiBase } from '../../services/api'

interface Notification {
  id: number
  userId: number
  boardId?: number
  cardId?: number
  type: string
  title: string
  message: string
  read: boolean
  link?: string
  createdAt: string
}

const TYPE_ICONS: Record<string, string> = {
  assigned: '📌',
  comment_added: '💬',
  card_moved: '↗️',
  card_updated: '✏️',
  mentioned: '@',
  due_soon: '⏰',
  board_invite: '🎉',
}

const DROPDOWN_WIDTH = 320
const SCREEN_MARGIN = 8

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const getToken = () => localStorage.getItem('token')

  // ── Fetch helpers ──────────────────────────────────────────────────────
  const loadUnreadCount = async () => {
    try {
      const res = await fetch(`${apiBase}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count)
      }
    } catch (err) {
      console.error('Failed to load unread count:', err)
    }
  }

  const loadNotifications = async () => {
    try {
      const res = await fetch(`${apiBase}/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
        setUnreadCount(data.notifications.filter((n: Notification) => !n.read).length)
      }
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
  }

  const markAsRead = async (id: number) => {
    try {
      await fetch(`${apiBase}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch(`${apiBase}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const deleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`${apiBase}/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const removed = notifications.find(n => n.id === id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (removed && !removed.read) setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id)
    if (n.link) { navigate(n.link); setShowDropdown(false) }
  }

  // ── Bell click ─────────────────────────────────────────────────────────
  const handleBellClick = () => {
    if (!showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const idealLeft = rect.right - DROPDOWN_WIDTH
      setDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: Math.max(SCREEN_MARGIN, Math.min(idealLeft, window.innerWidth - DROPDOWN_WIDTH - SCREEN_MARGIN)),
      })
    }
    setShowDropdown(prev => !prev)
  }

  // ── Socket: instant badge on new notification ──────────────────────────
  useEffect(() => {
    // Grab the existing socket if available — don't create a new one
    let s: ReturnType<typeof getSocket> | null = null
    try { s = getSocket() } catch { /* socket not yet initialised */ }
    if (!s) return

    const onNewNotification = (notification: Notification) => {
      // Prepend to list if dropdown is open, always bump badge
      setNotifications(prev => {
        if (prev.some(n => n.id === notification.id)) return prev
        return [notification, ...prev]
      })
      if (!notification.read) setUnreadCount(prev => prev + 1)
    }

    s.on('notification', onNewNotification)
    return () => { s?.off('notification', onNewNotification) }
  }, [])

  // ── Poll every 10s for badge count (fallback if socket misses events) ──
  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 10_000)
    return () => clearInterval(interval)
  }, [])

  // ── Load full list when dropdown opens ────────────────────────────────
  useEffect(() => {
    if (showDropdown) {
      setLoading(true)
      loadNotifications().finally(() => setLoading(false))
    }
  }, [showDropdown])

  // ── Close on outside click ─────────────────────────────────────────────
  useEffect(() => {
    if (!showDropdown) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!buttonRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  const dropdown = showDropdown ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[480px]"
      style={{
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: Math.min(DROPDOWN_WIDTH, window.innerWidth - SCREEN_MARGIN * 2),
        zIndex: 99999,
      }}
    >
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-xs font-medium text-white bg-red-500 rounded-full px-1.5 py-0.5">
              {unreadCount}
            </span>
          )}
        </span>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium transition">
            Mark all read
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
        {loading ? (
          <div className="flex items-center justify-center h-28">
            <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 text-gray-400 dark:text-gray-500">
            <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-xs">No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!n.read ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}
            >
              <span className="mt-0.5 text-base shrink-0">{TYPE_ICONS[n.type] ?? '📋'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{n.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{formatTimeAgo(n.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1" />}
                <button
                  onClick={e => deleteNotification(n.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 text-lg leading-none transition"
                >×</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleBellClick}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 leading-none pointer-events-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {dropdown}
    </>
  )
}

function formatTimeAgo(dateString: string): string {
  // Ensure the string is parsed as UTC — PostgreSQL TIMESTAMP (no tz) comes
  // without a 'Z' suffix, causing browsers to treat it as local time.
  // TIMESTAMPTZ sends an offset, but normalise both cases here for safety.
  const utcString = dateString.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(dateString)
    ? dateString
    : dateString + 'Z'
  const date = new Date(utcString)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}