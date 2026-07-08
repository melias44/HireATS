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
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
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

        {/* Google sign-in — only on login screen */}
        {mode === 'login' && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              style={{
                width: '100%', padding: '10px', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: '#fff', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', cursor: 'pointer',
                fontWeight: 500, color: '#3c4043',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'}
            >
              <GoogleIcon />
              Sign in with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          </>
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}
