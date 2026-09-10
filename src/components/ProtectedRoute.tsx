import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth()
    // still checking (loading):
    // show a loading state rather than flashing login page and then swapping to gallery once session resolves
    if (loading) return <div className="page-loading">Loading…</div>

    // no user — redirect:
    // replace means login page replaces gallery URL in browser history, so hitting "back" after logging in doesn't bounce back to a redirect loop
    if (!user) return <Navigate to="/login" replace />

    // user present — render whatever was passed as children
    return <>{children}</>
}