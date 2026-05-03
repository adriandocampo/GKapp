import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseEnabled } from '../firebase';
import { db } from '../db';

const GUEST_KEY = 'gkapp_guest';
const GUEST_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const AuthContext = createContext(null);

function loadGuestState() {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.startedAt) return null;
    const elapsed = Date.now() - data.startedAt;
    if (elapsed > GUEST_TTL_MS) {
      console.log('[guest] Session expired, clearing data...');
      localStorage.removeItem(GUEST_KEY);
      return null;
    }
    return data;
  } catch {
    localStorage.removeItem(GUEST_KEY);
    return null;
  }
}

export async function clearGuestData() {
  localStorage.removeItem(GUEST_KEY);
  try {
    await db.delete();
    console.log('[guest] IndexedDB cleared');
  } catch (err) {
    console.error('[guest] Error clearing IndexedDB', err);
  }
}

export function AuthProvider({ children }) {
  // If Firebase is not configured (Electron mode), treat as always logged in
  const [user, setUser]     = useState(isFirebaseEnabled ? undefined : null);
  const [loading, setLoading] = useState(isFirebaseEnabled);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    if (!isFirebaseEnabled) return;

    // Check for active guest session BEFORE Firebase auth resolves
    const guest = loadGuestState();
    if (guest) {
      setIsGuest(true);
      setUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const enterGuestMode = async () => {
    // If there was previous user data, clear it first for a clean guest session
    await clearGuestData();
    localStorage.setItem(GUEST_KEY, JSON.stringify({ startedAt: Date.now() }));
    setIsGuest(true);
    setUser(null);
    // Force reload to re-initialize Dexie with a fresh database
    window.location.reload();
  };

  const exitGuestMode = async () => {
    await clearGuestData();
    setIsGuest(false);
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, enterGuestMode, exitGuestMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
