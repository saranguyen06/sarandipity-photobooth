import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Signup() {
  const { signUp, confirmSignUp, resendConfirmationCode, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [awaitingCode, setAwaitingCode] = useState(false)
  const [resent, setResent] = useState(false)

  async function handleSignUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signUp(email, password)
      setAwaitingCode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await confirmSignUp(email, code)
      // Confirmed accounts still need to sign in — Cognito treats
      // confirmation and authentication as separate steps.
      await signIn(email, password)
      navigate('/gallery')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setError(null)
    try {
      await resendConfirmationCode(email)
      setResent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code.')
    }
  }

  if (awaitingCode) {
    return (
      <div className="auth-page">
        <form className="auth-card" onSubmit={handleConfirm}>
          <p className="auth-card__eyebrow">Almost there</p>
          <h1 className="auth-card__title">Check your email</h1>
          <p>Enter the 6-digit code we sent to {email}.</p>

          <label className="field">
            <span>Confirmation code</span>
            <input
              type="text"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
            />
          </label>

          {error && <p className="auth-card__error">{error}</p>}

          <button className="btn btn--primary" type="submit" disabled={submitting}>
            {submitting ? 'Confirming…' : 'Confirm account'}
          </button>

          <button type="button" className="btn btn--text" onClick={handleResend}>
            {resent ? 'Code resent ✓' : 'Resend code'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSignUp}>
        <p className="auth-card__eyebrow">Get started</p>
        <h1 className="auth-card__title">Create an account</h1>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        {error && <p className="auth-card__error">{error}</p>}

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth-card__switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
