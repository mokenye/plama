import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'

// Pages (we'll build these out next)
const LoginPage = () => <div style={{ padding: 40 }}><h1>Login — coming soon</h1></div>
const RegisterPage = () => <div style={{ padding: 40 }}><h1>Register — coming soon</h1></div>
const DashboardPage = () => <div style={{ padding: 40 }}><h1>Dashboard — coming soon</h1></div>
const BoardPage = () => <div style={{ padding: 40 }}><h1>Board — coming soon</h1></div>

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/board/:boardId" element={
          <ProtectedRoute>
            <BoardPage />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}