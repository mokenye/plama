import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          renderButton: (element: HTMLElement, config: any) => void
        }
      }
    }
  }
}

interface Props {
  onError?: (msg: string) => void
  setLoading?: (loading: boolean) => void
  text?: 'continue_with' | 'signup_with' | 'signin_with'
}

// Module-level flag — survives re-renders and StrictMode double-invocation
let googleInitialized = false

export default function GoogleSignInButton({ onError, setLoading, text = 'continue_with' }: Props) {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const btnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId || !window.google || !btnRef.current) return

    if (!googleInitialized) {
      googleInitialized = true
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          setLoading?.(true)
          try {
            const { user, token } = await authApi.google(response.credential)
            setAuth(user, token)
            navigate('/')
          } catch (err: any) {
            onError?.(err.response?.data?.error || 'Google sign-in failed')
          } finally {
            setLoading?.(false)
          }
        },
      })
    }

    // Always re-render the button (safe to call multiple times)
    window.google.accounts.id.renderButton(btnRef.current, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      width: btnRef.current.offsetWidth,
      text,
      shape: 'pill',
    })
  }, [])

  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null

  return <div ref={btnRef} className="w-full" />
}