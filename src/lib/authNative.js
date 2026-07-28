// src/lib/authNative.js
// Gestisce il flusso Google OAuth in ambiente nativo (Capacitor).
// Su web usa il redirect standard; su native apre il browser di sistema
// e torna all'app via deep link energyiq://auth/callback.

import { Capacitor } from '@capacitor/core';
import { Browser }   from '@capacitor/browser';
import { supabase }  from './supabase';

export const isNative = Capacitor.isNativePlatform();

// Redirect URL in base all'ambiente
export const getRedirectUrl = () =>
  isNative
    ? 'energyiq://auth/callback'
    : window.location.origin;

// Sign in con Google
export async function signInWithGoogle() {
  if (isNative) {
    // 1. Ottieni URL OAuth da Supabase senza aprire il browser automaticamente
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'energyiq://auth/callback',
        skipBrowserRedirect: true,   // NON aprire window.location — lo facciamo noi
      },
    });
    if (error) throw error;

    // 2. Apri nel browser di sistema (Safari/Chrome) — non nel webview
    if (data?.url) {
      await Browser.open({
        url:        data.url,
        windowName: '_self',         // stesso tab, non nuovo
        presentationStyle: 'popover',
      });
    }
  } else {
    // Web: redirect normale
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Da chiamare in main.jsx — gestisce il rientro dall'OAuth
export async function handleDeepLink(url) {
  if (!url?.startsWith('energyiq://')) return;

  // Chiudi il browser di sistema
  await Browser.close().catch(() => {});

  const parsed = new URL(url);

  // 1. PKCE Flow: estrai il code e fai l'exchange
  const code = parsed.searchParams.get('code');
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    return;
  }

  // 2. Implicit Flow: estrai i token dall'hash
  const hash = parsed.hash;
  if (hash && hash.includes('access_token')) {
    // Rimuoviamo il '#' iniziale per parsare i parametri
    const params = new URLSearchParams(hash.replace('#', ''));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      await supabase.auth.setSession({
        access_token,
        refresh_token
      });
    }
  }
}