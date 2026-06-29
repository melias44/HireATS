import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset'
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setMessage('Check your email for a password reset link.')
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Account created! Check your email to confirm, then sign in.')
        setMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // App.jsx auth listener handles redirect
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">Hire<span>.</span></div>
        <div className="login-sub">
          {mode === 'login' && 'Sign in to your HR workspace'}
          {mode === 'signup' && 'Create an account'}
          {mode === 'reset' && 'Reset your password'}
        </div>

        {error && <div className="login-error">{error}</div>}
        {message && (
          <div style={{ background: 'var(--green-bg)', border: '1px solid #BBF7D0', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--green-text)', marginBottom: 16 }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
            />
          </div>
          {mode !== 'reset' && (
            <div className="form-row">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px', fontSize: 14, marginTop: 4 }}
            disabled={loading}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
        </form>

        <div style={{ marginTop: 18, fontSize: 12, color: 'var(--text-3)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mode === 'login' && (
            <>
              <button onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: 'var(--accent-text)', cursor: 'pointer', fontSize: 12 }}>
                Don't have an account? Sign up
              </button>
              <button onClick={() => setMode('reset')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12 }}>
                Forgot password?
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: 'var(--accent-text)', cursor: 'pointer', fontSize: 12 }}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
