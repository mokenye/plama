import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAuthStore } from '../store'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user, token } = await authApi.login({ email, password })
      setAuth(user, token)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0c0e13' }}>
      <div className="fixed top-[-10%] left-[30%] w-[500px] h-[400px] pointer-events-none rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 65%)' }} />
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }} />

      <div className="relative z-10 w-full max-w-sm">
        <Link to="/">
          <div className="flex items-center justify-center gap-2 mb-10 cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center font-black text-sm text-white">
              P
            </div>
            <span className="text-base font-bold tracking-tight text-white/70">plama</span>
          </div>
        </Link>
        
        <div className="rounded-2xl border border-white/[0.07] p-8"
          style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>

          <div className="mb-7">
            <h1 className="text-xl font-black tracking-tight text-white/90 mb-1"
              style={{ fontFamily: 'Georgia, serif' }}>Welcome back</h1>
            <p className="text-sm text-white/30">Sign in to your workspace</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.08] text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] focus:border-indigo-500/50 focus:outline-none text-sm text-white placeholder-white/20 disabled:opacity-40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] focus:border-indigo-500/50 focus:outline-none text-sm text-white placeholder-white/20 disabled:opacity-40 transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition text-sm shadow-[0_0_20px_rgba(99,102,241,0.25)]"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-white/25">
          No account?{' '}
          <Link to="/register" className="text-indigo-400/80 hover:text-indigo-300 transition">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  )
}