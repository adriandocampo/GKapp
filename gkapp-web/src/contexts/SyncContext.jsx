import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SyncContext = createContext(null);

let bc = null;
try {
  bc = new BroadcastChannel('gkapp_sync');
} catch {
  bc = null;
}

export function SyncProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!bc) return;
    const handler = (event) => {
      const { type } = event.data ?? {};
      if (type === 'local-change' || type === 'sync-complete') {
        setRefreshKey(k => k + 1);
      }
    };
    bc.addEventListener('message', handler);
    return () => bc.removeEventListener('message', handler);
  }, []);

  const broadcastChange = useCallback((type, payload) => {
    if (bc) {
      try { bc.postMessage({ type, ...payload }); } catch { /* ignore */ }
    }
  }, []);

  return (
    <SyncContext.Provider value={{ refreshKey, broadcastChange }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncRefresh() {
  const ctx = useContext(SyncContext);
  if (!ctx) return { refreshKey: 0, broadcastChange: () => {} };
  return ctx;
}

export function getBroadcastChannel() {
  return bc;
}
