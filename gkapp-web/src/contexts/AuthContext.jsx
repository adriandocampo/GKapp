import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseEnabled } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // If Firebase is not configured (Electron mode), treat as always logged in
  const [user, setUser]     = useState(isFirebaseEnabled ? undefined : null);
  const [loading, setLoading] = useState(isFirebaseEnabled);

  useEffect(() => {
    if (!isFirebaseEnabled) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
