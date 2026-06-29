import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { AppProvider } from './context/AppContext'
import Login from './components/Login'
import Layout from './components/Layout'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-3)' }}>
        Loading…
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <AppProvider user={session.user}>
      <Layout />
    </AppProvider>
  )
}
