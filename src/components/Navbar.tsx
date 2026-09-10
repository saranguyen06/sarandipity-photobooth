import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()

    async function handleSignOut() {
        await signOut()
        navigate('/')
    }

    return (
        <header className="navbar">
        <Link to="/" className="navbar__brand">
            <span className="navbar__brand-mark">◎</span>
            Sara-ndipity Booth
        </Link>
        <nav className="navbar__links">
            <Link to="/">Booth</Link>
            {user && <Link to="/gallery">My Photos</Link>}
            {user ? (
            <button className="navbar__ghost-btn" onClick={handleSignOut}>
                Sign out
            </button>
            ) : (
            <Link to="/login" className="navbar__cta">
                Sign in
            </Link>
            )}
        </nav>
        </header>
    )
}
