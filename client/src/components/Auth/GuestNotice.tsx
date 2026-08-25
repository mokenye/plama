import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store'
import { GUEST_NOTICE_KEY } from './ContinueAsGuest'

export default function GuestNotice() {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (user?.isGuest && sessionStorage.getItem(GUEST_NOTICE_KEY) === 'pending') {
      setOpen(true)
    }
  }, [user])

  if (!open || !user?.isGuest) return null

  const dismiss = () => {
    sessionStorage.setItem(GUEST_NOTICE_KEY, 'seen')
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Dismiss guest notice"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={dismiss}
      />
      <div
        role="dialog"
        aria-labelledby="guest-notice-title"
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#14161f] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        style={{ animation: 'guestNoticeIn 0.28s ease both' }}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <div>
            <h2 id="guest-notice-title" className="text-base font-semibold text-white">
              You are in guest mode
            </h2>
            <p className="text-xs text-white/40">This session is not saved to an account</p>
          </div>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-white/55">
        Welcome to Plama! This guest workspace is temporary and will disappear if you sign out, clear your browser, or switch devices. Create an account now to save your progress.
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2.5 text-sm text-white/50 hover:text-white rounded-xl hover:bg-white/[0.04] transition"
          >
            Continue exploring
          </button>
          <Link
            to="/register"
            onClick={dismiss}
            className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white transition"
          >
            Save my work
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes guestNoticeIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

export function GuestBanner() {
  const user = useAuthStore((s) => s.user)
  if (!user?.isGuest) return null

  return (
    <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap px-4 py-2 text-xs font-medium bg-yellow-50 text-yellow-800 border-b border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-200 dark:border-yellow-500/20">
      <span>Guest mode: Progress won't be saved, and live sync may be less seamless.</span>
      <div className="flex items-center gap-x-1">
        <Link to="/register" className="font-semibold underline underline-offset-2 text-yellow-950 hover:text-yellow-700 dark:text-white dark:hover:text-yellow-300">
        Create an account
        </Link>
        <span className="text-yellow-600/60 dark:text-yellow-400/50">or</span>
        <Link to="/login" className="font-semibold underline underline-offset-2 text-yellow-950 hover:text-yellow-700 dark:text-white dark:hover:text-yellow-300">
        sign in
        </Link>
      </div>
    </div>
  )
}
