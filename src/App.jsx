// src/App.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import AppShell from './AppShell'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { consumeAdSuppression, setPrivacyOptionsRequired } from './lib/ads'

// Overlay di debug in verde: visibile solo in sviluppo (npm run dev). Per un test su device mettere temporaneamente `true`.
const SHOW_DEBUG = import.meta.env.DEV

function MainApp() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dati, setDati] = useState(null)
  const [debugMsg, setDebugMsg] = useState('Avvio in corso...') // Logger a schermo riattivato

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

    // AdMob asincrono con log visivi
    let appStateListener;
    if (Capacitor.isNativePlatform()) {
      const initAds = async () => {
        try {
          setDebugMsg(d => d + '\nImportazione AdMob...');
          const { AdMob } = await import('@capacitor-community/admob');
          
          const adId = Capacitor.getPlatform() === 'ios'
            ? 'ca-app-pub-4271016850546399/2868326513'
            : 'ca-app-pub-4271016850546399/3306264037';

          // Plugin v8.3.0: la chiave è adId (non adUnitId); isTesting è ignorato da App Open
          const log = (m) => setDebugMsg(d => d + '\n' + m);
          const MIN_BACKGROUND_MS = 30 * 1000;   // al rientro: app in background da almeno 30 s
          const MIN_GAP_MS = 4 * 60 * 1000;      // almeno 4 min tra un annuncio e l'altro
          const FIRST_GAP_MS = 2 * 60 * 1000;    // prima volta (sessione del consenso): 2 min dal consenso
          let isShowing = false;                 // un solo annuncio alla volta
          let lastAdAt = 0;                      // chiusura dell'ultimo annuncio
          let backgroundAt = null;               // quando l'utente ha lasciato l'app (non conta l'annuncio stesso)
          let pendingCold = false;               // annuncio d'avvio rimandato al primo "app attiva"
          let consentAt = null;                  // se il modulo GDPR è apparso in questa sessione: niente annuncio d'avvio

          // Consenso GDPR (UMP di Google, messaggio configurato in AdMob → Privacy e messaggi).
          // Appare solo quando serve (UE, prima volta): in quella sessione prende il posto dell'annuncio d'avvio.
          // Niente App Tracking Transparency su iOS: l'app non traccia (nessuna chiamata a requestTrackingAuthorization).
          let isConsenting = false;
          try {
            let info = await AdMob.requestConsentInfo();
            if (info.status === 'REQUIRED' && info.isConsentFormAvailable) {
              log('Mostro consenso GDPR...');
              isConsenting = true;
              info = await AdMob.showConsentForm();
              consentAt = Date.now();
            }
            setPrivacyOptionsRequired(info.privacyOptionsRequirementStatus === 'REQUIRED');
            log('Consenso: ' + info.status + (info.canRequestAds ? '' : ' (annunci non consentiti)'));
            if (!info.canRequestAds) return;
          } catch (err) {
            log('Err Consenso: ' + err.message); // es. messaggio GDPR non configurato: si procede
          } finally {
            isConsenting = false;
          }

          log('Inizializzazione...');
          await AdMob.initialize(); // dopo il consenso, come raccomanda Google

          const isLoaded = () => AdMob.isAppOpenLoaded().then(r => !!r?.value).catch(() => false);
          let loading = null;                    // evita due caricamenti in parallelo
          const load = () => loading ??= AdMob.loadAppOpen({ adId }).then(() => true)
            .catch(err => { log('Err Load: ' + err.message); return false; })
            .finally(() => { loading = null; });

          // Mostra l'annuncio; resolve alla chiusura. Restituisce true se è stato mostrato.
          const show = async (label) => {
            if (isShowing) return false;
            isShowing = true;
            log('Mostro annuncio (' + label + ')...');
            try {
              await AdMob.showAppOpen();
              lastAdAt = Date.now();
              return true;
            } catch (err) {
              log('Err Show ' + label + ': ' + err.message);
              return false;
            } finally {
              isShowing = false;
              backgroundAt = null;
              load(); // precarica il prossimo
            }
          };

          // Listener registrato prima dell'annuncio d'avvio, così non si perdono eventi
          appStateListener = await CapApp.addListener('appStateChange', async (state) => {
            if (!state.isActive) {
              // L'annuncio a schermo intero manda l'app in pausa: non è un vero "uscire dall'app"
              if (!isShowing && !isConsenting) backgroundAt = Date.now();
              return;
            }
            if (isShowing || isConsenting) return;
            if (consumeAdSuppression()) { backgroundAt = null; return; } // rientro da selettore file o login
            if (pendingCold) {
              pendingCold = false;
              if (await isLoaded() || await load()) await show('Cold Start ritardato');
              return;
            }
            const now = Date.now();
            // Prima volta (sessione del consenso, nessun annuncio ancora): basta un qualsiasi rientro,
            // purché siano passati 2 min dal consenso. Poi regole normali: 30 s di background e 4 min tra annunci.
            const firstTime = consentAt !== null && lastAdAt === 0;
            const minBackground = firstTime ? 0 : MIN_BACKGROUND_MS;
            const gapOk = firstTime ? now - consentAt >= FIRST_GAP_MS : now - lastAdAt >= MIN_GAP_MS;
            const wasAway = backgroundAt !== null && now - backgroundAt >= minBackground;
            backgroundAt = null;
            if (!wasAway || !gapOk) return; // rientro breve o annuncio troppo recente
            if (await isLoaded()) await show('Warm Start');
            else load(); // non pronto: niente annuncio in ritardo, lo prepariamo per la prossima volta
          });

          log('Caricamento annuncio...');
          if (consentAt !== null) {
            load(); // sessione del consenso: niente annuncio d'avvio, lo prepariamo per il primo rientro
          } else if (await load()) {
            const { isActive } = await CapApp.getState().catch(() => ({ isActive: true }));
            let shown = false;
            if (isActive) shown = await show('Cold Start');
            if (!shown) {
              // Android a volte non considera ancora l'app in primo piano: riprova una volta
              await new Promise(r => setTimeout(r, 1500));
              const { isActive: activeNow } = await CapApp.getState().catch(() => ({ isActive: false }));
              if (activeNow && (await isLoaded() || await load())) shown = await show('Cold Start retry');
              if (!shown && lastAdAt === 0) pendingCold = true;
            }
          }
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
      {SHOW_DEBUG && <div style={{position:'absolute', bottom:10, left:10, color:'lime', fontSize:12, whiteSpace:'pre-wrap'}}>{debugMsg}</div>}
    </div>
  )
  if (!session) return <Auth />

  return (
    <>
      {SHOW_DEBUG && (
        <div style={{position:'fixed', top:40, left:10, zIndex:9999, color:'lime', fontSize:12, pointerEvents:'none', whiteSpace:'pre-wrap', textShadow:'1px 1px 0 #000'}}>
          {debugMsg}
        </div>
      )}
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

export default function App() {
  return <MainApp />
}