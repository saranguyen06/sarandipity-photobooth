import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
    const { signIn } = useAuth()
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setSubmitting(true)
        setError(null)
        const { error } = await signIn(email, password)
        setSubmitting(false)
        if (error) {
            setError(error.message)
            return
        }
        navigate('/gallery')
    }

    return (
        <div className="auth-page">
            <form className="auth-card" onSubmit={handleSubmit}>
                <p className="auth-card__eyebrow">Welcome back</p>
                <h1 className="auth-card__title">Sign in</h1>

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
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                    />
                </label>

                {error && <p className="auth-card__error">{error}</p>}

                <button className="btn btn--primary" type="submit" disabled={submitting}>
                    {submitting ? 'Signing in…' : 'Sign in'}
                </button>

                <p className="auth-card__switch">
                    New here? <Link to="/signup">Create an account</Link>
                </p>
            </form>
        </div>
    )
}
