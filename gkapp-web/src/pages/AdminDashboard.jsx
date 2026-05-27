import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listUserProfiles,
  getUserDataCounts,
  exportAllUserData,
  purgeUserData,
  restoreDefaultTagsForUser,
  restoreDefaultTasksForUser,
  getBackupConfig,
  setBackupConfig,
  createBackup,
  getBackup,
} from '../utils/adminFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm, useAlert } from '../components/Modal';
import {
  Shield, Users, Download, Trash2, Eye, ArrowLeft,
  Database, ClipboardList, Tag, Calendar, Settings,
  Loader2, Search, FileJson, RotateCcw
} from 'lucide-react';
import UserDataViewer from '../components/UserDataViewer';

function CountBadge({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gk-text-tertiary">
      <Icon size={13} />
      <span>{label}:</span>
      <span className="font-medium text-gk-text-primary">{count ?? 0}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const alert = useAlert();

  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUid, setSelectedUid] = useState(null);
  const [backupConfigs, setBackupConfigs] = useState({});
  const [backupDates, setBackupDates] = useState({});
  const [forcingBackup, setForcingBackup] = useState({});

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const profiles = await listUserProfiles();
      // Sort by lastSeenAt desc
      profiles.sort((a, b) => {
        const ta = a.lastSeenAt?.toMillis?.() || 0;
        const tb = b.lastSeenAt?.toMillis?.() || 0;
        return tb - ta;
      });
      setUsers(profiles);

      // Load counts in parallel
      const countsMap = {};
      await Promise.all(
        profiles.map(async (u) => {
          try {
            countsMap[u.uid] = await getUserDataCounts(u.uid);
          } catch (e) {
            countsMap[u.uid] = {};
          }
        })
      );
      setCounts(countsMap);

      // Load backup configs and latest backup dates in parallel
      const configMap = {};
      const dateMap = {};
      await Promise.all(
        profiles.map(async (u) => {
          try {
            const [config, backupMeta] = await Promise.all([
              getBackupConfig(u.uid),
              getBackup(u.uid),
            ]);
            if (config) configMap[u.uid] = config;
            if (backupMeta) dateMap[u.uid] = backupMeta._createdAt;
          } catch (e) {
            // ignore
          }
        })
      );
      setBackupConfigs(configMap);
      setBackupDates(dateMap);
    } catch (err) {
      console.error(err);
      addToast('Error cargando usuarios', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadUsers();
  }, [isAdmin, navigate, loadUsers]);

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (u.displayName || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s)
    );
  });

  async function handleExport(uid) {
    try {
      const data = await exportAllUserData(uid);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gkapp_backup_${uid}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('Backup descargado', 'success');
    } catch (err) {
      addToast('Error exportando: ' + err.message, 'error');
    }
  }

  async function handleDelete(uid, displayName) {
    const ok = await confirm(
      `Vas a eliminar TODOS los datos de "${displayName || uid}". La cuenta de Google no se borrará, solo los datos de la app. ¿Continuar?`,
      { title: 'Eliminar usuario', confirmText: 'Eliminar', confirmColor: 'red' }
    );
    if (!ok) return;
    try {
      await purgeUserData(uid);
      addToast('Usuario eliminado', 'success');
      setUsers(prev => prev.filter(u => u.uid !== uid));
      setCounts(prev => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
    } catch (err) {
      addToast('Error eliminando: ' + err.message, 'error');
    }
  }

  async function handleRestoreDefaults(uid, displayName) {
    const ok = await confirm(
      `¿Restaurar tareas predefinidas y etiquetas estándar para "${displayName || uid}"? Esto no afectará sus tareas o etiquetas personalizadas.`,
      { title: 'Restaurar datos por defecto', confirmText: 'Restaurar' }
    );
    if (!ok) return;
    try {
      const tasksCount = await restoreDefaultTasksForUser(uid);
      const tagsCount = await restoreDefaultTagsForUser(uid);
      addToast(`Restauradas ${tasksCount} tareas y ${tagsCount} etiquetas`, 'success');
      // Refresh counts
      const newCounts = await getUserDataCounts(uid);
      setCounts(prev => ({ ...prev, [uid]: newCounts }));
    } catch (err) {
      addToast('Error restaurando: ' + err.message, 'error');
    }
  }

  async function handleToggleBackup(uid, enabled) {
    try {
      const config = {
        enabled,
        intervalDays: 7,
        updatedAt: new Date().toISOString(),
      };
      await setBackupConfig(uid, config);
      setBackupConfigs(prev => ({ ...prev, [uid]: config }));
      addToast(enabled ? 'Backup automático activado' : 'Backup automático desactivado', 'success');
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
  }

  async function handleForceBackup(uid) {
    setForcingBackup(prev => ({ ...prev, [uid]: true }));
    try {
      const result = await createBackup(uid);
      const now = new Date();
      setBackupDates(prev => ({ ...prev, [uid]: now }));
      addToast(`Backup completado (${(result.size / 1024).toFixed(1)} KB)`, 'success');
    } catch (err) {
      addToast('Error en backup: ' + err.message, 'error');
    } finally {
      setForcingBackup(prev => ({ ...prev, [uid]: false }));
    }
  }

  function formatBackupDate(timestamp) {
    if (!timestamp) return null;
    const d = timestamp?.toDate?.() || new Date(timestamp);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  if (selectedUid) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedUid(null)}
            className="p-2 hover:bg-gk-card rounded-lg text-gk-text-tertiary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold font-serif text-gk-text-primary tracking-tight">Datos de usuario</h1>
        </div>
        <UserDataViewer uid={selectedUid} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-indigo-600/20 rounded-lg">
          <Shield size={24} className="text-stat-indigo" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-serif text-gk-text-primary tracking-tight">Panel de Administración</h1>
          <p className="text-sm text-gk-text-tertiary">Gestiona usuarios, datos y backups</p>
        </div>
      </div>

      <div className="bg-gk-card rounded-xl border border-gk-border p-4">
        <div className="flex items-center gap-3 mb-4">
          <Users size={18} className="text-gk-text-tertiary" />
          <h2 className="text-sm font-semibold text-gk-text-secondary uppercase tracking-wider">Usuarios registrados</h2>
          <span className="ml-auto text-xs text-gk-text-tertiary">{users.length} total</span>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gk-text-tertiary" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gk-page border border-gk-border rounded-lg text-sm text-gk-text-primary placeholder-gk-text-tertiary focus:outline-none focus:border-gk-accent"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-gk-text-tertiary animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gk-text-tertiary text-sm">No hay usuarios registrados</div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map(u => {
              const c = counts[u.uid] || {};
              return (
                <div
                  key={u.uid}
                  className="flex items-center gap-4 p-3 bg-gk-page rounded-lg border border-gk-border/50 hover:border-gk-border-hover transition-colors"
                >
                  <img
                    src={u.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
                    alt=""
                    className="w-10 h-10 rounded-full bg-gk-card object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gk-text-primary truncate">
                      {u.displayName || 'Sin nombre'}
                    </div>
                    <div className="text-xs text-gk-text-tertiary truncate">{u.email}</div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <CountBadge icon={Database} label="Tareas" count={`${c.tasksActive ?? 0}${c.tasksDeleted ? ` (${c.tasksDeleted} elim.)` : ''}`} />
                      <CountBadge icon={ClipboardList} label="Sesiones" count={`${c.sessionsActive ?? 0}${c.sessionsDeleted ? ` (${c.sessionsDeleted} elim.)` : ''}`} />
                      <CountBadge icon={Tag} label="Tags" count={c.tags} />
                      <CountBadge icon={Calendar} label="Temporadas" count={`${c.seasonsActive ?? 0}${c.seasonsDeleted ? ` (${c.seasonsDeleted} elim.)` : ''}`} />
                      <CountBadge icon={Settings} label="Ajustes" count={c.settings} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setSelectedUid(u.uid)}
                      title="Ver datos"
                      className="p-2 bg-gk-card hover:bg-gk-elevated rounded-lg text-gk-text-secondary transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleExport(u.uid)}
                      title="Exportar backup"
                      className="p-2 bg-gk-card hover:bg-gk-elevated rounded-lg text-gk-accent transition-colors"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => handleForceBackup(u.uid)}
                      disabled={forcingBackup[u.uid]}
                      title={forcingBackup[u.uid] ? 'Creando backup...' : 'Forzar backup ahora'}
                      className="p-2 bg-gk-card hover:bg-gk-elevated rounded-lg text-cyan-400 transition-colors disabled:opacity-40"
                    >
                      {forcingBackup[u.uid] ? <Loader2 size={16} className="animate-spin" /> : <FileJson size={16} />}
                    </button>
                    <button
                      onClick={() => handleToggleBackup(u.uid, !backupConfigs[u.uid]?.enabled)}
                      title={backupConfigs[u.uid]?.enabled ? 'Desactivar backup automático (7d)' : 'Activar backup automático (7d)'}
                      className={`p-2 rounded-lg transition-colors ${backupConfigs[u.uid]?.enabled ? 'bg-gk-accent/15 text-gk-accent' : 'bg-gk-card text-gk-text-tertiary hover:text-gk-text-secondary'}`}
                    >
                      <Database size={16} />
                    </button>
                    <button
                      onClick={() => handleRestoreDefaults(u.uid, u.displayName)}
                      title="Restaurar tareas y etiquetas por defecto"
                      className="p-2 bg-gk-card hover:bg-gk-elevated rounded-lg text-amber-400 transition-colors"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(u.uid, u.displayName)}
                      title="Eliminar usuario"
                      className="p-2 bg-gk-card hover:bg-red-900/30 rounded-lg text-gk-text-tertiary hover:text-stat-rose transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="text-[10px] text-right shrink-0 w-28 leading-tight">
                    {forcingBackup[u.uid] ? (
                      <span className="text-cyan-400">Creando backup...</span>
                    ) : backupDates[u.uid] ? (
                      <span className="text-gk-text-tertiary">Backup: {formatBackupDate(backupDates[u.uid])}</span>
                    ) : (
                      <span className="text-gk-text-tertiary/40">Sin backup</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
