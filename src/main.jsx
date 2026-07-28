// src/main.jsx
import React    from 'react';
import ReactDOM from 'react-dom/client';
import App      from './App';
import { supabase }           from './lib/supabase';
import { isNative, handleDeepLink } from './lib/authNative';

// ── Capacitor plugins (importati solo se in ambiente nativo) ──────────────────
// I plugin vengono ignorati silenziosamente su web (no-op)
import { App as CapApp }  from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen }   from '@capacitor/splash-screen';

// ── Status bar scura (icone bianche) ─────────────────────────────────────────
if (isNative) {
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#080808' }).catch(() => {});
}

// ── Deep link listener — gestisce il ritorno dall'OAuth Google ────────────────
// Quando Supabase redirige a energyiq://auth/callback, questo listener
// chiude il browser di sistema e aggiorna la sessione.
CapApp.addListener('appUrlOpen', ({ url }) => {
  handleDeepLink(url).catch(console.error);
});

// ── Nascondi splash screen dopo che React ha montato il DOM ──────────────────
SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});

// ── Render ────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
