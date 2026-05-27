import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth, isFirebaseEnabled } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const provider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  await signInWithPopup(auth, provider);
}

async function handleSignOut() {
  await signOut(auth);
}

/** Full-page login screen shown when no user is authenticated */
function LoginScreen({ sessionKicked, onDismissKick }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { enterGuestMode }    = useAuth();

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e) {
      setError('Error al iniciar sesión. Intenta de nuevo.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-4 flex items-center justify-center" style={{ background: '#0c0b09' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5" style={{background: 'rgba(232,172,101,0.08)', border: '1px solid rgba(232,172,101,0.15)'}}>
            <svg viewBox="0 0 100 100" className="w-12 h-12" fill="none" stroke="#e8ac65" strokeWidth={1.5}>
              <circle cx="50" cy="50" r="45" stroke="currentColor" fill="none"/>
              <path d="M50 5 L50 95" stroke="currentColor" opacity="0.2"/>
              <path d="M5 50 L95 50" stroke="currentColor" opacity="0.2"/>
              <path d="M26 42 Q26 28 38 28 Q44 28 46 34" stroke="currentColor" strokeLinecap="round"/>
              <path d="M46 34 L46 50" stroke="currentColor" strokeLinecap="round"/>
              <path d="M43 50 L49 50" stroke="currentColor" strokeLinecap="round"/>
              <path d="M62 42 Q62 28 74 28 Q80 28 82 34" stroke="currentColor" strokeLinecap="round"/>
              <path d="M82 34 L82 50" stroke="currentColor" strokeLinecap="round"/>
              <path d="M79 50 L85 50" stroke="currentColor" strokeLinecap="round"/>
              <path d="M38 68 L38 80" stroke="currentColor" strokeLinecap="round"/>
              <path d="M62 68 L62 80" stroke="currentColor" strokeLinecap="round"/>
              <path d="M30 62 Q50 90 70 62" stroke="currentColor" fill="rgba(232,172,101,0.10)" strokeLinecap="round"/>
              <text x="50" y="95" textAnchor="middle" fontSize="8" fill="#baa587" fontWeight="600">GK</text>
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{color: '#f1ede7'}}>GKApp</h1>
          <p className="mt-2 text-sm" style={{color: '#997b66'}}>Gestión de porteros · Análisis táctico</p>
        </div>

        <div className="glass-card-static p-8 shadow-2xl space-y-4" style={{borderRadius: 24}}>
          <h2 className="text-lg font-semibold mb-1" style={{color: '#f1ede7'}}>Iniciar sesión</h2>
          <p className="text-sm mb-6" style={{color: '#997b66'}}>
            Tus datos se sincronizan de forma segura en la nube, aislados de otros usuarios.
          </p>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-100 disabled:opacity-60 rounded-xl text-gray-900 font-semibold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
            ) : (
              /* Google G icon */
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? 'Conectando...' : 'Continuar con Google'}
          </button>

          {/* Guest mode button */}
          <button
            onClick={enterGuestMode}
            className="v2-btn-ghost w-full justify-center py-3"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} style={{color: '#997b66'}}>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Entrar como invitado
          </button>

          <p className="text-xs text-center leading-relaxed" style={{color: '#997b66'}}>
            Modo invitado: tus datos se guardan solo en este dispositivo y se perderán si cierras sesión o borras los datos del navegador.
          </p>

          {error && (
            <p className="text-sm text-center" style={{color: '#e04a4a'}}>{error}</p>
          )}

          {sessionKicked && (
            <div className="rounded-xl p-3 text-center" style={{background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.15)'}}>
              <p className="text-sm font-medium" style={{color: '#f0b429'}}>Sesión cerrada desde otro dispositivo</p>
              <p className="text-xs mt-1" style={{color: 'rgba(240,180,41,0.7)'}}>Has iniciado sesión en otro dispositivo. Para continuar aquí, vuelve a iniciar sesión.</p>
              <button
                onClick={onDismissKick}
                className="mt-2 text-xs underline" style={{color: '#f0b429'}}
              >
                Entendido
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps the app: shows LoginScreen if Firebase is enabled and no user is logged in.
 * In Electron mode (Firebase disabled) it renders children immediately.
 * Guest mode bypasses authentication.
 */
export default function AuthGate({ children }) {
  const { user, loading, isGuest, sessionKicked, clearKicked } = useAuth();

  // Electron / no Firebase: pass through
  if (!isFirebaseEnabled) return children;

  // Guest mode: pass through without login
  if (isGuest) return children;

  if (loading) {
    return (
      <div className="min-h-screen bg-gk-page flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gk-accent" />
      </div>
    );
  }

  if (!user) return <LoginScreen sessionKicked={sessionKicked} onDismissKick={clearKicked} />;

  return children;
}

export { handleSignOut };
