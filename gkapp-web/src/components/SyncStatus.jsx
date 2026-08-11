import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getSyncQueueStatus, flushSyncQueue } from '../sync';
import { isFirebaseEnabled } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';

const POLL_INTERVAL_MS = 5000;

export default function SyncStatus() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const timerRef = useRef(null);

  const refresh = async () => {
    if (!isFirebaseEnabled || !user?.uid) return;
    try {
      const status = await getSyncQueueStatus();
      setPending(status.pending || 0);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!isFirebaseEnabled || !user?.uid) return;

    refresh();
    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    const bc = new BroadcastChannel('gkapp_sync');
    bc.onmessage = () => refresh();

    return () => {
      clearInterval(timerRef.current);
      bc.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  if (!isFirebaseEnabled || !user?.uid) return null;

  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const remaining = await flushSyncQueue();
      await refresh();
      if (remaining === 0) {
        addToast('Sincronización completada', 'success');
      } else if (remaining > 0) {
        addToast(`Quedan ${remaining} cambios pendientes de subir`, 'warning', 6000);
      }
    } catch (err) {
      addToast('Error al sincronizar: ' + err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (pending === 0) return null;

  return (
    <button
      onClick={handleSyncNow}
      disabled={syncing}
      title={`${pending} cambio(s) pendientes de subir a la nube. Haz clic para sincronizar ahora.`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-colors"
    >
      <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
      {syncing ? 'Sincronizando…' : `${pending} pendiente${pending !== 1 ? 's' : ''}`}
    </button>
  );
}
