// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Mancano le variabili VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// ── Helpers Auth ──────────────────────────────────────────────

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

// ── Helpers DB ────────────────────────────────────────────────

export const getProfilo = (userId) =>
  supabase.from('utenti').select('*').eq('id', userId).single()

export const getForniture = (userId) =>
  supabase.from('forniture').select(`
    *,
    tariffe (*),
    bollette (*)
  `).eq('utente_id', userId).order('tipo_utenza')

export const getBollette = (fornituraId) =>
  supabase.from('bollette')
    .select('*')
    .eq('fornitura_id', fornituraId)
    .order('periodo_fine', { ascending: false })

export const getIndiciMercato = () =>
  supabase.from('indici_mercato')
    .select('*')
    .order('mese_anno', { ascending: false })
    .limit(30)

export const insertBolletta = (data) =>
  supabase.from('bollette').insert(data).select().single()

export const updateProfilo = (userId, data) =>
  supabase.from('utenti').update(data).eq('id', userId)
