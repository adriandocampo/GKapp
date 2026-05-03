import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X, Eye, Plus, FileText, Clock, Repeat, ClipboardList, ChevronLeft, ChevronRight, ImageIcon, Download, Upload, Star, ArrowUpDown, Video } from 'lucide-react';
import { db } from '../db';
import { extractYouTubeId, youtubeEmbedUrl } from '../hooks/useYouTubeUpload';
import { useTags } from '../hooks/useTags';
import { useToast } from '../components/Toast';
import { useConfirm, usePrompt, useAlert } from '../components/Modal';
import { formatDateDDMMYY, todayISO } from '../utils/date';

function useTaskImageUrls(tasks) {
  const [urls, setUrls] = useState({});
  const [videoUrls, setVideoUrls] = useState({});

  useEffect(() => {
    const newUrls = {};
    const newVideoUrls = {};
    let needsUpdate = false;
    let needsVideoUpdate = false;

    for (const task of tasks) {
      if (task.imageBlob && !urls[task.id]) {
        newUrls[task.id] = URL.createObjectURL(task.imageBlob);
        needsUpdate = true;
      } else if (task.imagePath && !urls[task.id]) {
        newUrls[task.id] = task.imagePath;
        needsUpdate = true;
      }
      if (task.videoBlob && !videoUrls[task.id]) {
        newVideoUrls[task.id] = URL.createObjectURL(task.videoBlob);
        needsVideoUpdate = true;
      } else if (task.videoPath && !videoUrls[task.id]) {
        newVideoUrls[task.id] = task.videoPath;
        needsVideoUpdate = true;
      }
    }

    if (needsUpdate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrls(prev => ({ ...prev, ...newUrls }));
    }
    if (needsVideoUpdate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVideoUrls(prev => ({ ...prev, ...newVideoUrls }));
    }

    return () => {
      for (const id of Object.keys(newUrls)) {
        const task = tasks.find(t => t.id === id);
        if (task?.imageBlob && urls[id] && urls[id] !== task.imagePath) {
          URL.revokeObjectURL(urls[id]);
        }
      }
      for (const id of Object.keys(newVideoUrls)) {
        const task = tasks.find(t => t.id === id);
        if (task?.videoBlob && videoUrls[id] && videoUrls[id] !== task.videoPath) {
          URL.revokeObjectURL(videoUrls[id]);
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const getUrl = useCallback((task) => {
    if (task.imageBlob) return urls[task.id] || null;
    return task.imagePath || null;
  }, [urls]);

  const getVideoUrl = useCallback((task) => {
    if (task.videoBlob) return videoUrls[task.id] || null;
    return task.videoPath || null;
  }, [videoUrls]);

  return { getUrl, getVideoUrl };
}

function StarRating({ rating, interactive = false, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(i === rating ? 0 : i)}
          onMouseEnter={() => interactive && setHover(i)}
          onMouseLeave={() => interactive && setHover(0)}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          <Star
            size={14}
            className={i <= (hover || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}
          />
        </button>
      ))}
    </div>
  );
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return 'Nunca';
  const parts = dateStr.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = date - today;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  if (diffDays === -1) return 'Ayer';
  if (diffDays > 1 && diffDays < 30) return `En ${diffDays} días`;
  if (diffDays < 0 && diffDays > -30) return `Hace ${Math.abs(diffDays)} días`;
  const absDays = Math.abs(diffDays);
  const diffMonths = Math.floor(absDays / 30);
  const remainingDays = absDays - diffMonths * 30;
  const prefix = diffDays < 0 ? 'Hace' : 'En';
  if (diffMonths === 1 && remainingDays === 0) return `${prefix} 1 mes`;
  if (diffMonths === 1) return `${prefix} 1 mes y ${remainingDays} días`;
  if (remainingDays === 0) return `${prefix} ${diffMonths} meses`;
  return `${prefix} ${diffMonths} meses y ${remainingDays} días`;
}

const TaskCard = React.memo(function TaskCard({ task, imageUrl, onClick }) {
  return (
    <div
      className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-teal-500/50 transition-all cursor-pointer group relative"
      onClick={() => onClick(task)}
    >
      <div className="aspect-video bg-slate-900 relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={task.title}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <FileText size={32} />
          </div>
        )}
        {task.youtubeUrl || task.videoBlob || task.videoPath ? (
          <div className="absolute bottom-2 right-2 bg-black/70 rounded-full p-1.5">
            <Video size={14} className="text-white" />
          </div>
        ) : null}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-slate-100 text-sm mb-1 line-clamp-2">{task.title}</h3>
        {task.subtitle && (
          <p className="text-xs text-slate-400 mb-2 line-clamp-1">{task.subtitle}</p>
        )}
        <div className="flex items-center gap-2 mb-1">
          <StarRating rating={task.rating || 0} />
          {task.usageCount > 0 && (
            <span className="text-xs text-slate-500">({task.usageCount})</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {task.time && (
            <span className="flex items-center gap-1">
              <Clock size={12} /> {task.time}
            </span>
          )}
          {task.reps && (
            <span className="flex items-center gap-1">
              <Repeat size={12} /> {task.reps}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">{task.phase}</span>
          <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">{task.category}</span>
          {task.situation && task.situation !== 'Otro' && (
            <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">{task.situation}</span>
          )}
        </div>
      </div>
    </div>
  );
});

export default function DatabasePage() {
  const [tasks, setTasks] = useState([]);
  const [filters, setFilters] = useState({ phase: '', category: '', situation: '', search: '' });
  const [sortBy, setSortBy] = useState('createdAt');
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [detailImageUrl, setDetailImageUrl] = useState(null);
  const [detailVideoUrl, setDetailVideoUrl] = useState(null);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [taskToAdd, setTaskToAdd] = useState(null);
  const [taskHistory, setTaskHistory] = useState([]);
  const [feedback, setFeedback] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { tags } = useTags();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const alert = useAlert();

  const { getUrl, getVideoUrl } = useTaskImageUrls(tasks);

  useEffect(() => {
    loadTasks();
    loadSessions();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get('task');
    const addToSession = params.get('addToSession');
    if (taskId) {
      db.tasks.get(taskId).then(t => {
        if (t) {
          openDetail(t);
          if (addToSession === 'true') {
            setTimeout(() => {
              setTaskToAdd(t);
              setShowSessionPicker(true);
            }, 300);
          }
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  async function loadTasks() {
    const all = await db.tasks.toArray();
    const sorted = all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    setTasks(sorted);
  }

  async function loadSessions() {
    const all = await db.sessions.toArray();
    setSessions(all);
  }

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => {
      if (filters.phase && t.phase !== filters.phase) return false;
      if (filters.category && t.category !== filters.category) return false;
      if (filters.situation && t.situation !== filters.situation) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        return (
          t.title?.toLowerCase().includes(s) ||
          t.subtitle?.toLowerCase().includes(s) ||
          t.focus?.toLowerCase().includes(s) ||
          t.description?.toLowerCase().includes(s)
        );
      }
      return true;
    });

    if (sortBy === 'rating') {
      result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else {
      result = [...result].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return result;
  }, [tasks, filters, sortBy]);

  function clearFilters() {
    setFilters({ phase: '', category: '', situation: '', search: '' });
  }

  async function openDetail(task) {
    setSelectedTask(task);
    setFeedback(task.feedback || '');
    const idx = filteredTasks.findIndex(t => t.id === task.id);
    setSelectedIndex(idx);
    const url = getUrl(task);
    setDetailImageUrl(url);
    const vUrl = getVideoUrl(task);
    setDetailVideoUrl(vUrl);
    const hist = await db.taskHistory.where('taskId').equals(task.id).reverse().toArray();
    const allSessions = await db.sessions.toArray();
    const sessionMap = {};
    for (const s of allSessions) {
      sessionMap[s.id] = s.name;
    }
    const validHist = hist.filter(h => Object.hasOwn(sessionMap, h.sessionId));
    const enrichedHist = validHist.map(h => ({
      ...h,
      sessionName: sessionMap[h.sessionId],
    }));
    const actualUsageCount = enrichedHist.length;
    const lastUsedDate = enrichedHist.length > 0 ? enrichedHist[0].date : null;
    setSelectedTask({ ...task, usageCount: actualUsageCount, lastUsedDate });
    setTaskHistory(enrichedHist);
  }

  function closeDetail() {
    setSelectedTask(null);
    setSelectedIndex(-1);
    setDetailImageUrl(null);
    setDetailVideoUrl(null);
    setTaskHistory([]);
    setFeedback('');
    navigate('/', { replace: true });
  }

  function goToTask(offset) {
    const newIndex = selectedIndex + offset;
    if (newIndex < 0 || newIndex >= filteredTasks.length) return;
    openDetail(filteredTasks[newIndex]);
  }

  function openSessionPicker(task) {
    setTaskToAdd(task);
    setShowSessionPicker(true);
  }

  async function addToSession(sessionId) {
    if (!taskToAdd) return;
    const session = await db.sessions.get(sessionId);
    if (!session) return;
    const currentTasks = session.tasks || [];
    if (currentTasks.includes(taskToAdd.id)) {
      await alert('Esta tarea ya está en la sesión');
      return;
    }
    await db.sessions.update(sessionId, {
      tasks: [...currentTasks, taskToAdd.id],
      updatedAt: new Date(),
    });
    await db.taskHistory.add({
      taskId: taskToAdd.id,
      sessionId,
      sessionName: session.name,
      date: session.date || todayISO(),
    });
    await db.tasks.update(taskToAdd.id, {
      usageCount: (taskToAdd.usageCount || 0) + 1,
      lastUsedDate: todayISO(),
    });
    setShowSessionPicker(false);
    setTaskToAdd(null);
    addToast('Tarea añadida a la sesión', 'success');
    loadTasks();
  }

  async function createSessionAndAdd() {
    if (!taskToAdd) return;
    const allSeasons = await db.seasons.toArray();
    if (allSeasons.length === 0) {
      addToast('Crea una temporada primero en la sección de Sesiones', 'warning');
      return;
    }
    const name = await prompt('Nombre de la nueva sesión:', { placeholder: 'Mi sesión', required: true });
    if (!name) return;
    const lastSeason = allSeasons[allSeasons.length - 1];
    const date = todayISO();
    const newId = await db.sessions.add({
      name,
      date,
      tasks: [taskToAdd.id],
      createdAt: new Date(),
      updatedAt: new Date(),
      seasonId: lastSeason.id,
    });
    await db.taskHistory.add({
      taskId: taskToAdd.id,
      sessionId: newId,
      sessionName: name,
      date,
    });
    await db.tasks.update(taskToAdd.id, {
      usageCount: (taskToAdd.usageCount || 0) + 1,
      lastUsedDate: todayISO(),
    });
    setShowSessionPicker(false);
    setTaskToAdd(null);
    navigate(`/sessions/${newId}`);
    loadTasks();
  }

  async function updateTaskRating(taskId, rating) {
    await db.tasks.update(taskId, { rating });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, rating } : t));
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => ({ ...prev, rating }));
    }
  }

  async function saveFeedback() {
    if (!selectedTask) return;
    await db.tasks.update(selectedTask.id, { feedback });
    setSelectedTask(prev => ({ ...prev, feedback }));
    addToast('Feedback guardado', 'success');
  }

  function downloadImage(task) {
    const url = getUrl(task);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `tarea_${task.title.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function exportData() {
    const allTasks = await db.tasks.toArray();
    const allSessions = await db.sessions.toArray();
    const allTags = await db.tags.toArray();
    const allHistory = await db.taskHistory.toArray();
    const allSeasons = await db.seasons.toArray();
    const data = { tasks: allTasks, sessions: allSessions, tags: allTags, taskHistory: allHistory, seasons: allSeasons, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gkapp_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('Datos exportados correctamente', 'success');
  }

  async function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const ok = await confirm('Esto reemplazará todos los datos actuales. ¿Continuar?', { title: 'Importar datos' });
      if (!ok) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await db.tasks.clear();
        await db.sessions.clear();
        await db.tags.clear();
        await db.taskHistory.clear();
        await db.seasons.clear();
        if (data.tasks?.length) await db.tasks.bulkAdd(data.tasks);
        if (data.sessions?.length) await db.sessions.bulkAdd(data.sessions);
        if (data.tags?.length) await db.tags.bulkAdd(data.tags);
        if (data.taskHistory?.length) await db.taskHistory.bulkAdd(data.taskHistory);
        if (data.seasons?.length) await db.seasons.bulkAdd(data.seasons);
        await loadTasks();
        await loadSessions();
        addToast('Datos importados correctamente', 'success');
      } catch (err) {
        addToast('Error al importar: ' + err.message, 'error');
      }
    };
    input.click();
  }

  const safeDesc = (desc) => {
    if (!desc) return desc;
    return desc.replace(/\\n/g, '\n');
  };

  return (
    <div>
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar tarea..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <select
            value={filters.phase}
            onChange={e => setFilters(f => ({ ...f, phase: e.target.value }))}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
          >
            <option value="">Todas las fases</option>
            {tags.phase.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filters.category}
            onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
          >
            <option value="">Todas las categorías</option>
            {tags.category.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filters.situation}
            onChange={e => setFilters(f => ({ ...f, situation: e.target.value }))}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
          >
            <option value="">Todas las situaciones</option>
            {tags.situation.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(filters.phase || filters.category || filters.situation || filters.search) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 flex items-center gap-2 transition-colors"
            >
              <X size={16} /> Limpiar
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-slate-400 text-sm">
              Mostrando {filteredTasks.length} de {tasks.length} tareas
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown size={14} className="text-slate-500" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="createdAt">Fecha de creación</option>
                <option value="rating">Valoración</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportData}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 flex items-center gap-2 text-sm transition-colors"
            >
              <Download size={14} /> Exportar
            </button>
            <button
              onClick={importData}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 flex items-center gap-2 text-sm transition-colors"
            >
              <Upload size={14} /> Importar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            imageUrl={getUrl(task)}
            onClick={openDetail}
          />
        ))}
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={closeDetail}>
          <div
            className="bg-slate-800 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative"
            onClick={e => e.stopPropagation()}
          >
            {selectedIndex > 0 && (
              <button
                onClick={() => goToTask(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-slate-900/80 hover:bg-slate-700 rounded-full text-white transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {selectedIndex < filteredTasks.length - 1 && (
              <button
                onClick={() => goToTask(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-slate-900/80 hover:bg-slate-700 rounded-full text-white transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            )}

            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 pr-12">{selectedTask.title}</h2>
              <button onClick={closeDetail} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {detailImageUrl && (
                <img src={detailImageUrl} alt={selectedTask.title} className="w-full rounded-lg border border-slate-700" />
              )}
              {/* Video section — supports local blob and YouTube embed */}
              {selectedTask.videoType === 'youtube' && selectedTask.youtubeUrl && extractYouTubeId(selectedTask.youtubeUrl) ? (
                <div className="bg-slate-900 p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-2">Video (YouTube)</div>
                  <iframe
                    src={youtubeEmbedUrl(extractYouTubeId(selectedTask.youtubeUrl))}
                    className="w-full aspect-video rounded-lg border border-slate-700"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={selectedTask.title}
                  />
                </div>
              ) : detailVideoUrl ? (
                <div className="bg-slate-900 p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-2">Video (local)</div>
                  <video src={detailVideoUrl} controls className="w-full rounded-lg border border-slate-700" />
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-900 p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Fase</div>
                  <div className="text-sm font-medium text-teal-400">{selectedTask.phase}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Categoría</div>
                  <div className="text-sm font-medium text-teal-400">{selectedTask.category}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Situación</div>
                  <div className="text-sm font-medium text-teal-400">{selectedTask.situation || '-'}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Tiempo</div>
                  <div className="text-sm font-medium text-slate-200">{selectedTask.time || '-'}</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Repeticiones</div>
                  <div className="text-sm font-medium text-slate-200">{selectedTask.reps || '-'}</div>
                </div>
              </div>
              {selectedTask.subtitle && (
                <div className="bg-slate-900 p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Contenido</div>
                  <div className="text-sm font-medium text-slate-200">{selectedTask.subtitle}</div>
                </div>
              )}
              <div className="bg-slate-900 p-3 rounded-lg">
                <div className="text-xs text-slate-500 mb-1">Foco</div>
                <div className="text-sm font-medium text-slate-200">{selectedTask.focus || '-'}</div>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg">
                <div className="text-xs text-slate-500 mb-1">Descripción</div>
                <div className="text-sm text-slate-300 whitespace-pre-wrap">{safeDesc(selectedTask.description) || '-'}</div>
              </div>

              <div className="bg-slate-900 p-3 rounded-lg">
                <div className="text-xs text-slate-500 mb-2">Valoración</div>
                <StarRating
                  rating={selectedTask.rating || 0}
                  interactive
                  onChange={(r) => updateTaskRating(selectedTask.id, r)}
                />
              </div>

              <div className="bg-slate-900 p-3 rounded-lg">
                <div className="text-xs text-slate-500 mb-2">Feedback</div>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Notas sobre esta tarea..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                />
                <button
                  onClick={saveFeedback}
                  className="mt-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  Guardar feedback
                </button>
              </div>

              <div className="bg-slate-900 p-3 rounded-lg">
                <div className="text-xs text-slate-500 mb-2">Historial de sesiones</div>
                {taskHistory.length === 0 ? (
                  <div className="text-sm text-slate-500">Esta tarea no ha sido usada en ninguna sesión.</div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-2 bg-teal-600/20 border border-teal-500/30 rounded-lg px-4 py-2">
                        <span className="text-2xl font-bold text-teal-400">{selectedTask.usageCount || 0}</span>
                        <span className="text-xs text-teal-400/80">veces</span>
                      </div>
                    </div>
                    {selectedTask.lastUsedDate && (
                      <div className="text-sm text-slate-300 mb-3">
                        <span className="text-slate-500">Última vez:</span>{' '}
                        <span className="font-medium text-slate-200">{formatRelativeDate(selectedTask.lastUsedDate)}</span>
                        {taskHistory.length > 0 && (
                          <span className="text-slate-500">, {taskHistory[0].sessionName} ({formatDateDDMMYY(taskHistory[0].date)})</span>
                        )}
                      </div>
                    )}
                    <div className="space-y-1 max-h-32 overflow-y-auto border-t border-slate-700 pt-2">
                      {taskHistory.map((h, i) => (
                        <div key={i} className="text-sm text-slate-300 flex justify-between">
                          <span>{h.sessionName}</span>
                          <span className="text-slate-500 text-xs">{formatDateDDMMYY(h.date)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => navigate(`/editor/${selectedTask.id}`)}
                  className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Eye size={16} /> Editar
                </button>
                <button
                  onClick={() => downloadImage(selectedTask)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ImageIcon size={16} /> Descargar imagen
                </button>
                <button
                  onClick={() => openSessionPicker(selectedTask)}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ClipboardList size={16} /> Añadir a sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSessionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setShowSessionPicker(false)}>
          <div
            className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100">Añadir a sesión</h3>
              <button onClick={() => setShowSessionPicker(false)} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {sessions.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-4">No hay sesiones guardadas</div>
              )}
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => addToSession(s.id)}
                  className="w-full text-left p-3 bg-slate-900 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                >
                  <div className="text-sm font-medium text-slate-200">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.tasks?.length || 0} tareas {s.date ? `• ${formatDateDDMMYY(s.date)}` : ''}</div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-700">
              <button
                onClick={createSessionAndAdd}
                className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Crear nueva sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
