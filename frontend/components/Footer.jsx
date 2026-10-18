import BrandLogo from './BrandLogo.jsx'
import { Link } from 'react-router-dom'

function Footer() {
  return <footer><div className="shell footer-main"><div><Link className="logo" to="/" aria-label="Slangify home"><BrandLogo /></Link><p>The internet's favorite<br />slang dictionary.</p></div><div className="footer-links"><div><b>Discover</b><Link to="/">Home</Link><Link to="/explore">Explore</Link><Link to="/explore?trending=true">Trending</Link></div><div><b>Your Slangify</b><Link to="/favorites">Favorites</Link><Link to="/add-slang">Add Slang</Link><Link to="/voice-assistant">Voice Assistant</Link></div></div></div><div className="shell footer-bottom"><span>© 2026 Slangify. Made by Simpy for the culture.</span><span>Built for the next generation</span></div></footer>
}

export default Footer
