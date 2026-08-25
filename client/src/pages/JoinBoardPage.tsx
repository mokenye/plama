import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuthStore } from '../store'
import { authApi, boardsApi } from '../services/api'
import { GUEST_NOTICE_KEY } from '../components/Auth/ContinueAsGuest'

// Lets a link recipient join a board as a guest or a signed-in account
// without needing to already be a member.
export default function JoinBoardPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')
  const [joiningAsGuest, setJoiningAsGuest] = useState(false)

  const join = async () => {
    if (!token) return
    try {
      const { boardId } = await boardsApi.joinViaToken(token)
      navigate(`/board/${boardId}`, { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'This invite link is invalid or expired')
    }
  }

  useEffect(() => {
    if (isAuthenticated) join()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const startGuest = async () => {
    setError('')
    setJoiningAsGuest(true)
    try {
      const { user, token: authToken } = await authApi.guest()
      setAuth(user, authToken)
      sessionStorage.setItem(GUEST_NOTICE_KEY, 'pending')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not start guest mode')
      setJoiningAsGuest(false)
    }
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0c0e13' }}>
        <p className="text-white/50 text-sm">{error || 'Joining board…'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0c0e13' }}>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }} />
      <div className="relative z-10 w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center font-black text-sm text-white">P</div>
          <span className="text-base font-bold tracking-tight text-white/70">plama</span>
        </div>

        <div className="rounded-2xl border border-white/[0.07] p-8"
          style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
          <h1 className="text-lg font-bold text-white/90 mb-2">You've been invited to a board</h1>
          <p className="text-sm text-white/40 mb-6">Join instantly as a guest, or sign in to keep it with your account.</p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.08] text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={startGuest}
            disabled={joiningAsGuest}
            className="w-full mb-3 py-2.5 px-4 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-xl disabled:opacity-40 transition text-sm"
          >
            {joiningAsGuest ? 'Joining…' : 'Join as guest'}
          </button>
          <Link
            to="/login"
            state={{ from: `/join/${token}` }}
            className="block w-full py-2.5 px-4 border border-white/15 hover:border-white/30 text-white/80 hover:text-white font-medium rounded-xl transition text-sm"
          >
            Sign in to join
          </Link>
          <p className="mt-4 text-xs text-white/25">
            No account?{' '}
            <Link to="/register" state={{ from: `/join/${token}` }} className="text-indigo-400/80 hover:text-indigo-300 transition">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
