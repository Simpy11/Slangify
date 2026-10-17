import logo from '../src/assets/slangify-logo.png'
import icon from '../src/assets/slangify-icon.png'
import './BrandLogo.css'

export default function BrandLogo({ variant = 'nav' }) {
  if (variant === 'auth') {
    return <img className="brand-auth-image" src={logo} alt="Slangify — Decode Gen Z Language" width="112" height="112" decoding="async" />
  }
  return <span className="brand-lockup"><img className="brand-icon-image" src={icon} alt="Glossy S with a friendly headset robot" width="44" height="44" decoding="async" /><span className="brand-label">Slangify</span></span>
}
