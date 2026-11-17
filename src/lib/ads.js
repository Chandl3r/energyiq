// src/lib/ads.js — stato condiviso della pubblicità (nessun import dall'app: evita import circolari).
import { Capacitor } from '@capacitor/core'

// Quando l'app va in background per un'azione dell'utente (selettore file, login nel browser),
// al rientro NON va mostrato l'annuncio. Chiamare suppressNextAd() subito prima di quell'azione.
let suppressUntil = 0
export function suppressNextAd(ms = 5 * 60 * 1000) {
  suppressUntil = Date.now() + ms
}
// Restituisce true (e azzera il blocco) se il prossimo annuncio va saltato.
export function consumeAdSuppression() {
  const active = Date.now() < suppressUntil
  suppressUntil = 0
  return active
}

// Preferenze privacy (consenso GDPR di Google): App.jsx le imposta dopo requestConsentInfo().
let privacyOptionsRequired = false
export function setPrivacyOptionsRequired(value) {
  privacyOptionsRequired = !!value
}
export function isPrivacyOptionsRequired() {
  return Capacitor.isNativePlatform() && privacyOptionsRequired
}
export async function openPrivacyOptions() {
  const { AdMob } = await import('@capacitor-community/admob')
  await AdMob.showPrivacyOptionsForm()
}
