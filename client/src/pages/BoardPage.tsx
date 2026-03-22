import { useParams, useNavigate, Link } from 'react-router-dom'
import { useBoard } from '../hooks/useBoard'
import { useAuthStore } from '../store'
import BoardView from '../components/Board/BoardView'
import InviteMember from '../components/Board/InviteMember'
import BoardSettings from '../components/Board/BoardSettings'
import { useEffect, useState, useCallback } from 'react'
import { useUndo } from '../hooks/useUndo'
import UndoToast from '../components/UI/UndoToast'
import ActivityLog from '../components/Activity/ActivityLog'
import SearchFilters from '../components/Search/SearchFilters'
import { useCardFilters } from '../hooks/useCardFilters'
import { useBoardLabels } from '../hooks/useBoardLabels'
import NotificationBell from '../components/Notifications/NotificationBell'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import ShortcutsHelp from '../components/Shortcuts/ShortcutsHelp'
import { getSocket } from '../services/socket'

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('darkMode') === 'true'
    return false
  })

  const [showSettings, setShowSettings] = useState(false)
  const [boardTitle, setBoardTitle] = useState('')
  const [boardColor, setBoardColor] = useState('')
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)

  const {
    board, lists, cards, members, activeUsers,
    isLoading, error, connectionStatus, userRole,
    createCard, updateCard, moveCard, deleteCard,
    createList, deleteList, getCardsForList,
    reorderCards, moveList, addMember, removeMember,
  } = useBoard(parseInt(boardId || '0'))

  const {
    searchTerm, setSearchTerm, filters, setFilters,
    filteredCards, hasActiveFilters,
  } = useCardFilters(cards)

  const boardLabels = useBoardLabels(cards)
  const { pendingActions, scheduleAction } = useUndo()

  const handleDeleteCard = useCallback((cardId: number, listId: number) => {
    scheduleAction('Card deleted', () => deleteCard(cardId, listId))
  }, [scheduleAction, deleteCard])

  const handleDeleteList = useCallback((listId: number) => {
    const list = lists.find((l: { id: number; title: string }) => l.id === listId)
    const cardCount = cards.filter((c: { listId: number }) => c.listId === listId).length
    scheduleAction(
      `List "${list?.title ?? ''}" and ${cardCount} card${cardCount !== 1 ? 's' : ''} deleted`,
      () => deleteList(listId)
    )
  }, [scheduleAction, deleteList, lists, cards])

  const getFilteredCardsForList = useCallback(
    (listId: number) =>
      filteredCards.filter(c => c.listId === listId).sort((a, b) => a.position - b.position),
    [filteredCards]
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    if (board) {
      setBoardTitle(board.title)
      setBoardColor(board.backgroundColor || '#0052CC')
    }
  }, [board])

  // Real-time: update title/color when owner changes them
  // Depends on board so it re-runs after socket is initialised
  useEffect(() => {
    if (!board) return
    let s: ReturnType<typeof getSocket> | null = null
    try { s = getSocket() } catch { return }
    const onBoardUpdated = ({ title, backgroundColor }: { boardId: number; title: string; backgroundColor: string }) => {
      setBoardTitle(title)
      setBoardColor(backgroundColor)
    }
    s.on('board-updated', onBoardUpdated)
    return () => { s?.off('board-updated', onBoardUpdated) }
  }, [board])

  useKeyboardShortcuts([
    { key: '?', description: 'Show keyboard shortcuts', handler: () => setShowShortcutsHelp(true) },
    { key: 'd', description: 'Toggle dark mode', handler: () => setDarkMode(!darkMode) },
    { key: 'a', description: 'Toggle activity log', handler: () => setShowActivityLog(!showActivityLog) },
    { key: 's', description: 'Open board settings', handler: () => setShowSettings(!showSettings) },
    {
      key: '/',
      description: 'Focus search',
      handler: () => {
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        searchInput?.focus()
      },
    },
    {
      key: 'n',
      description: 'Add card to first list',
      handler: () => (document.querySelector('[data-add-card]') as HTMLButtonElement)?.click(),
    },
    {
      key: 'l',
      description: 'Add new list',
      handler: () => (document.querySelector('[data-add-list]') as HTMLButtonElement)?.click(),
    },
    {
      key: 'f',
      description: 'Toggle filters',
      handler: () => (document.querySelector('[data-filter-toggle]') as HTMLButtonElement)?.click(),
    },
    { key: 'h', shift: true, description: 'Go to dashboard', handler: () => navigate('/') },
    {
      key: 'Escape',
      description: 'Close modals',
      handler: () => { setShowActivityLog(false); setShowSettings(false); setShowShortcutsHelp(false) },
    },
  ], !isLoading)

  const handleLogout = () => { clearAuth(); navigate('/login') }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-7 w-7 animate-spin rounded-full border-[3px] border-solid border-indigo-500 border-r-transparent mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading board…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 text-center max-w-sm">
          <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4 text-red-500 font-bold text-lg">!</div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Failed to load board</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{error}</p>
          <Link to="/" className="inline-block px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm rounded-lg transition-colors">
            ← Back to boards
          </Link>
        </div>
      </div>
    )
  }

  if (!board) return null

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: boardColor }}>

      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-black/10 flex-shrink-0">
        {/* Main row */}
        <div className="flex items-center gap-2 h-12 px-3 sm:px-4">

          {/* Back */}
          <Link
            to="/"
            className="flex items-center gap-1 text-white/70 hover:text-white transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span className="hidden sm:inline text-xs font-medium">Boards</span>
          </Link>

          <div className="w-px h-4 bg-white/20 flex-shrink-0" />

          {/* Board title */}
          <h1 className="text-white font-semibold text-sm truncate flex-shrink min-w-0 max-w-[160px] sm:max-w-[200px] md:max-w-[280px] overflow-hidden">
            {boardTitle}
          </h1>

          {/* Member avatars — hidden on mobile */}
          {members.length > 0 && (
            <div className="hidden sm:flex items-center flex-shrink-0 -space-x-1.5">
              {(() => {
                const MAX = 4
                const sorted = [...members].sort((a, b) => {
                  const aUser = activeUsers.find((u: { id: number; away?: boolean }) => u.id === a.id)
                  const bUser = activeUsers.find((u: { id: number; away?: boolean }) => u.id === b.id)
                  const aScore = aUser ? (aUser.away ? 1 : 2) : 0
                  const bScore = bUser ? (bUser.away ? 1 : 2) : 0
                  return bScore - aScore
                })
                const visible = sorted.slice(0, MAX)
                const overflow = sorted.length - MAX
                return (
                  <>
                    {visible.map((member, i) => {
                      const activeUser = activeUsers.find((u: { id: number; away?: boolean }) => u.id === member.id)
                      const isOnline = !!activeUser && !activeUser.away
                      const isAway   = !!activeUser && !!activeUser.away
                      const initials = member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                      return (
                        <div
                          key={member.id}
                          title={`${member.name}${isOnline ? ' (online)' : isAway ? ' (away)' : ''}`}
                          style={{ zIndex: MAX - i }}
                          className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-black/20 ${
                            isOnline ? 'bg-white text-gray-800' : isAway ? 'bg-white/50 text-gray-600 opacity-60' : 'bg-white/15 text-white/35 opacity-40'
                          }`}
                        >
                          {initials}
                          {isOnline && <span className="absolute -bottom-px -right-px w-1.5 h-1.5 bg-green-400 rounded-full border border-black/20" />}
                        </div>
                      )
                    })}
                    {overflow > 0 && (
                      <div style={{ zIndex: 0 }} title={sorted.slice(MAX).map(m => m.name).join(', ')}
                        className="relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-black/20 bg-white/10 text-white/50">
                        +{overflow}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Search — hidden on mobile, fills remaining space on sm+ */}
          <div className="hidden sm:block flex-1 min-w-0">
            <SearchFilters
              onSearchChange={setSearchTerm}
              onFilterChange={setFilters}
              members={members}
              currentFilters={filters}
              boardLabels={boardLabels}
            />
          </div>

          {/* On mobile: spacer pushes actions right since search is hidden */}
          <div className="flex-1 sm:hidden" />

          {/* Right actions */}
          <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
            {/* Search icon on mobile — tapping focuses search below */}
            <button
              className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Search"
              onClick={() => {
                const el = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
                el?.focus()
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>

            {/* Notifications */}
            <div className="w-8 h-8 flex items-center justify-center text-white/70 [&_button]:text-white/70 [&_button:hover]:text-white [&_svg]:stroke-current">
              <NotificationBell />
            </div>

            {/* Dark mode */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Toggle dark mode"
            >
              {darkMode ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            {/* Invite — sm+ only */}
            <div className="hidden sm:block">
              <InviteMember boardId={board.id} onMemberAdded={(member) => addMember({ ...member, role: member.role as 'owner' | 'member' })} />
            </div>

            {/* Activity log — md+ only */}
            <button
              onClick={() => setShowActivityLog(true)}
              className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Activity log"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Board settings"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>

            {/* Divider */}
            <div className="hidden sm:block w-px h-4 bg-white/20 mx-1" />

            {/* Username + Sign out — rightmost, hidden on mobile */}
            <span className="hidden lg:inline text-xs text-white/50 max-w-[100px] truncate">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="hidden sm:block px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-md text-xs font-medium transition-colors"
            >
              Sign out
            </button>
          </div>

        </div>

        {/* Mobile search row — only visible on small screens */}
        <div className="sm:hidden px-3 pb-2">
          <SearchFilters
            onSearchChange={setSearchTerm}
            onFilterChange={setFilters}
            members={members}
            currentFilters={filters}
          />
        </div>
      </header>

      {/* Board content — fills remaining height, BoardView handles its own scroll */}
      <div className="flex-1 overflow-hidden min-h-0">
        <BoardView
          boardId={board.id}
          currentUserId={user?.id ?? 0}
          lists={lists}
          cards={filteredCards}
          boardMembers={members}
          boardLabels={boardLabels}
          getCardsForList={getFilteredCardsForList}
          onCreateCard={createCard}
          onUpdateCard={updateCard}
          onMoveCard={moveCard}
          onReorderCards={reorderCards}
          onMoveList={moveList}
          onDeleteCard={handleDeleteCard}
          onCreateList={createList}
          onDeleteList={handleDeleteList}
        />
      </div>
      <UndoToast actions={pendingActions} />

      {hasActiveFilters && filteredCards.length === 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 px-5 py-2.5 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">No cards match your filters.</p>
        </div>
      )}

      {showSettings && (
        <BoardSettings
          boardId={board.id}
          currentTitle={boardTitle}
          currentColor={boardColor}
          isOwner={userRole === 'owner'}
          members={members}
          currentUserId={user?.id ?? 0}
          onClose={() => setShowSettings(false)}
          onUpdate={(newTitle, newColor) => { setBoardTitle(newTitle); setBoardColor(newColor) }}
          onMemberRemoved={(userId) => removeMember(userId)}
        />
      )}

      <ActivityLog boardId={board.id} isOpen={showActivityLog} onClose={() => setShowActivityLog(false)} />
      {/* Shortcuts hint — bottom-right corner */}
      <button
        onClick={() => setShowShortcutsHelp(true)}
        className="fixed bottom-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-white shadow-sm transition-colors z-50"
        title="Keyboard shortcuts (?)"
      >
        <span className="font-mono text-sm leading-none">?</span>
      </button>

      <ShortcutsHelp isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />
    </div>
  )
}