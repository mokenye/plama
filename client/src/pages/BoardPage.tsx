import { useParams, useNavigate, Link } from 'react-router-dom'
import { useBoard } from '../hooks/useBoard'
import { useAuthStore } from '../store'
import BoardView from '../components/Board/BoardView'
import InviteMember from '../components/Board/InviteMember'
import { useEffect, useState } from 'react'

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true'
    }
    return false
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const {
    board,
    lists,
    cards,
    members,
    activeUsers,
    isLoading,
    error,
    connectionStatus,
    createCard,
    updateCard,
    moveCard,
    deleteCard,
    createList,
    getCardsForList,
  } = useBoard(parseInt(boardId || '0'))

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-500 border-r-transparent mb-4"></div>
          <div className="text-lg text-gray-900 dark:text-white mb-2">Loading board...</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Connecting to real-time server</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to load board</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-block px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!board) return null

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ background: board.backgroundColor || '#0052CC' }}
    >
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="text-white/80 hover:text-white transition text-sm"
            >
              ← Back
            </Link>
            <h1 className="text-lg font-bold text-white">
              {board.title}
            </h1>
            {board.description && (
              <span className="text-sm text-white/80 hidden sm:inline">
                {board.description}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Connection status */}
            {connectionStatus !== 'connected' && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                connectionStatus === 'reconnecting' 
                  ? 'bg-yellow-500 text-yellow-900' 
                  : 'bg-red-500 text-white'
              }`}>
                {connectionStatus === 'reconnecting' ? '🔄 Reconnecting...' : '⚠️ Disconnected'}
              </div>
            )}

            {/* Active users - show names */}
            {activeUsers.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs text-white">
                <span>👥</span>
                <span className="max-w-xs truncate">
                  {activeUsers.map(u => u.name).join(', ')}
                </span>
              </div>
            )}

            {/* Invite member */}
            <InviteMember 
              boardId={board.id} 
              onMemberAdded={() => {
                // Optionally refresh members list
                console.log('Member added')
              }} 
            />

            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-white/10 transition text-white"
            >
              {darkMode ? '🌞' : '🌙'}
            </button>

            <span className="text-sm text-white/90 hidden sm:inline">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition backdrop-blur"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Board content */}
      <BoardView
        lists={lists}
        cards={cards}
        getCardsForList={getCardsForList}
        onCreateCard={createCard}
        onUpdateCard={updateCard}
        onMoveCard={moveCard}
        onDeleteCard={deleteCard}
        onCreateList={createList}
      />
    </div>
  )
}