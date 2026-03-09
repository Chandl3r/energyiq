// src/main-with-auth.jsx
// ── Sostituisce src/main.jsx (o src/App.jsx se usi Vite default) ──────────────
// Questo file gestisce lo stato di autenticazione globale.
// Il componente <AppShell> è il tuo App.jsx attuale (rinominalo AppShell).

import { useState, useEffect } from 'react'
import { supabase, getForniture, getIndiciMercato } from './lib/supabase'
import Auth from './components/Auth'

// ── Importa l'app principale (il jsx che hai già) ─────────────
// Rinomina il tuo attuale App.jsx → AppShell.jsx
// e cambia "export default function App()" → "export default function AppShell({ user, dati, signOut })"
import AppShell from './AppShell'

export default function App() {
  const [session,  setSession]  = useState(null)       // sessione Supabase
  const [loading,  setLoading]  = useState(true)        // loading iniziale
  const [dati,     setDati]     = useState(null)        // { forniture, indici }

  // ── 1. Ascolta cambio sessione (login / logout / refresh token) ──
  useEffect(() => {
    // Controlla sessione esistente al mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listener real-time
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setDati(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── 2. Carica dati utente quando la sessione è attiva ────────
  useEffect(() => {
    if (!session?.user) return
    loadDati(session.user.id)
  }, [session])

  const loadDati = async (userId) => {
    const [fornitureRes, indiciRes] = await Promise.all([
      getForniture(userId),
      getIndiciMercato(),
    ])
    setDati({
      forniture: fornitureRes.data ?? [],
      indici:    indiciRes.data    ?? [],
    })
  }

  const handleSignOut = () => supabase.auth.signOut()

  // ── Render ───────────────────────────────────────────────────
  if (loading) return <Splash />

  if (!session) return <Auth />

  return (
    <AppShell
      user={session.user}
      dati={dati}
      onSignOut={handleSignOut}
      onRefresh={() => loadDati(session.user.id)}
    />
  )
}

// Splash screen minimo mentre verifica la sessione
function Splash() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#080808',
      fontFamily: "'Sora', sans-serif", color: '#f59e0b',
      fontSize: 28, fontWeight: 800, letterSpacing: -1,
    }}>
      EnergyIQ
    </div>
  )
}
