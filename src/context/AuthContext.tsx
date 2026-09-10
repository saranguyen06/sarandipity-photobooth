import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react'
import type { Session, User, AuthError, AuthResponse } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

interface AuthContextValue {
    session: Session | null
    user: User | null
    loading: boolean
    signUp: (email: string, password: string) => Promise<AuthResponse>
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
    signOut: () => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // on mount, ask Supabase if there's already a valid session
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session)
            setLoading(false)
        })
        // subscribe to future auth changes (login, logout, token refresh)
        const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession)
        })
        // clean up the subscription when this provider unmounts
        return () => listener.subscription.unsubscribe()
    }, [])

    const signUp = (email: string, password: string) =>
        supabase.auth.signUp({ email, password })
    const signIn = (email: string, password: string) =>
        supabase.auth.signInWithPassword({ email, password })
    const signOut = () => supabase.auth.signOut()

    const value: AuthContextValue = {
        session,
        user: session?.user ?? null,
        loading,
        signUp,
        signIn,
        signOut,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider')
    return ctx
}
