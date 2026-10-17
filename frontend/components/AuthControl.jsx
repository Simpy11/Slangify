import { ArrowRight, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../src/context/useAuth.js'

function AuthControl() {
  const { user, isAuthenticated, loading, logout } = useAuth()
  const navigate = useNavigate()

  if (loading) return <span className="auth-control-loading" aria-label="Restoring session" />
  if (!isAuthenticated) return <Link className="login-button" to="/login">Log in <ArrowRight size={15} /></Link>

  return <div className="nav-user-control">
    <span className="nav-user-chip" title={user.name}>@{user.username}</span>
    <button type="button" onClick={() => { logout(); navigate('/') }} aria-label="Log out"><LogOut size={15} /><span>Logout</span></button>
  </div>
}

export default AuthControl
