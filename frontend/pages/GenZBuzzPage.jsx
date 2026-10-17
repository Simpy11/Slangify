import BrandLogo from '../components/BrandLogo.jsx'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthControl from '../components/AuthControl.jsx'
import BuzzNavLink from '../components/BuzzNavLink.jsx'
import Footer from '../components/Footer.jsx'
import GenZBuzz from '../components/GenZBuzz.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'

export default function GenZBuzzPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <main className="genz-buzz-page">
    <nav className="nav shell" aria-label="Primary navigation">
      <Link className="logo" to="/" aria-label="Slangify home"><BrandLogo /></Link>
      <button type="button" className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="primary-links">{menuOpen ? <X /> : <Menu />}</button>
      <div id="primary-links" className={`nav-links ${menuOpen ? 'open' : ''}`}>
        <Link to="/">Home</Link><Link to="/explore">Explore</Link><BuzzNavLink onClick={() => setMenuOpen(false)} /><Link to="/favorites">Favorites</Link><Link to="/add-slang">Add Slang</Link><Link to="/voice-assistant">Voice AI</Link><ThemeToggle /><AuthControl />
      </div>
    </nav>
    <GenZBuzz />
    <Footer />
  </main>
}
