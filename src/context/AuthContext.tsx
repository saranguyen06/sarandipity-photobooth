import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { CognitoUserSession } from 'amazon-cognito-identity-js'
import * as cognito from '../lib/cognito'
import { clearIdentityCache } from '../lib/awsClients'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<void>
  confirmSignUp: (email: string, code: string) => Promise<void>
  resendConfirmationCode: (email: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function userFromSession(session: CognitoUserSession): AuthUser {
  const payload = session.getIdToken().decodePayload() as Record<string, unknown>
  return {
    sub: payload.sub as string,
    email: payload.email as string,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cognito
      .getCurrentSession()
      .then((session) => {
        if (session?.isValid()) setUser(userFromSession(session))
      })
      .catch(() => {
        // No valid session on load — user is simply signed out, not an error.
      })
      .finally(() => setLoading(false))
  }, [])

  async function signIn(email: string, password: string) {
    const session = await cognito.signIn(email, password)
    setUser(userFromSession(session))
  }

  function signOutUser() {
    cognito.signOut()
    clearIdentityCache()
    setUser(null)
  }

  const value: AuthContextValue = {
    user,
    loading,
    signUp: cognito.signUp,
    confirmSignUp: cognito.confirmSignUp,
    resendConfirmationCode: cognito.resendConfirmationCode,
    signIn,
    signOut: signOutUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
