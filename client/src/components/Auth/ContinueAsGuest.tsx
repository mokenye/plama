import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store'

export const GUEST_NOTICE_KEY = 'plama_guest_notice'

interface Props {
  variant?: 'button' | 'text' | 'muted'
  className?: string
}

export default function ContinueAsGuest({ variant = 'button', className = '' }: Props) {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const alreadyGuest = useAuthStore((s) => s.user?.isGuest)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (alreadyGuest) return null

  const startGuest = async () => {
    setError('')
    setLoading(true)
    try {
      const { user, token } = await authApi.guest()
      setAuth(user, token)
      sessionStorage.setItem(GUEST_NOTICE_KEY, 'pending')
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not start guest mode')
    } finally {
      setLoading(false)
    }
  }

  const styles =
    variant === 'button'
      ? 'inline-flex items-center gap-2 px-5 py-3 border border-white/15 hover:border-white/30 text-white/80 hover:text-white font-medium rounded-xl transition-all text-sm'
      : variant === 'muted'
        ? 'text-sm text-white/35 hover:text-white/70 transition'
        : 'text-sm text-indigo-400/80 hover:text-indigo-300 transition'

  return (
    <span className={`inline-flex flex-col items-start ${className}`}>
      <button type="button" onClick={startGuest} disabled={loading} className={`${styles} disabled:opacity-40`}>
        {loading ? 'Entering…' : 'Continue as guest'}
      </button>
      {error && <span className="mt-1.5 text-xs text-red-400">{error}</span>}
    </span>
  )
}
