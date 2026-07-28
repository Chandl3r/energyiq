// src/components/Auth.jsx
import { useState } from 'react'
import { signInWithGoogle } from '../lib/supabase'
import { Zap, Flame, Loader2 } from 'lucide-react'

const C = {
  bg: '#080808', surface: '#111111', border: '#1e1e1e',
  amber: '#f59e0b', amberDim: '#f59e0b20', amberMid: '#f59e0b40',
  sky: '#38bdf8', skyDim: '#38bdf820',
  green: '#22c55e', text: '#ffffff', textMid: '#9ca3af', textDim: '#4b5563',
}

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const handleGoogle = async () => {
    setLoading(true)
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // se ok → redirect a Google, poi torna all'app con sessione attiva
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'center',
      background: '#050505', minHeight: '100vh',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #050505; }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 430, minHeight: '100vh',
        background: C.bg, display: 'flex', flexDirection: 'column',
        fontFamily: "'DM Sans', sans-serif", padding: '0 24px',
      }}>

        {/* Header decorativo */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>

          {/* Logo */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ background: C.amberDim, border: `1px solid ${C.amberMid}`, borderRadius: 16, padding: 14 }}>
                <Zap size={28} color={C.amber} />
              </div>
              <div style={{ background: C.skyDim, border: `1px solid ${C.sky}30`, borderRadius: 16, padding: 14 }}>
                <Flame size={28} color={C.sky} />
              </div>
            </div>
            <h1 style={{
              color: C.text, fontSize: 36, fontWeight: 800,
              fontFamily: "'Sora', sans-serif", letterSpacing: -1, margin: '0 0 8px',
            }}>EnergyIQ</h1>
            <p style={{ color: C.textDim, fontSize: 14 }}>
              Monitora e ottimizza le tue bollette
            </p>
          </div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '⚡', title: 'Analisi in tempo reale', sub: 'Confronto con prezzi PUN e PSV del mercato' },
              { icon: '📄', title: 'Upload bollette AI', sub: 'Estrazione automatica di dati da PDF e foto' },
              { icon: '💰', title: 'Risparmia ogni anno', sub: 'Scopri se la tua tariffa è conveniente' },
            ].map((f, i) => (
              <div key={i} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ fontSize: 22 }}>{f.icon}</div>
                <div>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>{f.title}</p>
                  <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>{f.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Login button */}
          <div>
            {error && (
              <p style={{
                color: '#ef4444', fontSize: 12, textAlign: 'center',
                background: '#ef444415', borderRadius: 12, padding: '10px 14px',
                marginBottom: 14, border: '1px solid #ef444430',
              }}>{error}</p>
            )}

            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: '100%', padding: '16px', borderRadius: 18,
                background: loading ? C.surface : C.text,
                border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
              }}
            >
              {loading ? (
                <Loader2 size={20} color={C.textMid} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              <span style={{
                color: loading ? C.textMid : C.bg,
                fontSize: 15, fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {loading ? 'Accesso in corso...' : 'Accedi con Google'}
              </span>
            </button>

            <p style={{ color: C.textDim, fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
              Accedendo accetti i Termini di Servizio.<br/>
              I tuoi dati sono privati e cifrati.
            </p>
          </div>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
