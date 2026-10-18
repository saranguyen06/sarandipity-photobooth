import { Link } from 'react-router-dom'
import photobooth1 from '../assets/photobooth.png'
import photobooth2 from '../assets/photobooth2.png'

export default function Home() {
    return (
        <div className="home-page">
            <h1 className="home-title">Sarandipity Booth</h1>
            <div className="home-image-container">
                <Link to="/booth">
                    <img src={photobooth2} alt="Open photobooth" className="hover-img"></img>
                </Link>
                <img src={photobooth1} alt="Closed photobooth"></img>
            </div>
            <h2 className="home-h2">Click on the booth to take some pics!</h2>
            <div className="home-buttons">
                <Link to="/login" className="btn btn--primary">
                    Sign In
                </Link>
                <Link to="/signup" className="btn btn--ghost">
                    Create Account
                </Link>
            </div>
        </div>
    )
}