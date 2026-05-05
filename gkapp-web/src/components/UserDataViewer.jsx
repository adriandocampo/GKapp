import React, { useEffect, useState, useMemo } from 'react';
import {
  getUserCollection,
  updateUserDocument,
  deleteUserDocument,
  importAllUserData,
} from '../utils/adminFirestore';
import { useToast } from '../components/Toast';
import { useConfirm, usePrompt } from '../components/Modal';
import {
  Database, ClipboardList, Tag, Calendar, Settings, History,
  ChevronDown, ChevronUp, Trash2, Edit3, Plus, Upload,
  Save, X, Loader2, FileJson, Search, RotateCcw
} from 'lucide-react';

const TABLE_META = {
  tasks:      { label: 'Tareas',       icon: Database },
  sessions:   { label: 'Sesiones',     icon: ClipboardList },
  tags:       { label: 'Tags',         icon: Tag },
  seasons:    { label: 'Temporadas',   icon: Calendar },
  settings:   { label: 'Ajustes',      icon: Settings },
  taskHistory:{ label: 'Historial',    icon: History },
};

function JsonEditor({ value, onChange, readOnly = false }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState('');

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  function handleBlur() {
    try {
      const parsed = JSON.parse(text);
      setError('');
      onChange?.(parsed);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-1">
      <textarea
        value={text}
        readOnly={readOnly}
        onChange={e => setText(e.target.value)}
        onBlur={handleBlur}
        rows={12}
        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-teal-500 resize-y"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function UserDataViewer({ uid }) {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();

  const [activeTable, setActiveTable] = useState('tasks');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');

  const load = async (table) => {
    setLoading(true);
    try {
      const data = await getUserCollection(uid, table);
      // Sort by createdAt/date desc (newest first)
      data.sort((a, b) => {
        const da = a.createdAt || a.date || a.id;
        const db_ = b.createdAt || b.date || b.id;
        if (typeof da === 'string' && typeof db_ === 'string') return da.localeCompare(db_);
        return (da || 0) - (db_ || 0);
      });
      setRows(data);
    } catch (err) {
      addToast('Error cargando datos: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeTable);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable, uid]);

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(r =>
      JSON.stringify(r).toLowerCase().includes(s)
    );
  }, [rows, search]);

  async function handleSave(row) {
    try {
      await updateUserDocument(uid, activeTable, row.id, row);
      addToast('Guardado correctamente', 'success');
    } catch (err) {
      addToast('Error guardando: ' + err.message, 'error');
    }
  }

  async function handleDelete(row) {
    const ok = await confirm(`¿Eliminar este documento (${row.id})?`, { title: 'Eliminar', confirmColor: 'red' });
    if (!ok) return;
    try {
      await deleteUserDocument(uid, activeTable, row.id);
      setRows(prev => prev.filter(r => r.id !== row.id));
      addToast('Eliminado', 'success');
    } catch (err) {
      addToast('Error eliminando: ' + err.message, 'error');
    }
  }

  async function handleRestore(row) {
    try {
      const restored = { ...row, deletedAt: null };
      await updateUserDocument(uid, activeTable, row.id, restored);
      setRows(prev => prev.map(r => r.id === row.id ? restored : r));
      addToast('Restaurado correctamente', 'success');
    } catch (err) {
      addToast('Error restaurando: ' + err.message, 'error');
    }
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const ok = await confirm(
        'Esto importará datos desde el JSON seleccionado. Los documentos existentes con el mismo ID se sobrescribirán. ¿Continuar?',
        { title: 'Importar datos' }
      );
      if (!ok) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importAllUserData(uid, data);
        addToast('Datos importados correctamente', 'success');
        load(activeTable);
      } catch (err) {
        addToast('Error importando: ' + err.message, 'error');
      }
    };
    input.click();
  }

  async function handleCreate() {
    const raw = await prompt('Pega el JSON del nuevo documento:', {
      placeholder: '{"title":"Nueva tarea",...}',
      required: true,
    });
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      if (!obj.id) {
        obj.id = String(Date.now());
      }
      await updateUserDocument(uid, activeTable, obj.id, obj);
      setRows(prev => [obj, ...prev]);
      addToast('Documento creado', 'success');
    } catch (err) {
      addToast('Error creando: ' + err.message, 'error');
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TABLE_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const active = activeTable === key;
          return (
            <button
              key={key}
              onClick={() => { setActiveTable(key); setExpandedId(null); setSearch(''); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                active
                  ? 'bg-teal-600/20 border-teal-500/40 text-teal-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <Icon size={15} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="text"
            placeholder="Buscar en JSON..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-white text-sm font-medium transition-colors"
        >
          <Plus size={14} /> Nuevo
        </button>
        <button
          onClick={handleImport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium transition-colors"
        >
          <Upload size={14} /> Importar
        </button>
      </div>

      {/* Rows */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-slate-500 animate-spin" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No hay documentos</div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {filteredRows.map(row => {
              const isOpen = expandedId === row.id;
              const isDeleted = !!row.deletedAt;
              return (
                <div key={row.id} className={`p-3 ${isDeleted ? 'opacity-50 bg-slate-900/40' : ''}`}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedId(isOpen ? null : row.id)}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 transition-colors"
                    >
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {row.title || row.name || row.key || `ID: ${row.id}`}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {row.id}
                        {isDeleted && (
                          <span className="ml-2 text-red-400">
                            Eliminado el {new Date(row.deletedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isDeleted && (
                        <button
                          onClick={() => handleRestore(row)}
                          className="p-1.5 hover:bg-teal-900/30 rounded text-teal-400 hover:text-teal-300 transition-colors"
                          title="Restaurar"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(row)}
                        className="p-1.5 hover:bg-red-900/30 rounded text-slate-400 hover:text-red-400 transition-colors"
                        title="Eliminar permanentemente"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 pl-8">
                      <JsonEditor
                        value={row}
                        onChange={(updated) => {
                          setRows(prev => prev.map(r => r.id === row.id ? updated : r));
                        }}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => setExpandedId(null)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm transition-colors flex items-center gap-1"
                        >
                          <X size={14} /> Cerrar
                        </button>
                        <button
                          onClick={() => handleSave(row)}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-white text-sm transition-colors flex items-center gap-1"
                        >
                          <Save size={14} /> Guardar cambios
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
