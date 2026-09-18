// src/components/Auth.jsx
import { useState } from 'react';
import { signInWithGoogle, signInWithApple, isNative } from '../lib/authNative';

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
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple,  setLoadingApple]  = useState(false);
  const [error,         setError]         = useState(null);

  const handleSignInGoogle = async () => {
    try {
      setLoadingGoogle(true);
      setError(null);
      await signInWithGoogle();
    } catch (err) {
      setError(err.message ?? 'Errore durante il login con Google');
    } finally {
      if (!isNative) setLoadingGoogle(false);
    }
  };

  const handleSignInApple = async () => {
    try {
      setLoadingApple(true);
      setError(null);
      await signInWithApple(); 
    } catch (err) {
      setError(err.message ?? 'Errore durante il login con Apple');
    } finally {
      if (!isNative) setLoadingApple(false);
    }
  };

  const isAnyLoading = loadingGoogle || loadingApple;

  return (
    <>
      {/* Reset globale specifico per la pagina di Auth per eliminare bordi bianchi e scrollbar */}
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: ${C.bg};
          width: 100vw;
          height: 100vh;
          overflow: hidden;
        }
      `}</style>

      <div style={{
        height:           '100vh',
        width:            '100vw',
        background:       C.bg,
        display:          'flex',
        flexDirection:    'column',
        alignItems:       'center',
        justifyContent:   'center',
        padding:          '0 24px',
        fontFamily:       "'DM Sans', sans-serif",
        boxSizing:        'border-box',
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

        <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          {/* Pulsante Apple */}
          <button
            onClick={handleSignInApple}
            disabled={isAnyLoading}
            style={{
              width:          '100%',
              padding:        '16px 20px',
              background:     loadingApple ? C.surface : '#ffffff',
              border:         `1px solid ${C.border}`,
              borderRadius:   16,
              cursor:         isAnyLoading ? 'default' : 'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            12,
              transition:     'opacity .2s',
              opacity:        isAnyLoading && !loadingApple ? 0.6 : 1,
            }}
          >
            {!loadingApple && (
              <svg width="20" height="20" viewBox="0 0 384 512" style={{ marginTop: -2 }}>
                <path fill="#000000" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
            )}
            <span style={{ color: loadingApple ? C.textDim : '#000000', fontSize: 15, fontWeight: 600 }}>
              {loadingApple ? 'Connessione in corso…' : 'Accedi con Apple'}
            </span>
          </button>

          {/* Pulsante Google */}
          <button
            onClick={handleSignInGoogle}
            disabled={isAnyLoading}
            style={{
              width:          '100%',
              padding:        '16px 20px',
              background:     loadingGoogle ? C.surface : C.surface,
              border:         `1px solid ${C.border}`,
              borderRadius:   16,
              cursor:         isAnyLoading ? 'default' : 'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            12,
              transition:     'opacity .2s',
              opacity:        isAnyLoading && !loadingGoogle ? 0.6 : 1,
            }}
          >
            {!loadingGoogle && (
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            )}
            <span style={{ color: loadingGoogle ? C.textDim : C.text, fontSize: 15, fontWeight: 600 }}>
              {loadingGoogle ? 'Connessione in corso…' : 'Accedi con Google'}
            </span>
          </button>

        </div>

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
    </>
  );
}