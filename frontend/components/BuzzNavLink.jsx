import { Sparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import './BuzzNavLink.css'

export default function BuzzNavLink({ onClick }) {
  return <NavLink to="/genz-buzz" onClick={onClick} className={({ isActive }) => `nav-buzz${isActive ? ' active' : ''}`}><Sparkles size={14} aria-hidden="true" />Gen Z Buzz</NavLink>
}
