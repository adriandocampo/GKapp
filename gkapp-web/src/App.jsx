import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { Database, PlusCircle, ClipboardList, Settings, LogOut, User, Shield } from 'lucide-react';
import { db, initDatabase, ensureSeedTasks, ensureDefaultTags } from './db';
import { syncFromFirestore, setupFirestoreSync, clearAllLocalData, resetSyncHooks, cleanupOldDeletedFirestore } from './sync';
import { isFirebaseEnabled } from './firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthGate, { handleSignOut, signInWithGoogle } from './components/AuthGate';
import UpdateNotification from './components/UpdateNotification';
import DatabasePage from './pages/Database';
import TaskEditor from './pages/TaskEditor';
import SessionBuilder from './pages/SessionBuilder';
import SettingsPage from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import { ToastProvider } from './components/Toast';
import { ModalProvider } from './components/Modal';
import ErrorBoundary from './components/ErrorBoundary';
import { isDev } from './utils/env';

function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true });
  }, [isAdmin, navigate]);
  return isAdmin ? children : null;
}

function Layout() {
  const [loading, setLoading] = useState(true);
  const { user, isGuest, isAdmin, exitGuestMode } = useAuth();

  const navActive = isDev ? 'dev-nav-active' : 'bg-slate-700 text-teal-400';
  const navActiveAdmin = isDev ? 'dev-nav-active' : 'bg-slate-700 text-indigo-400';

  useEffect(() => {
    async function init() {
      // 1. Ensure local DB schema is up to date
      await initDatabase();

      // 2. If Firebase is active and user is logged in, sync cloud ↔ local
      if (isFirebaseEnabled && user?.uid) {
        const wasGuest = !!localStorage.getItem('gkapp_guest');
        const lastUid = localStorage.getItem('gkapp_last_uid');
        const isUserChange = !wasGuest && lastUid && lastUid !== user.uid;

        if (isUserChange) {
          // Different user on same device: clear previous user's local data
          await clearAllLocalData();
        }

        resetSyncHooks();

        // Bidirectional merge preserves local data (including guest data)
        // and downloads any newer remote changes from Firestore
        try {
          await syncFromFirestore(user.uid);
        } catch (err) {
          console.error('[app] Firestore sync failed:', err);
        }

        await cleanupOldDeletedFirestore(user.uid);
        setupFirestoreSync(user.uid);

        localStorage.setItem('gkapp_last_uid', user.uid);
        localStorage.removeItem('gkapp_guest');

        // Ensure default tags and seed tasks are present after every sync.
        // This resurrects any seed tasks that were incorrectly soft-deleted in Firestore
        // and recreates standard tags that may have been purged locally.
        await ensureDefaultTags();
        await ensureSeedTasks();
      }

      setLoading(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Re-sync from Firestore when the tab becomes visible again
  // (e.g. user switched devices and came back to this tab)
  useEffect(() => {
    if (!isFirebaseEnabled || !user?.uid) return;

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        console.log('[app] Tab visible, re-syncing from Firestore...');
        syncFromFirestore(user.uid);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.uid]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center text-slate-200 ${isDev ? 'dev-bg' : 'bg-slate-900'}`}>
        <div className={`text-center ${isDev ? 'dev-page-enter' : ''}`}>
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 ${isDev ? 'dev-spinner' : 'border-teal-500'}`}></div>
          <p className="text-lg">
            {isFirebaseEnabled ? 'Sincronizando datos...' : 'Cargando base de datos...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen text-slate-100 flex flex-col ${isDev ? 'dev-bg dev-grid-pattern dev-scrollbar' : 'bg-slate-900'}`}>
      <nav className={`sticky top-0 z-50 ${isDev ? 'dev-navbar' : 'bg-slate-800 border-b border-slate-700'}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold ${isDev ? 'dev-gradient-text' : 'text-teal-400'}`}>GKApp</span>
                {isDev && <span className="dev-badge">DEV</span>}
              </div>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? navActive : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                <Database size={18} />
                <span>Base de Datos</span>
              </NavLink>
              <NavLink
                to="/editor"
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? navActive : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                <PlusCircle size={18} />
                <span>Nueva Tarea</span>
              </NavLink>
              <NavLink
                to="/sessions"
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? navActive : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                <ClipboardList size={18} />
                <span>Sesiones</span>
              </NavLink>
            </div>
            <div className="flex items-center gap-2">
              {/* Guest mode indicator */}
              {isGuest && (
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-600/15 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-medium">
                  <User size={13} />
                  Invitado
                </span>
              )}

              {isAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive ? navActiveAdmin : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`
                  }
                >
                  <Shield size={18} />
                  <span>Admin</span>
                </NavLink>
              )}

              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? navActive : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                <Settings size={18} />
                <span>Ajustes</span>
              </NavLink>

              {/* Sign-out / Exit guest button */}
              {isFirebaseEnabled && (
                <>
                  {user && (
                    <button
                      onClick={handleSignOut}
                      title={`Cerrar sesión (${user.email})`}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      {user.photoURL && (
                        <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
                      )}
                      <LogOut size={16} />
                    </button>
                  )}
                  {isGuest && (
                    <>
                      <button
                        onClick={signInWithGoogle}
                        title="Iniciar sesión con Google para guardar tus datos"
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-teal-600/20 text-teal-400 hover:bg-teal-600/30 border border-teal-500/30 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Guardar datos
                      </button>
                      <button
                        onClick={exitGuestMode}
                        title="Salir del modo invitado (se borrarán los datos)"
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-amber-400 hover:bg-amber-900/30 hover:text-amber-300 transition-colors"
                      >
                        <LogOut size={16} />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 py-6 ${isDev ? 'dev-page-enter' : ''}`}>
        <Routes>
          <Route path="/" element={<DatabasePage />} />
          <Route path="/editor" element={<TaskEditor />} />
          <Route path="/editor/:id" element={<TaskEditor />} />
          <Route path="/sessions" element={<SessionBuilder />} />
          <Route path="/sessions/:id" element={<SessionBuilder />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <ToastProvider>
            <ModalProvider>
              <AuthGate>
                <Layout />
                <UpdateNotification />
              </AuthGate>
            </ModalProvider>
          </ToastProvider>
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
