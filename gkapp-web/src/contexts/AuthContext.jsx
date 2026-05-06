import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore, isFirebaseEnabled, isAdmin as checkAdmin } from '../firebase';
import { db } from '../db';
import { registerSession, teardownSessionGuard, resetSyncHooks, clearSyncQueue } from '../sync';
import { getBroadcastChannel } from './SyncContext';

const GUEST_KEY = 'gkapp_guest';
const SESSION_ID_KEY = 'gkapp_session_id';

const AuthContext = createContext(null);

function loadGuestState() {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.startedAt) return null;
    return data;
  } catch {
    localStorage.removeItem(GUEST_KEY);
    return null;
  }
}

export async function clearGuestData() {
  localStorage.removeItem(GUEST_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  try {
    await db.delete();
    console.log('[guest] IndexedDB cleared');
  } catch (err) {
    console.error('[guest] Error clearing IndexedDB', err);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(isFirebaseEnabled ? undefined : null);
  const [loading, setLoading] = useState(isFirebaseEnabled);
  const [isGuest, setIsGuest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionKicked, setSessionKicked] = useState(false);
  const kickedRef = useRef(false);

  const performForceSignout = useCallback(async (reason) => {
    if (kickedRef.current) return;
    kickedRef.current = true;

    console.warn('[auth] Force signout:', reason);
    teardownSessionGuard();
    resetSyncHooks();
    await clearSyncQueue();

    try {
      await signOut(auth);
    } catch { /* ignore */ }

    localStorage.removeItem(SESSION_ID_KEY);
    setSessionKicked(true);
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isFirebaseEnabled) return;

    const guest = loadGuestState();
    if (guest) {
      setIsGuest(true);
      setUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsAdmin(checkAdmin(u));
      setLoading(false);
      kickedRef.current = false;

      if (u && firestore) {
        try {
          await registerSession(u.uid);
        } catch (err) {
          console.warn('[auth] Failed to register session', err);
        }

        setDoc(
          doc(firestore, 'userProfiles', u.uid),
          {
            email: u.email,
            displayName: u.displayName || null,
            photoURL: u.photoURL || null,
            lastSeenAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(err => console.warn('[auth] Failed to save user profile', err));
      } else {
        localStorage.removeItem(SESSION_ID_KEY);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const bc = getBroadcastChannel();
    if (!bc) return;

    const handler = (event) => {
      const { type } = event.data ?? {};
      if (type === 'force-signout') {
        performForceSignout('Otra pestaña recibió kick de sesión');
      }
    };
    bc.addEventListener('message', handler);
    return () => bc.removeEventListener('message', handler);
  }, [performForceSignout]);

  const enterGuestMode = async () => {
    await clearGuestData();
    localStorage.setItem(GUEST_KEY, JSON.stringify({ startedAt: Date.now() }));
    setIsGuest(true);
    setUser(null);
    window.location.reload();
  };

  const exitGuestMode = async () => {
    await clearGuestData();
    setIsGuest(false);
    setSessionKicked(false);
    kickedRef.current = false;
    window.location.reload();
  };

  const clearKicked = useCallback(() => {
    setSessionKicked(false);
    kickedRef.current = false;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, isAdmin, sessionKicked, enterGuestMode, exitGuestMode, clearKicked, performForceSignout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
