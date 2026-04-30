import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ArrowUp, ArrowDown, Trash2, Save, X, Search, Calendar, Printer, LayoutTemplate, Eye, ArrowLeft } from 'lucide-react';
import { db } from '../db';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Modal';
import SessionTemplateEditor from '../components/SessionTemplateEditor';

function useTaskImageUrls(tasks) {
  const [urls, setUrls] = useState({});

  useEffect(() => {
    const newUrls = {};
    for (const task of tasks) {
      if (task.imageBlob) {
        newUrls[task.id] = URL.createObjectURL(task.imageBlob);
      } else if (task.imagePath) {
        newUrls[task.id] = task.imagePath;
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrls(prev => ({ ...prev, ...newUrls }));
    return () => {
      for (const url of Object.values(newUrls)) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      }
    };
  }, [tasks]);

  return urls;
}

function SessionDetailModal({ session, sessionTasks, allTasks, onSave, onClose, onDelete }) {
  const [name, setName] = useState(session?.name || '');
  const [date, setDate] = useState(session?.date || new Date().toISOString().split('T')[0]);
  const [tasks, setTasks] = useState(sessionTasks || []);
  const [showPicker, setShowPicker] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [search, setSearch] = useState('');
  const { addToast } = useToast();
  const confirm = useConfirm();

  const urls = useTaskImageUrls(tasks);

  const filteredPicker = allTasks.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.title?.toLowerCase().includes(s) || t.focus?.toLowerCase().includes(s);
  });

  async function handleSave(templateFields) {
    if (!name.trim()) {
      return;
    }
    const data = {
      name,
      date,
      tasks: tasks.map(t => t.id),
      updatedAt: new Date(),
    };
    if (templateFields) {
      data.templateFields = templateFields;
    } else if (session?.templateFields) {
      data.templateFields = session.templateFields;
    }

    let targetId = session?.id;
    if (!targetId) {
      data.createdAt = new Date();
      targetId = await db.sessions.add(data);
    } else {
      await db.sessions.update(targetId, data);
    }

    for (const task of tasks) {
      const exists = await db.taskHistory.where({ taskId: task.id, sessionId: targetId }).first();
      if (!exists) {
        await db.taskHistory.add({
          taskId: task.id,
          sessionId: targetId,
          sessionName: name,
          date: date || new Date().toISOString().split('T')[0],
        });
      }
    }

    onSave({ ...session, id: targetId, ...data });
    addToast('Sesión guardada', 'success');
  }

  async function handleDelete() {
    if (!session?.id) return;
    const ok = await confirm('¿Eliminar esta sesión?', { title: 'Eliminar sesión' });
    if (!ok) return;
    await db.sessions.delete(session.id);
    await db.taskHistory.where('sessionId').equals(session.id).delete();
    onDelete(session.id);
    addToast('Sesión eliminada', 'success');
  }

  function addTask(task) {
    if (tasks.find(t => t.id === task.id)) return;
    setTasks(prev => [...prev, task]);
  }

  function removeTask(index) {
    setTasks(prev => prev.filter((_, i) => i !== index));
  }

  function moveTask(index, direction) {
    setTasks(prev => {
      const newArr = [...prev];
      const target = index + direction;
      if (target < 0 || target >= newArr.length) return prev;
      [newArr[index], newArr[target]] = [newArr[target], newArr[index]];
      return newArr;
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
        <div
          className="bg-slate-800 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-lg font-bold text-slate-100">{session?.name || 'Nueva Sesión'}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTemplate(true)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm flex items-center gap-1.5 transition-colors"
              >
                <LayoutTemplate size={14} /> Plantilla
              </button>
              <button
                onClick={() => { setShowTemplate(true); setTimeout(() => window.print(), 300); }}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm flex items-center gap-1.5 transition-colors"
              >
                <Printer size={14} /> Imprimir
              </button>
              <button
                onClick={() => handleSave()}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-white text-sm flex items-center gap-1.5 transition-colors"
              >
                <Save size={14} /> Guardar
              </button>
              {session?.id && (
                <button
                  onClick={handleDelete}
                  className="p-1.5 hover:bg-red-900/30 rounded text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Session info */}
            <div className="flex flex-col md:flex-row items-center gap-4">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nombre de la sesión"
                className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
              />
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Task list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-300">Tareas ({tasks.length})</span>
                <button
                  onClick={() => setShowPicker(true)}
                  className="px-3 py-1.5 border border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-teal-500 hover:text-teal-400 text-sm flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={14} /> Añadir tarea
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No hay tareas en esta sesión</div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task, idx) => (
                    <div key={task.id + idx} className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-700">
                      <span className="text-xs text-slate-500 w-6 text-center">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200 truncate">{task.title}</div>
                        <div className="text-xs text-slate-500">{task.phase} • {task.situation} • {task.time || '-'}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveTask(idx, -1)} disabled={idx === 0} className="p-1 hover:bg-slate-700 rounded text-slate-400 disabled:opacity-30">
                          <ArrowUp size={14} />
                        </button>
                        <button onClick={() => moveTask(idx, 1)} disabled={idx === tasks.length - 1} className="p-1 hover:bg-slate-700 rounded text-slate-400 disabled:opacity-30">
                          <ArrowDown size={14} />
                        </button>
                        <button onClick={() => removeTask(idx)} className="p-1 hover:bg-red-900/30 rounded text-slate-400 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task picker */}
      {showPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={() => setShowPicker(false)}>
          <div
            className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100">Añadir tareas</h3>
              <button onClick={() => setShowPicker(false)} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="overflow-y-auto max-h-[50vh] space-y-2">
                {filteredPicker.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-teal-500/50 cursor-pointer transition-colors"
                    onClick={() => { addTask(task); setShowPicker(false); }}
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-200">{task.title}</div>
                      <div className="text-xs text-slate-500">{task.phase} • {task.situation}</div>
                    </div>
                    <Plus size={16} className="text-teal-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template editor - rendered via portal for clean printing */}
      {showTemplate && createPortal(
        <SessionTemplateEditor
          session={{ ...session, name, date }}
          sessionTasks={tasks}
          taskImageUrls={urls}
          onSave={(fields) => { handleSave(fields); setShowTemplate(false); }}
          onClose={() => setShowTemplate(false)}
        />,
        document.body
      )}
    </>
  );
}

export default function SessionBuilder() {
  const [sessions, setSessions] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedSessionTasks, setSelectedSessionTasks] = useState([]);

  useEffect(() => {
    loadSessions();
    loadAllTasks();
  }, []);

  async function loadSessions() {
    const all = await db.sessions.toArray();
    setSessions(all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  }

  async function loadAllTasks() {
    const all = await db.tasks.toArray();
    setAllTasks(all);
  }

  async function openSession(session) {
    setSelectedSession(session);
    const tasks = await db.tasks.where('id').anyOf(session.tasks || []).toArray();
    const ordered = (session.tasks || []).map(tid => tasks.find(t => t.id === tid)).filter(Boolean);
    setSelectedSessionTasks(ordered);
  }

  function openNewSession() {
    setSelectedSession({ name: 'Nueva Sesión', date: new Date().toISOString().split('T')[0], tasks: [] });
    setSelectedSessionTasks([]);
  }

  async function handleSave(updatedSession) {
    await loadSessions();
    const freshSession = await db.sessions.get(updatedSession.id);
    if (freshSession) {
      setSelectedSession(freshSession);
      const tasks = await db.tasks.where('id').anyOf(freshSession.tasks || []).toArray();
      const ordered = (freshSession.tasks || []).map(tid => tasks.find(t => t.id === tid)).filter(Boolean);
      setSelectedSessionTasks(ordered);
    }
  }

  async function handleDelete(deletedId) {
    await loadSessions();
    if (selectedSession?.id === deletedId) {
      setSelectedSession(null);
      setSelectedSessionTasks([]);
    }
  }

  return (
    <div>
      {/* Session list */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Sesiones</h1>
          <button
            onClick={openNewSession}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Nueva Sesión
          </button>
        </div>

        <div className="space-y-2">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => openSession(s)}
              className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-teal-500/30 cursor-pointer transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200">{s.name}</div>
                <div className="text-xs text-slate-500 mt-1">{s.tasks?.length || 0} tareas {s.date ? `• ${s.date}` : ''}</div>
              </div>
              <Eye size={16} className="text-slate-500" />
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg mb-2">No hay sesiones guardadas</p>
              <p className="text-sm">Crea una nueva sesión para empezar</p>
            </div>
          )}
        </div>
      </div>

      {/* Session detail modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          sessionTasks={selectedSessionTasks}
          allTasks={allTasks}
          onSave={handleSave}
          onClose={() => { setSelectedSession(null); setSelectedSessionTasks([]); }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
