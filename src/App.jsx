// src/App.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import AppShell from './AppShell'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
// Rimosso import statico di AdMob per sicurezza

// --- 1. SCUDO GLOBALE PER GLI ERRORI A SCHERMO ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#111', color: '#ff4444', minHeight: '100vh', wordWrap: 'break-word', fontFamily: 'monospace' }}>
          <h2>🚨 CRASH JAVASCRIPT</h2>
          <p><strong>Errore:</strong> {this.state.error && this.state.error.toString()}</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            <summary style={{color: '#fff'}}>Mostra Dettagli</summary>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- 2. LOGICA DELL'APP ---
function MainApp() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dati, setDati] = useState(null)
  const [debugMsg, setDebugMsg] = useState('Avvio in corso...') // Logger a schermo

  useEffect(() => {
    // Autenticazione
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      setDebugMsg(d => d + '\nSessione caricata.')
    }).catch(err => setDebugMsg(d => d + '\nErr DB: ' + err.message));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setDati(null)
    })

    // AdMob asincrono
    let appStateListener;
    if (Capacitor.isNativePlatform()) {
      const initAds = async () => {
        try {
          setDebugMsg(d => d + '\nImportazione AdMob...');
          const { AdMob } = await import('@capacitor-community/admob');
          
          setDebugMsg(d => d + '\nInizializzazione...');
          await AdMob.initialize();
          
          const adId = Capacitor.getPlatform() === 'ios'
            ? 'ca-app-pub-4271016850546399/2868326513'
            : 'ca-app-pub-4271016850546399/3306264037';

          await AdMob.prepareAppOpenAd({ adUnitId: adId, isTesting: false });
          setDebugMsg(d => d + '\nAnnuncio pronto.');

          appStateListener = await CapApp.addListener('appStateChange', async (state) => {
            if (state.isActive) {
              await AdMob.showAppOpenAd().catch(() => {});
              await AdMob.prepareAppOpenAd({ adUnitId: adId, isTesting: false }).catch(() => {});
            }
          });
        } catch (err) {
          setDebugMsg(d => d + '\nERRORE ADMOB: ' + err.message);
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
    loadDati(session.user.id).catch(err => setDebugMsg(d => d + '\nErr Fetch: ' + err.message))
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
      <div style={{position:'absolute', bottom:10, left:10, color:'lime', fontSize:12, whiteSpace:'pre-wrap'}}>{debugMsg}</div>
    </div>
  )
  if (!session) return <Auth />

  return (
    <>
      {/* Mostra eventuali errori non bloccanti in verde durante l'uso dell'app */}
      <div style={{position:'fixed', top:40, left:10, zIndex:9999, color:'lime', fontSize:12, pointerEvents:'none', whiteSpace:'pre-wrap', textShadow:'1px 1px 0 #000'}}>
        {debugMsg.includes('ERRORE') ? debugMsg : ''}
      </div>
      
      <AppShell
        user={session.user}
        dati={dati}
        onSignOut={handleSignOut}
        onRefresh={() => loadDati(session.user.id)}
      />
    </>
  )
}

function Splash() {
  return (
    <div style={{display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#080808', fontFamily:"'Sora',sans-serif", color:'#f59e0b', fontSize:28, fontWeight:800, letterSpacing:-1}}>
      EnergyIQ
    </div>
  )
}

// --- 3. ESPORTAZIONE SICURA ---
export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  )
}