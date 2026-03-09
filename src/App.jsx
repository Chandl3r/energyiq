// src/App.jsx
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import AppShell from './AppShell'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dati,    setDati]    = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setDati(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    loadDati(session.user.id)
  }, [session])

  const loadDati = async (userId) => {
    // Carica forniture + bollette + indici in parallelo
    const [fornitureRes, bolletteRes, indiciRes] = await Promise.all([
      supabase.from('forniture').select('*').eq('utente_id', userId).order('created_at'),
      supabase
        .from('bollette')
        .select('*, forniture(tipo_utenza, fornitore, nome_offerta, pod_pdr)')
        .in(
          'fornitura_id',
          // subquery: prendi gli id forniture di questo utente
          (await supabase.from('forniture').select('id').eq('utente_id', userId)).data?.map(f => f.id) ?? []
        )
        .order('periodo_fine', { ascending: true }),
      supabase.from('indici_mercato').select('*').order('mese_anno'),
    ])

    setDati({
      forniture: fornitureRes.data ?? [],
      bollette:  bolletteRes.data  ?? [],
      indici:    indiciRes.data    ?? [],
    })
  }

  const handleSignOut = () => supabase.auth.signOut()

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

function Splash() {
  return (
    <div style={{
      display:'flex', justifyContent:'center', alignItems:'center',
      minHeight:'100vh', background:'#080808',
      fontFamily:"'Sora',sans-serif", color:'#f59e0b',
      fontSize:28, fontWeight:800, letterSpacing:-1,
    }}>
      EnergyIQ
    </div>
  )
}
