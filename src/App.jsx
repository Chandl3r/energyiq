// src/App.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import AppShell from './AppShell'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'

function MainApp() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dati, setDati] = useState(null)

  useEffect(() => {
    // Autenticazione
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    }).catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setDati(null)
    })

    // AdMob asincrono - Utilizzo App Open Ad con cold start e warm start
    let appStateListener;
    if (Capacitor.isNativePlatform()) {
      const initAds = async () => {
        try {
          const { AdMob } = await import('@capacitor-community/admob');
          await AdMob.initialize();
          
          const adId = Capacitor.getPlatform() === 'ios'
            ? 'ca-app-pub-4271016850546399/2868326513'
            : 'ca-app-pub-4271016850546399/3306264037';

          // 1. CARICAMENTO E VISUALIZZAZIONE AL PRIMO AVVIO (Cold Start)
          await AdMob.loadAppOpen({ adUnitId: adId, isTesting: true });
          await AdMob.showAppOpen().catch(() => {});
          
          // 2. PRECARICAMENTO PER LA PROSSIMA RIAPERTURA
          await AdMob.loadAppOpen({ adUnitId: adId, isTesting: true }).catch(() => {});

          // 3. LISTENER PER LE RIAPERTURE DAL BACKGROUND (Warm Start)
          appStateListener = await CapApp.addListener('appStateChange', async (state) => {
            if (state.isActive) {
              await AdMob.showAppOpen().catch(() => {});
              await AdMob.loadAppOpen({ adUnitId: adId, isTesting: true }).catch(() => {});
            }
          });
        } catch (err) {
          console.error("AdMob Init Error:", err);
        }
      };
      initAds();
    }

    return () => {
      subscription.unsubscribe();
      if (appStateListener) appStateListener.remove();
    };
  }, [])

  useEffect(() => {
    if (!session?.user) return
    loadDati(session.user.id).catch(() => {})
  }, [session])

  const loadDati = async (userId) => {
    const [fornitureRes, bolletteRes, indiciRes] = await Promise.all([
      supabase.from('forniture').select('*').eq('utente_id', userId).order('created_at'),
      supabase.from('bollette').select('*, forniture(tipo_utenza, fornitore, nome_offerta, pod_pdr)')
        .in('fornitura_id', (await supabase.from('forniture').select('id').eq('utente_id', userId)).data?.map(f => f.id) ?? [])
        .order('periodo_fine', { ascending: true }),
      supabase.from('indici_mercato').select('*').order('mese_anno'),
    ])
    setDati({ forniture: fornitureRes.data ?? [], bollette: bolletteRes.data ?? [], indici: indiciRes.data ?? [] })
  }

  const handleSignOut = () => supabase.auth.signOut()

  if (loading) return (
    <div style={{position:'relative', width:'100%', height:'100vh', background:'#080808'}}>
      <Splash />
    </div>
  )
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
    <div style={{display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#080808', fontFamily:"'Sora',sans-serif", color:'#f59e0b', fontSize:28, fontWeight:800, letterSpacing:-1}}>
      EnergyIQ
    </div>
  )
}

export default function App() {
  return <MainApp />
}