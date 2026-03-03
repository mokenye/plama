import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { boardsApi } from '../services/api'
import { useAuthStore, useBoardsStore } from '../store'
import NotificationBell from '../components/Notifications/NotificationBell'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import ShortcutsHelp from '../components/Shortcuts/ShortcutsHelp'

const PlamaLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8 flex-shrink-0">
    <rect width="100" height="100" rx="18" fill="#6366F1"/>
    <text x="50%" y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fontSize="55"
          fontWeight="900"
          fill="white"
          fontFamily="Arial, Helvetica, sans-serif">
      P
    </text>
  </svg>
)

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  
  const { boards, isLoading, error, setBoards, addBoard, setLoading, setError } = useBoardsStore()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true'
    }
    return false
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', 'false')
    }
  }, [darkMode])

  useEffect(() => {
    const loadBoards = async () => {
      setLoading(true)
      setError(null)
      try {
        const { boards } = await boardsApi.getAll()
        setBoards(boards)
      } catch (err: any) {
        const errorMsg = err.response?.data?.error || err.message || 'Failed to load boards'
        console.error('Dashboard load error:', err)
        setError(errorMsg)
      } finally {
        setLoading(false)
      }
    }
    loadBoards()
  }, [])

  useKeyboardShortcuts([
    { key: '?', description: 'Show keyboard shortcuts', handler: () => setShowShortcutsHelp(true) },
    { key: 'd', description: 'Toggle dark mode', handler: () => setDarkMode(!darkMode) },
    { key: 'n', description: 'Create new board', handler: () => setShowCreateForm(true) },
    { key: 'h', shift: true, description: 'Go to dashboard', handler: () => navigate('/') },
    {
      key: 'Escape',
      description: 'Close modals',
      handler: () => { setShowCreateForm(false); setShowShortcutsHelp(false) },
    },
  ])

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBoardTitle.trim()) return
    setCreating(true)
    try {
      const { board } = await boardsApi.create({ title: newBoardTitle.trim() })
      addBoard(board)
      setNewBoardTitle('')
      setShowCreateForm(false)
      navigate(`/board/${board.id}`)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create board')
    } finally {
      setCreating(false)
    }
  }

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-7 w-7 animate-spin rounded-full border-[3px] border-solid border-indigo-500 border-r-transparent mb-4"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading boards…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 text-center max-w-sm w-full">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-xl">!</span>
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Failed to load boards</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm rounded-lg transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex justify-between items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <PlamaLogo />
            <span className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">Plama</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="Toggle dark mode"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            {/* Notifications — wrapped to ensure icon contrast */}
            <div className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors [&_button]:text-gray-500 dark:[&_button]:text-gray-400 [&_button:hover]:text-gray-900 dark:[&_button:hover]:text-white [&_svg]:stroke-current">
              <NotificationBell />
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

            {/* User name */}
            <span className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 max-w-[140px] truncate px-1">
              {user?.name}
            </span>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="ml-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page heading */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your boards</h2>
            {boards.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{boards.length} board{boards.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New board
          </button>
        </div>

        {/* Create board form */}
        {showCreateForm && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-8 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">New board</h3>
            <form onSubmit={handleCreateBoard} className="space-y-3">
              <input
                type="text"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="Board title…"
                autoFocus
                disabled={creating}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50 transition-shadow"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating || !newBoardTitle.trim()}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setNewBoardTitle('') }}
                  disabled={creating}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Boards grid */}
        {boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No boards yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Create your first board to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/board/${board.id}`}
                className="group relative block p-5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg overflow-hidden"
                style={{ backgroundColor: board.backgroundColor || '#6366F1' }}
              >
                {/* subtle inner glow */}
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 group-hover:ring-white/20 transition-all" />
                <h3 className="relative text-sm font-semibold text-white mb-3 group-hover:underline underline-offset-2 line-clamp-2">
                  {board.title}
                </h3>
                {board.description && (
                  <p className="relative text-xs text-white/75 mb-3 line-clamp-2">{board.description}</p>
                )}
                <div className="relative flex items-center gap-1.5 text-xs text-white/60">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  {board.memberCount || 1} {(board.memberCount || 1) === 1 ? 'member' : 'members'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <ShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </div>
  )
}