import { useParams, useNavigate, Link } from 'react-router-dom'
import { useBoard } from '../hooks/useBoard'
import { useAuthStore } from '../store'
import BoardView from '../components/Board/BoardView'
import InviteMember from '../components/Board/InviteMember'
import BoardSettings from '../components/Board/BoardSettings'
import { useEffect, useState } from 'react'
import ActivityLog from '../components/Activity/ActivityLog'

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

  const [showSettings, setShowSettings] = useState(false)
  const [boardTitle, setBoardTitle] = useState('')
  const [boardColor, setBoardColor] = useState('')
  const [showActivityLog, setShowActivityLog] = useState(false)

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
    deleteList,
    getCardsForList,
  } = useBoard(parseInt(boardId || '0'))

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    if (board) {
      setBoardTitle(board.title)
      setBoardColor(board.backgroundColor || '#0052CC')
    }
  }, [board])

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
      style={{ background: boardColor }}
    >
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="px-2 sm:px-4 py-3 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Link 
              to="/" 
              className="text-white/80 hover:text-white transition text-sm flex-shrink-0"
            >
              ← Back
            </Link>
            <h1 className="text-base sm:text-lg font-bold text-white truncate">
              {boardTitle}
            </h1>
            <button
              onClick={() => setShowSettings(true)}
              className="text-white/80 hover:text-white text-sm flex-shrink-0"
              title="Board settings"
            >
              ⚙️
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Active users - show names */}
            {activeUsers.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs text-white">
                <span>👥</span>
                <span className="max-w-xs truncate">
                  {activeUsers.map(u => u.name).join(', ')}
                </span>
              </div>
            )}

            {/* Mobile: just show count */}
            {activeUsers.length > 0 && (
              <div className="sm:hidden flex items-center gap-1 px-2 py-1 bg-white/20 backdrop-blur rounded-full text-xs text-white">
                <span>👥</span>
                <span>{activeUsers.length}</span>
              </div>
            )}

            {/* Invite member - hidden on mobile */}
            <div className="hidden sm:block">
              <InviteMember 
                boardId={board.id} 
                onMemberAdded={() => {
                  console.log('Member added')
                }} 
              />
            </div>

            {/* Activity Log button */}
            <button
              onClick={() => setShowActivityLog(true)}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-lg text-sm transition"
              title="View activity log"
            >
              📋 Activity
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-white/10 transition text-white"
            >
              {darkMode ? '🌞' : '🌙'}
            </button>

            {/* User name - hidden on mobile */}
            <span className="text-sm text-white/90 hidden md:inline">
              {user?.name}
            </span>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="px-2 sm:px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs sm:text-sm transition backdrop-blur"
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
        boardMembers={members}
        getCardsForList={getCardsForList}
        onCreateCard={createCard}
        onUpdateCard={updateCard}
        onMoveCard={moveCard}
        onDeleteCard={deleteCard}
        onCreateList={createList}
        onDeleteList={deleteList}
      />

      {/* Settings Modal */}
      {showSettings && (
        <BoardSettings
          boardId={board.id}
          currentTitle={boardTitle}
          currentColor={boardColor}
          onClose={() => setShowSettings(false)}
          onUpdate={(newTitle, newColor) => {
            setBoardTitle(newTitle)
            setBoardColor(newColor)
          }}
        />
      )}

      {/* Activity Log Sidebar */}
      <ActivityLog
        boardId={board.id}
        isOpen={showActivityLog}
        onClose={() => setShowActivityLog(false)}
      />
    </div>
  )
}