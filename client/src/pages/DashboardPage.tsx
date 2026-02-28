import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { boardsApi } from '../services/api'
import { useAuthStore, useBoardsStore } from '../store'

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  
  const { boards, isLoading, error, setBoards, addBoard, setLoading, setError } = useBoardsStore()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true'
    }
    return false
  })

  // Dark mode toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', 'false')
    }
  }, [darkMode])

  // Load boards on mount
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
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-500 border-r-transparent mb-4"></div>
          <div className="text-gray-600 dark:text-gray-400">Loading boards...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to load boards</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📋</div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Kanban Collab</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Toggle dark mode"
            >
              {darkMode ? '🌞' : '🌙'}
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Boards</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition shadow-lg hover:shadow-xl"
          >
            + Create Board
          </button>
        </div>

        {/* Create board form */}
        {showCreateForm && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-8 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Board
            </h3>
            <form onSubmit={handleCreateBoard} className="space-y-4">
              <input
                type="text"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="Board title..."
                autoFocus
                disabled={creating}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating || !newBoardTitle.trim()}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewBoardTitle('')
                  }}
                  disabled={creating}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Boards grid */}
        {boards.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 p-16 rounded-xl text-center border-2 border-dashed border-gray-300 dark:border-gray-600">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No boards yet</h3>
            <p className="text-gray-600 dark:text-gray-400">Create your first board to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/board/${board.id}`}
                className="group block p-6 rounded-xl transition transform hover:-translate-y-1 hover:shadow-xl"
                style={{ backgroundColor: board.backgroundColor || '#0052CC' }}
              >
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:underline">
                  {board.title}
                </h3>
                {board.description && (
                  <p className="text-sm text-white/90 mb-4 line-clamp-2">
                    {board.description}
                  </p>
                )}
                <div className="text-xs text-white/80">
                  {board.memberCount || 1} {board.memberCount === 1 ? 'member' : 'members'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}