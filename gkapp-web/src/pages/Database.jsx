import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X, Eye, Plus, FileText, Clock, Repeat, ClipboardList, ChevronLeft, ChevronRight, ImageIcon, Download, Upload, ArrowUpDown, Video, Pencil, Trash2, Paintbrush } from 'lucide-react';
import { db } from '../db';
import { extractYouTubeId, youtubeEmbedUrl } from '../hooks/useYouTubeUpload';
import { useTags } from '../hooks/useTags';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { useToast } from '../components/Toast';
import { useConfirm, useModal, useAlert } from '../components/Modal';
import { formatDateDDMMYY, todayISO } from '../utils/date';
import { useSyncRefresh } from '../contexts/SyncContext';
import StarRating from '../components/StarRating';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(',');
  const mimeMatch = meta.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const byteChars = atob(base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  return new Blob([byteArr], { type: mime });
}

function deserializeBlobs(items, blobFields) {
  return items.map(item => {
    const clone = { ...item };
    for (const field of blobFields) {
      if (typeof clone[field] === 'string' && clone[field].startsWith('data:')) {
        try {
          clone[field] = dataUrlToBlob(clone[field]);
        } catch { /* leave as-is if conversion fails */ }
      }
    }
    return clone;
  });
}

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

const TaskCard = React.memo(function TaskCard({ task, imageUrl, onClick, onAddToSession }) {
  return (
    <div
      className="glass-card group relative cursor-pointer transition-all duration-300"
      style={{ borderRadius: 16, overflow: 'hidden' }}
      onClick={() => onClick(task)}
    >
      <div className="aspect-video relative overflow-hidden" style={{ background: 'rgba(22,20,16,0.6)' }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={task.title}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: '#997b66' }}>
            <FileText size={32} />
          </div>
        )}
        {task.youtubeUrl || task.videoBlob || task.videoPath ? (
          <div className="absolute bottom-2 right-2 rounded-full p-1.5" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <Video size={14} style={{ color: 'white' }} />
          </div>
        ) : null}
        {onAddToSession && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToSession(task); }}
            className="absolute top-2 right-2 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
            style={{ background: 'rgba(232,172,101,0.8)', color: 'white' }}
            title="Añadir a sesión"
          >
            <ClipboardList size={16} />
          </button>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-sm mb-1 line-clamp-2" style={{ color: '#f1ede7' }}>{task.title}</h3>
        {task.subtitle && (
          <p className="text-xs mb-2 line-clamp-1" style={{ color: '#997b66' }}>{task.subtitle}</p>
        )}
        <div className="flex items-center gap-2 mb-1">
          <StarRating value={task.rating || 0} size={14} />
          {task.usageCount > 0 && (
            <span className="text-xs" style={{ color: '#997b66' }}>({task.usageCount})</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: '#997b66' }}>
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
          <span className="px-2 py-0.5 rounded-lg text-xs" style={{ background: 'rgba(22,20,16,0.6)', color: '#baa587' }}>{task.phase}</span>
          {Array.isArray(task.category) && task.category.length > 0 && task.category.map(c => (
            <span key={c} className="px-2 py-0.5 rounded-lg text-xs" style={{ background: 'rgba(22,20,16,0.6)', color: '#baa587' }}>{c}</span>
          ))}
          {Array.isArray(task.dimension) && task.dimension.length > 0 && task.dimension.map(d => (
            <span key={d} className="px-2 py-0.5 rounded-lg text-xs" style={{ background: 'rgba(22,20,16,0.6)', color: '#baa587' }}>{d}</span>
          ))}
          {Array.isArray(task.situation) && task.situation.length > 0 && task.situation.map(s => (
            <span key={s} className="px-2 py-0.5 rounded-lg text-xs" style={{ background: 'rgba(232,172,101,0.08)', color: '#e8ac65' }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
});

export default function DatabasePage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ phase: '', category: '', dimension: '', situation: '', search: '' });
  const [sortBy, setSortBy] = useState('createdAt');
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [detailImageUrl, setDetailImageUrl] = useState(null);
  const [detailVideoUrl, setDetailVideoUrl] = useState(null);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [taskToAdd, setTaskToAdd] = useState(null);
  const [allSeasons, setAllSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [taskHistory, setTaskHistory] = useState([]);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { tags } = useTags();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const { showModal } = useModal();
  const alert = useAlert();
  const { refreshKey } = useSyncRefresh();

  const { getUrl, getVideoUrl } = useTaskImageUrls(tasks);

  useEffect(() => {
    loadTasks();
    loadSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get('task');
    const addToSession = params.get('addToSession');
    if (taskId) {
      db.tasks.get(taskId).then(t => {
        if (t && !t.deletedAt) {
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
    const active = all.filter(t => !t.deletedAt).map(t => {
      if (typeof t.situation === 'string') {
        t.situation = t.situation && t.situation !== 'Otro' ? [t.situation] : [];
      }
      if (!Array.isArray(t.situation)) t.situation = [];
      if (!Array.isArray(t.category)) {
        t.category = t.category ? [t.category] : [];
      }
      if (!Array.isArray(t.dimension)) {
        t.dimension = t.dimension ? [t.dimension] : [];
      }
      return t;
    });
    const sorted = active.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    setTasks(sorted);
    setLoading(false);
  }

  async function loadSessions() {
    const all = await db.sessions.toArray();
    setSessions(all.filter(s => !s.deletedAt));
  }

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => {
      if (filters.phase && t.phase !== filters.phase) return false;
      if (filters.category && (!Array.isArray(t.category) || !t.category.includes(filters.category))) return false;
      if (filters.dimension && (!Array.isArray(t.dimension) || !t.dimension.includes(filters.dimension))) return false;
      if (filters.situation && (!Array.isArray(t.situation) || !t.situation.includes(filters.situation))) return false;
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
    setFilters({ phase: '', category: '', dimension: '', situation: '', search: '' });
  }

  async function openDetail(task) {
    if (typeof task.situation === 'string') {
      task = { ...task, situation: task.situation && task.situation !== 'Otro' ? [task.situation] : [] };
    }
    if (!Array.isArray(task.situation)) task.situation = [];
    if (!Array.isArray(task.category)) {
      task = { ...task, category: task.category ? [task.category] : [] };
    }
    if (!Array.isArray(task.dimension)) {
      task = { ...task, dimension: task.dimension ? [task.dimension] : [] };
    }
    setSelectedTask(task);
    
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
      if (!s.deletedAt) sessionMap[s.id] = s.name;
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

  async function openSessionPicker(task) {
    setTaskToAdd(task);
    const seasons = await db.seasons.toArray();
    const activeSeasons = seasons.filter(s => !s.deletedAt).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    setAllSeasons(activeSeasons);
    setSelectedSeasonId(activeSeasons[0]?.id || null);
    setShowSessionPicker(true);
  }

  async function addToSession(sessionId) {
    if (!taskToAdd) return;
    const session = await db.sessions.get(sessionId);
    if (!session || session.deletedAt) return;
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
      updatedAt: new Date(),
    });
    setShowSessionPicker(false);
    setTaskToAdd(null);
    addToast('Tarea añadida a la sesión', 'success');
    loadTasks();
  }

  async function createSessionAndAdd() {
    if (!taskToAdd) return;
    const allSeasons = await db.seasons.toArray();
    const activeSeasons = allSeasons.filter(s => !s.deletedAt);
    if (activeSeasons.length === 0) {
      addToast('Crea una temporada primero en la sección de Sesiones', 'warning');
      return;
    }
    const result = await showModal({
      type: 'session-form',
      title: 'Nueva sesión',
      defaultName: '',
      defaultDate: todayISO(),
    });
    if (!result) return;
    const { name, date, microciclo, mdType } = result;
    const newId = await db.sessions.add({
      name,
      date,
      templateFields: {
        microciclo,
        tipoMD: mdType,
      },
      tasks: [taskToAdd.id],
      createdAt: new Date(),
      updatedAt: new Date(),
      seasonId: selectedSeasonId,
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
      updatedAt: new Date(),
    });
    setShowSessionPicker(false);
    setTaskToAdd(null);
    navigate(`/sessions/${newId}`);
    loadTasks();
  }

  async function updateTaskRating(taskId, rating) {
    await db.tasks.update(taskId, { rating, updatedAt: new Date() });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, rating } : t));
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => ({ ...prev, rating }));
    }
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
    const allSettings = await db.settings.toArray();

    const serializeBlobs = async (items, blobFields) => {
      const result = [];
      for (const item of items) {
        const clone = { ...item };
        for (const field of blobFields) {
          if (clone[field] instanceof Blob) {
            clone[field] = await blobToDataUrl(clone[field]);
          }
        }
        result.push(clone);
      }
      return result;
    };

    const data = {
      tasks: await serializeBlobs(allTasks.filter(t => !t.deletedAt), ['imageBlob', 'videoBlob']),
      sessions: await serializeBlobs(allSessions.filter(s => !s.deletedAt), ['videoBlob']),
      tags: allTags,
      taskHistory: allHistory,
      seasons: allSeasons.filter(s => !s.deletedAt),
      settings: allSettings,
      exportDate: new Date().toISOString()
    };
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
        await db.settings.clear();
        if (data.tasks?.length) await db.tasks.bulkAdd(deserializeBlobs(data.tasks, ['imageBlob', 'videoBlob']));
        if (data.sessions?.length) await db.sessions.bulkAdd(deserializeBlobs(data.sessions, ['videoBlob']));
        if (data.tags?.length) await db.tags.bulkAdd(data.tags);
        if (data.taskHistory?.length) await db.taskHistory.bulkAdd(data.taskHistory);
        if (data.seasons?.length) await db.seasons.bulkAdd(data.seasons);
        if (data.settings?.length) await db.settings.bulkAdd(data.settings);
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

  async function updateTaskField(taskId, field, value) {
    await db.tasks.update(taskId, { [field]: value, updatedAt: new Date() });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => ({ ...prev, [field]: value }));
    }
  }

  async function deleteTask(taskId) {
    const ok = await confirm('¿Eliminar esta tarea? Podrás deshacerlo desde el panel de administración durante 7 días.', { title: 'Eliminar tarea' });
    if (!ok) return;
    await db.tasks.update(taskId, { deletedAt: new Date(), updatedAt: new Date() });
    setTasks(prev => prev.filter(t => t.id !== taskId));
    closeDetail();
    addToast('Tarea eliminada', 'success');
  }

  function InlineTextField({ value, field, taskId, multiline = false, placeholder = '-' }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value || '');

    useEffect(() => {
      setDraft(value || '');
    }, [value]);

    async function save() {
      setEditing(false);
      if (draft !== (value || '')) {
        await updateTaskField(taskId, field, draft.trim() || null);
      }
    }

    if (editing) {
      if (multiline) {
        return (
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) save(); }}
            rows={4}
            className="w-full px-2 py-1 border border-gk-accent/50 rounded text-sm text-gk-text-primary focus:outline-none resize-none" style={{background: 'rgba(232,172,101,0.08)'}}
          />
        );
      }
      return (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setDraft(value || ''); } }}
          className="w-full px-2 py-1 border border-gk-accent/50 rounded text-sm text-gk-text-primary focus:outline-none" style={{background: 'rgba(232,172,101,0.08)'}}
        />
      );
    }

    return (
      <div
        className="group flex items-start gap-2 cursor-pointer px-2 py-1.5 rounded border border-transparent hover:border-gk-accent/30 transition-all"
        style={{background: 'rgba(232,172,101,0.08)'}}
        onClick={() => setEditing(true)}
      >
        <span className={`text-sm ${value ? 'font-medium' : 'text-gk-text-tertiary'} flex-1 ${multiline ? 'whitespace-pre-wrap' : ''}`} style={{color: value ? '#baa587' : undefined}}>
          {value || placeholder}
        </span>
        <button
          className="p-1 text-gk-text-tertiary hover:text-gk-accent transition-all shrink-0 mt-0.5 opacity-0 group-hover:opacity-100"
          title="Editar"
        >
          <Pencil size={12} />
        </button>
      </div>
    );
  }

  function InlineSelectField({ value, field, taskId, options, label }) {
    const [showAdd, setShowAdd] = useState(false);
    const [newTag, setNewTag] = useState('');
    const { addTag } = useTags();

    async function handleChange(e) {
      const val = e.target.value;
      if (val === '__add_new__') {
        setShowAdd(true);
        return;
      }
      await updateTaskField(taskId, field, val || null);
    }

    async function handleAddNew() {
      const trimmed = newTag.trim();
      if (!trimmed) return;
      const added = await addTag(field, trimmed);
      if (added) {
        await updateTaskField(taskId, field, added);
      }
      setNewTag('');
      setShowAdd(false);
    }

    if (showAdd) {
      return (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); if (e.key === 'Escape') setShowAdd(false); }}
            placeholder={`Nueva ${label}...`}
            className="flex-1 px-2 py-1 bg-gk-card border border-gk-accent/50 rounded text-sm text-gk-text-primary focus:outline-none"
          />
          <button onClick={handleAddNew} className="px-2 py-1 bg-gk-accent hover:bg-gk-accent rounded text-xs text-white">Añadir</button>
          <button onClick={() => { setShowAdd(false); setNewTag(''); }} className="px-2 py-1 bg-gk-elevated hover:bg-gk-elevated rounded text-xs text-gk-text-secondary">Cancelar</button>
        </div>
      );
    }

    return (
      <select
        value={value || ''}
        onChange={handleChange}
        className="v2-select w-full cursor-pointer"
        style={{ colorScheme: 'dark' }}
      >
        <option value="" style={{background: '#161410', color: '#f1ede7'}}>—</option>
        {options.map(o => <option key={o} value={o} style={{background: '#161410', color: '#f1ede7'}}>{o}</option>)}
        <option value="__add_new__" style={{background: '#161410', color: '#e8ac65'}}>+ Añadir nueva {label}</option>
      </select>
    );
  }

  return (
    <>
    <div className="animate-v2-fade-in-up -mx-4 -my-6 px-4 py-6 min-h-[calc(100vh-4rem)]" style={{ backgroundColor: '#0c0b09' }}>
    <div>
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: '#997b66' }} />
            <input
              type="text"
              placeholder="Buscar tarea..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="v2-input w-full"
              style={{ paddingLeft: 40 }}
            />
          </div>
          <select
            value={filters.phase}
            onChange={e => setFilters(f => ({ ...f, phase: e.target.value }))}
            className="v2-select"
          >
            <option value="">Todas las fases</option>
            {tags.phase.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filters.category}
            onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
            className="v2-select"
          >
            <option value="">Todas las categorías</option>
            {tags.category.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filters.dimension}
            onChange={e => setFilters(f => ({ ...f, dimension: e.target.value }))}
            className="v2-select"
          >
            <option value="">Todas las dimensiones</option>
            {tags.dimension.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={filters.situation}
            onChange={e => setFilters(f => ({ ...f, situation: e.target.value }))}
            className="v2-select"
          >
            <option value="">Todas las situaciones</option>
            {tags.situation.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(filters.phase || filters.category || filters.dimension || filters.situation || filters.search) && (
            <button
              onClick={clearFilters}
              className="v2-btn-ghost shrink-0"
            >
              <X size={16} /> Limpiar
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm" style={{ color: '#997b66' }}>
              Mostrando {filteredTasks.length} de {tasks.length} tareas
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown size={14} style={{ color: '#997b66' }} />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="v2-select text-sm py-1"
              >
                <option value="createdAt">Fecha de creación</option>
                <option value="rating">Valoración</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportData} className="v2-btn-ghost text-sm">
              <Download size={14} /> Exportar
            </button>
            <button onClick={importData} className="v2-btn-ghost text-sm">
              <Upload size={14} /> Importar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card-static overflow-hidden animate-pulse" style={{ borderRadius: 16 }}>
              <div className="aspect-video" style={{ background: 'rgba(185,165,135,0.04)' }} />
              <div className="p-4 space-y-3">
                <div className="h-4 rounded w-3/4" style={{ background: 'rgba(185,165,135,0.06)' }} />
                <div className="h-3 rounded w-1/2" style={{ background: 'rgba(185,165,135,0.06)' }} />
                <div className="flex gap-2">
                  <div className="h-3 rounded w-12" style={{ background: 'rgba(185,165,135,0.06)' }} />
                  <div className="h-3 rounded w-16" style={{ background: 'rgba(185,165,135,0.06)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              imageUrl={getUrl(task)}
              onClick={openDetail}
              onAddToSession={openSessionPicker}
            />
          ))}
        </div>
      )}
    </div>
    </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={closeDetail}>
          <div
            className="glass-card-static max-w-4xl w-full max-h-[90vh] overflow-y-auto v2-scrollbar relative"
            style={{ borderRadius: 24 }}
            onClick={e => e.stopPropagation()}
          >
            {selectedIndex > 0 && (
              <button
                onClick={() => goToTask(-1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 v2-btn-ghost rounded-full p-2"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {selectedIndex < filteredTasks.length - 1 && (
              <button
                onClick={() => goToTask(1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 v2-btn-ghost rounded-full p-2"
              >
                <ChevronRight size={24} />
              </button>
            )}

            <div className="sticky top-0 p-4 flex items-center justify-between z-10" style={{ background: 'rgba(22,20,16,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(185,165,135,0.08)', borderRadius: '24px 24px 0 0' }}>
              <div className="flex-1 pr-4">
                <InlineTextField value={selectedTask.title} field="title" taskId={selectedTask.id} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteTask(selectedTask.id)}
                  className="v2-btn-danger p-2"
                  title="Eliminar tarea"
                >
                  <Trash2 size={18} />
                </button>
                <button onClick={closeDetail} className="v2-btn-ghost p-1">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {detailImageUrl && (
                <div className="relative">
                  <img src={detailImageUrl} alt={selectedTask.title} className="w-full rounded-xl" style={{border: '1px solid rgba(185,165,135,0.08)'}} />
                  <button
                    onClick={() => navigate(`/editor/${selectedTask.id}`)}
                    className="v2-btn-ghost absolute top-3 right-3 backdrop-blur-sm"
                    title="Editar imagen"
                  >
                    <Paintbrush size={14} /> Editar imagen
                  </button>
                </div>
              )}
              {selectedTask.videoType === 'youtube' && selectedTask.youtubeUrl && extractYouTubeId(selectedTask.youtubeUrl) ? (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                  <div className="text-xs mb-2" style={{ color: '#997b66' }}>Video (YouTube)</div>
                  <iframe
                    src={youtubeEmbedUrl(extractYouTubeId(selectedTask.youtubeUrl))}
                    className="w-full aspect-video rounded-xl" style={{border: '1px solid rgba(185,165,135,0.08)'}}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={selectedTask.title}
                  />
                </div>
              ) : detailVideoUrl ? (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                  <div className="text-xs mb-2" style={{ color: '#997b66' }}>Video (local)</div>
                  <video src={detailVideoUrl} controls className="w-full rounded-xl" style={{border: '1px solid rgba(185,165,135,0.08)'}} />
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                  <div className="text-xs mb-1" style={{ color: '#997b66' }}>Fase</div>
                  <InlineSelectField value={selectedTask.phase} field="phase" taskId={selectedTask.id} options={tags.phase} label="fase" />
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                  <div className="text-xs mb-1" style={{ color: '#997b66' }}>Dimensión</div>
                  <MultiSelectDropdown
                    options={tags.dimension}
                    selected={Array.isArray(selectedTask.dimension) ? selectedTask.dimension : []}
                    onChange={async (updated) => {
                      setSelectedTask(prev => ({ ...prev, dimension: updated }));
                      await db.tasks.update(selectedTask.id, { dimension: updated, updatedAt: new Date() });
                    }}
                    placeholder="Seleccionar dimensiones"
                    onAddNew={async (name) => {
                      const trimmed = name.trim();
                      await db.tags.add({ type: 'dimension', name: trimmed });
                      const dim = Array.isArray(selectedTask.dimension) ? selectedTask.dimension : [];
                      if (!dim.includes(trimmed)) {
                        const updated = [...dim, trimmed];
                        setSelectedTask(prev => ({ ...prev, dimension: updated }));
                        await db.tasks.update(selectedTask.id, { dimension: updated, updatedAt: new Date() });
                      }
                      window.dispatchEvent(new CustomEvent('tags-changed'));
                    }}
                  />
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                  <div className="text-xs mb-1" style={{ color: '#997b66' }}>Categoría</div>
                  <MultiSelectDropdown
                    options={tags.category}
                    selected={Array.isArray(selectedTask.category) ? selectedTask.category : []}
                    onChange={async (updated) => {
                      setSelectedTask(prev => ({ ...prev, category: updated }));
                      await db.tasks.update(selectedTask.id, { category: updated, updatedAt: new Date() });
                    }}
                    placeholder="Seleccionar categorías"
                    onAddNew={async (name) => {
                      const trimmed = name.trim();
                      await db.tags.add({ type: 'category', name: trimmed });
                      const cat = Array.isArray(selectedTask.category) ? selectedTask.category : [];
                      if (!cat.includes(trimmed)) {
                        const updated = [...cat, trimmed];
                        setSelectedTask(prev => ({ ...prev, category: updated }));
                        await db.tasks.update(selectedTask.id, { category: updated, updatedAt: new Date() });
                      }
                      window.dispatchEvent(new CustomEvent('tags-changed'));
                    }}
                  />
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                  <div className="text-xs mb-1" style={{ color: '#997b66' }}>Situación</div>
                  <MultiSelectDropdown
                    options={tags.situation}
                    selected={Array.isArray(selectedTask.situation) ? selectedTask.situation : []}
                    onChange={async (updated) => {
                      setSelectedTask(prev => ({ ...prev, situation: updated }));
                      await db.tasks.update(selectedTask.id, { situation: updated, updatedAt: new Date() });
                    }}
                    placeholder="Seleccionar situaciones"
                    onAddNew={async (name) => {
                      const trimmed = name.trim();
                      await db.tags.add({ type: 'situation', name: trimmed });
                      const sit = Array.isArray(selectedTask.situation) ? selectedTask.situation : [];
                      if (!sit.includes(trimmed)) {
                        const updated = [...sit, trimmed];
                        setSelectedTask(prev => ({ ...prev, situation: updated }));
                        await db.tasks.update(selectedTask.id, { situation: updated, updatedAt: new Date() });
                      }
                      window.dispatchEvent(new CustomEvent('tags-changed'));
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                  <div className="text-xs mb-1" style={{ color: '#997b66' }}>Tiempo</div>
                  <InlineTextField value={selectedTask.time} field="time" taskId={selectedTask.id} />
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                  <div className="text-xs mb-1" style={{ color: '#997b66' }}>Repeticiones</div>
                  <InlineTextField value={selectedTask.reps} field="reps" taskId={selectedTask.id} />
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                <div className="text-xs mb-1" style={{ color: '#997b66' }}>Contenido</div>
                <InlineTextField value={selectedTask.subtitle} field="subtitle" taskId={selectedTask.id} />
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                <div className="text-xs mb-1" style={{ color: '#997b66' }}>Foco</div>
                <InlineTextField value={selectedTask.focus} field="focus" taskId={selectedTask.id} />
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                <div className="text-xs mb-1" style={{ color: '#997b66' }}>Descripción</div>
                <InlineTextField value={safeDesc(selectedTask.description)} field="description" taskId={selectedTask.id} multiline />
              </div>

              <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                <div className="text-xs mb-2" style={{ color: '#997b66' }}>Valoración</div>
                <StarRating
                  value={selectedTask.rating || 0}
                  onChange={(r) => updateTaskRating(selectedTask.id, r)}
                />
              </div>

              <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                <div className="text-xs mb-2" style={{ color: '#997b66' }}>Feedback</div>
                <InlineTextField value={selectedTask.feedback} field="feedback" taskId={selectedTask.id} multiline placeholder="Notas sobre esta tarea..." />
              </div>

              <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.6)' }}>
                <div className="text-xs mb-2" style={{ color: '#997b66' }}>Historial de sesiones</div>
                {taskHistory.length === 0 ? (
                  <div className="text-sm" style={{color: '#997b66'}}>Esta tarea no ha sido usada en ninguna sesión.</div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-2 rounded-lg px-4 py-2" style={{background: 'rgba(232,172,101,0.08)', border: '1px solid rgba(232,172,101,0.15)'}}>
                        <span className="text-2xl font-bold" style={{color: '#e8ac65'}}>{selectedTask.usageCount || 0}</span>
                        <span className="text-xs" style={{color: 'rgba(232,172,101,0.7)'}}>veces</span>
                      </div>
                    </div>
                    {selectedTask.lastUsedDate && (
                      <div className="text-sm mb-3" style={{color: '#baa587'}}>
                        <span style={{color: '#997b66'}}>Última vez:</span>{' '}
                        <span className="font-medium" style={{color: '#f1ede7'}}>{formatRelativeDate(selectedTask.lastUsedDate)}</span>
                        {taskHistory.length > 0 && (
                          <span style={{color: '#997b66'}}>, {taskHistory[0].sessionName} ({formatDateDDMMYY(taskHistory[0].date)})</span>
                        )}
                      </div>
                    )}
                    <div className="space-y-1 max-h-32 overflow-y-auto v2-scrollbar pt-2" style={{borderTop: '1px solid rgba(185,165,135,0.08)'}}>
                      {taskHistory.map((h, i) => (
                        <div key={i} className="text-sm flex justify-between" style={{color: '#baa587'}}>
                          <span>{h.sessionName}</span>
                          <span className="text-xs" style={{color: '#997b66'}}>{formatDateDDMMYY(h.date)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => downloadImage(selectedTask)}
                  className="v2-btn-ghost flex-1 justify-center py-2.5"
                >
                  <ImageIcon size={16} /> Descargar imagen
                </button>
                <button
                  onClick={() => openSessionPicker(selectedTask)}
                  className="v2-btn-ghost flex-1 justify-center py-2.5"
                  style={{
                    background: 'rgba(232,172,101,0.08)',
                    borderColor: 'rgba(232,172,101,0.15)',
                    color: '#e8ac65',
                  }}
                >
                  <ClipboardList size={16} /> Añadir a sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSessionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setShowSessionPicker(false)}>
          <div
            className="glass-card-static max-w-md w-full"
            style={{ borderRadius: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4" style={{borderBottom: '1px solid rgba(185,165,135,0.08)'}}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold" style={{color: '#f1ede7'}}>Añadir a sesión</h3>
                <button onClick={() => setShowSessionPicker(false)} className="v2-btn-ghost rounded-lg p-1">
                  <X size={20} />
                </button>
              </div>
              {allSeasons.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {allSeasons.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSeasonId(s.id)}
                      className="px-3 py-1.5 rounded-lg text-sm transition-all"
                      style={{
                        background: selectedSeasonId === s.id ? 'rgba(232,172,101,0.15)' : 'rgba(22,20,16,0.6)',
                        color: selectedSeasonId === s.id ? '#e8ac65' : '#baa587',
                        border: selectedSeasonId === s.id ? '1px solid rgba(232,172,101,0.2)' : '1px solid rgba(185,165,135,0.08)',
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto v2-scrollbar">
              {sessions.filter(s => !s.deletedAt && s.seasonId === selectedSeasonId).length === 0 && (
                <div className="text-sm text-center py-4" style={{color: '#997b66'}}>No hay sesiones en esta temporada</div>
              )}
              {sessions
                .filter(s => !s.deletedAt && s.seasonId === selectedSeasonId)
                .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))
                .map(s => (
                <button
                  key={s.id}
                  onClick={() => addToSession(s.id)}
                  className="w-full text-left p-3 rounded-xl transition-all"
                  style={{
                    background: 'rgba(22,20,16,0.6)',
                    border: '1px solid rgba(185,165,135,0.08)',
                  }}
                >
                  <div className="text-sm font-medium" style={{color: '#f1ede7'}}>{s.name}</div>
                  <div className="text-xs" style={{color: '#997b66'}}>{s.tasks?.length || 0} tareas {s.date ? `• ${formatDateDDMMYY(s.date)}` : ''}</div>
                </button>
              ))}
            </div>
            <div className="p-4" style={{borderTop: '1px solid rgba(185,165,135,0.08)'}}>
              <button
                onClick={createSessionAndAdd}
                className="v2-btn-ghost w-full justify-center py-2.5"
                style={{
                  background: 'rgba(232,172,101,0.08)',
                  borderColor: 'rgba(232,172,101,0.15)',
                  color: '#e8ac65',
                }}
              >
                <Plus size={16} /> Crear nueva sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
