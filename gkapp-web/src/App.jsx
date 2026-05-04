import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { Database, PlusCircle, ClipboardList, Settings, LogOut, User, Shield } from 'lucide-react';
import { db, initDatabase, seedDatabase } from './db';
import { syncFromFirestore, setupFirestoreSync, clearAllLocalData, resetSyncHooks, migrateGuestData } from './sync';
import { isFirebaseEnabled } from './firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthGate, { handleSignOut } from './components/AuthGate';
import UpdateNotification from './components/UpdateNotification';
import DatabasePage from './pages/Database';
import TaskEditor from './pages/TaskEditor';
import SessionBuilder from './pages/SessionBuilder';
import SettingsPage from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import { ToastProvider } from './components/Toast';
import { ModalProvider } from './components/Modal';
import ErrorBoundary from './components/ErrorBoundary';

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

  useEffect(() => {
    async function init() {
      // 1. Ensure local DB schema is up to date
      await initDatabase();

      // 2. If Firebase is active and user is logged in, sync cloud → local
      if (isFirebaseEnabled && user?.uid) {
        // If coming from guest mode, migrate local data to Firestore first
        await migrateGuestData(user.uid);

        // Clean slate: wipe local data from previous user/session
        // and reset hooks so they install for the NEW uid.
        await clearAllLocalData();
        resetSyncHooks();

        await syncFromFirestore(user.uid);
        setupFirestoreSync(user.uid);

        // Fallback: if Firestore had no tasks (first login), seed defaults
        const taskCount = await db.tasks.count();
        if (taskCount === 0) {
          console.log('[app] No tasks after sync, re-seeding...');
          await seedDatabase();
        }
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-lg">
            {isFirebaseEnabled ? 'Sincronizando datos...' : 'Cargando base de datos...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <span className="text-xl font-bold text-teal-400">GKApp</span>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-slate-700 text-teal-400' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
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
                    isActive ? 'bg-slate-700 text-teal-400' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
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
                    isActive ? 'bg-slate-700 text-teal-400' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
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
                      isActive ? 'bg-slate-700 text-indigo-400' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
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
                    isActive ? 'bg-slate-700 text-teal-400' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
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
                    <button
                      onClick={exitGuestMode}
                      title="Salir del modo invitado (se borrarán los datos)"
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-amber-400 hover:bg-amber-900/30 hover:text-amber-300 transition-colors"
                    >
                      <LogOut size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
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
