import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError('Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--body-bg)'
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 1rem' }}>
        <div className="text-center mb-4">
          <i className="bi bi-music-note-beamed" style={{ fontSize: '2.5rem', color: 'var(--accent-light)' }} />
          <h4 style={{ fontWeight: 700, marginTop: '0.5rem' }}>SA Nightlife Intel</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Event Intelligence Platform</p>
        </div>

        <div className="stat-card">
          <form onSubmit={handleSubmit}>
            {error && <div className="alert-card mb-3">{error}</div>}
            <div className="mb-3">
              <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email</label>
              <input
                type="email" className="form-control" value={email}
                onChange={e => setEmail(e.target.value)} required autoFocus
                placeholder="diphokoo@outlook.com"
              />
            </div>
            <div className="mb-4">
              <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Password</label>
              <input
                type="password" className="form-control" value={password}
                onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
