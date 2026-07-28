// src/components/Auth.jsx
import { useState } from 'react';
import { signInWithGoogle, isNative } from '../lib/authNative';

const C = {
  bg:      '#080808',
  surface: '#111111',
  border:  '#1f1f1f',
  text:    '#f5f5f5',
  textDim: '#4b5563',
  amber:   '#f59e0b',
  amberDim:'#1c1503',
};

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
      // Su native: l'app riprende dopo il deep link → il listener in main.jsx
      // aggiorna la sessione e React si re-renderizza automaticamente.
      // Su web: redirect → la pagina ricarica con il token in URL.
    } catch (err) {
      setError(err.message ?? 'Errore durante il login');
    } finally {
      // Su native non arriviamo qui fino al rientro del deep link
      if (!isNative) setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight:        '100dvh',
      background:       C.bg,
      display:          'flex',
      flexDirection:    'column',
      alignItems:       'center',
      justifyContent:   'center',
      padding:          '0 24px',
      fontFamily:       "'DM Sans', sans-serif",
    }}>
      {/* Logo / titolo */}
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{
          width:          64,
          height:         64,
          borderRadius:   20,
          background:     C.amberDim,
          border:         `2px solid ${C.amber}40`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          margin:         '0 auto 20px',
          fontSize:       28,
        }}>⚡</div>
        <h1 style={{
          color:       C.text,
          fontSize:    28,
          fontWeight:  800,
          fontFamily:  "'Sora', sans-serif",
          margin:      '0 0 8px',
        }}>EnergyIQ</h1>
        <p style={{ color: C.textDim, fontSize: 14, margin: 0 }}>
          Monitora i tuoi consumi energetici
        </p>
      </div>

      {/* CTA Google */}
      <button
        onClick={handleSignIn}
        disabled={loading}
        style={{
          width:          '100%',
          maxWidth:       340,
          padding:        '16px 20px',
          background:     loading ? C.surface : '#ffffff',
          border:         `1px solid ${C.border}`,
          borderRadius:   16,
          cursor:         loading ? 'default' : 'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            12,
          transition:     'opacity .2s',
          opacity:        loading ? 0.6 : 1,
        }}
      >
        {/* Google G */}
        {!loading && (
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
        )}
        <span style={{
          color:      loading ? C.textDim : '#1f1f1f',
          fontSize:   15,
          fontWeight: 600,
        }}>
          {loading ? 'Connessione in corso…' : 'Accedi con Google'}
        </span>
      </button>

      {error && (
        <p style={{ color: '#ef4444', fontSize: 12, marginTop: 16, textAlign: 'center' }}>
          {error}
        </p>
      )}

      <p style={{ color: C.textDim, fontSize: 11, marginTop: 32, textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
        Accedendo accetti i Termini di Servizio.<br />
        I tuoi dati non vengono condivisi con terzi.
      </p>
    </div>
  );
}
