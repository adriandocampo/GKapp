import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listUserProfiles,
  getUserDataCounts,
  exportAllUserData,
  purgeUserData,
} from '../utils/adminFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm, useAlert } from '../components/Modal';
import {
  Shield, Users, Download, Trash2, Eye, ArrowLeft,
  Database, ClipboardList, Tag, Calendar, Settings,
  Loader2, Search, FileJson
} from 'lucide-react';
import UserDataViewer from '../components/UserDataViewer';

function CountBadge({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400">
      <Icon size={13} />
      <span>{label}:</span>
      <span className="font-medium text-slate-200">{count ?? 0}</span>
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

  if (selectedUid) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedUid(null)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-slate-100">Datos de usuario</h1>
        </div>
        <UserDataViewer uid={selectedUid} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-indigo-600/20 rounded-lg">
          <Shield size={24} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">Panel de Administración</h1>
          <p className="text-sm text-slate-400">Gestiona usuarios, datos y backups</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-3 mb-4">
          <Users size={18} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Usuarios registrados</h2>
          <span className="ml-auto text-xs text-slate-500">{users.length} total</span>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-slate-500 animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No hay usuarios registrados</div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map(u => {
              const c = counts[u.uid] || {};
              return (
                <div
                  key={u.uid}
                  className="flex items-center gap-4 p-3 bg-slate-900 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"
                >
                  <img
                    src={u.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
                    alt=""
                    className="w-10 h-10 rounded-full bg-slate-800 object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate">
                      {u.displayName || 'Sin nombre'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{u.email}</div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <CountBadge icon={Database} label="Tareas" count={c.tasks} />
                      <CountBadge icon={ClipboardList} label="Sesiones" count={c.sessions} />
                      <CountBadge icon={Tag} label="Tags" count={c.tags} />
                      <CountBadge icon={Calendar} label="Temporadas" count={c.seasons} />
                      <CountBadge icon={Settings} label="Ajustes" count={c.settings} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedUid(u.uid)}
                      title="Ver datos"
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleExport(u.uid)}
                      title="Exportar backup"
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-teal-400 transition-colors"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(u.uid, u.displayName)}
                      title="Eliminar usuario"
                      className="p-2 bg-slate-800 hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
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
