import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Signup() {
    const { signUp } = useAuth()
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [confirmSent, setConfirmSent] = useState(false)

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setSubmitting(true)
        setError(null)
        const { data, error } = await signUp(email, password)
        setSubmitting(false)
        if (error) {
            setError(error.message)
            return
        }
        // If email confirmation is enabled in Supabase, there will be no session yet.
        if (!data.session) {
            setConfirmSent(true)
            return
        }
        navigate('/gallery')
    }

    if (confirmSent) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <p className="auth-card__eyebrow">Almost there</p>
                    <h1 className="auth-card__title">Check your email</h1>
                    <p>We sent a confirmation link to {email}. Confirm it, then sign in.</p>
                    <Link className="btn btn--primary" to="/login">
                        Go to sign in
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-page">
            <form className="auth-card" onSubmit={handleSubmit}>
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
                        minLength={6}
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
