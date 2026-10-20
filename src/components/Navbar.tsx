import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    if (location.pathname === '/') {
        return null
    }

    async function handleSignOut() {
        await signOut()
        navigate('/')
    }

    return (
        <header className="navbar">
        <Link to="/" className="navbar__brand">
            Sarandipity Booth
        </Link>
        <nav className="navbar__links">
            <Link to="/booth">Booth</Link>
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
