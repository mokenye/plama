import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { boardsApi } from '../services/api'
import { useAuthStore, useBoardsStore } from '../store'
import type { Board } from '../types'

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  
  const { boards, isLoading, error, setBoards, addBoard, setLoading, setError } = useBoardsStore()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [creating, setCreating] = useState(false)

  // Load boards on mount
  useEffect(() => {
    const loadBoards = async () => {
      setLoading(true)
      try {
        const { boards } = await boardsApi.getAll()
        setBoards(boards)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load boards')
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
      // Redirect to new board
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
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div>Loading boards...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid #ddd',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>Kanban Collab</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {user?.name}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ padding: '40px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Your Boards</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '10px 20px',
              background: '#0052CC',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            + Create Board
          </button>
        </div>

        {error && (
          <div style={{
            background: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '24px'
          }}>
            {error}
          </div>
        )}

        {/* Create board form */}
        {showCreateForm && (
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '8px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
              Create New Board
            </h3>
            <form onSubmit={handleCreateBoard}>
              <input
                type="text"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="Board title..."
                autoFocus
                disabled={creating}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  marginBottom: '12px',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  disabled={creating || !newBoardTitle.trim()}
                  style={{
                    padding: '8px 16px',
                    background: creating || !newBoardTitle.trim() ? '#ccc' : '#0052CC',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: creating || !newBoardTitle.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
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
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Boards grid */}
        {boards.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '60px',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#666'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <div style={{ fontSize: '18px', marginBottom: '8px' }}>No boards yet</div>
            <div style={{ fontSize: '14px' }}>Create your first board to get started</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/board/${board.id}`}
                style={{
                  background: board.backgroundColor || '#0052CC',
                  color: 'white',
                  padding: '24px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'block',
                  transition: 'transform 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  {board.title}
                </div>
                {board.description && (
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '12px' }}>
                    {board.description}
                  </div>
                )}
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
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
