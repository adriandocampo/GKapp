import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ArrowUp, ArrowDown, Trash2, X, Search, Calendar, Printer, LayoutTemplate, Eye, ArrowLeft, User, FolderOpen, ChevronLeft, ChevronRight, Star, Video, Play, BookOpen, Target, Eye as EyeIcon, Film, Link, CloudUpload, Loader2, BarChart3, PieChart, Pencil } from 'lucide-react';
import { db, getSetting } from '../db';
import { useToast } from '../components/Toast';
import { useConfirm, usePrompt } from '../components/Modal';
import SessionTemplateEditor from '../components/SessionTemplateEditor';
import RPEStatsModal from '../components/RPEStatsModal';
import ContentAnalysisModal from '../components/ContentAnalysisModal';
import { formatDateDDMMYY, todayISO, tomorrowISO } from '../utils/date';
import { extractYouTubeId, youtubeEmbedUrl, useYouTubeUpload } from '../hooks/useYouTubeUpload';
import { isFirebaseEnabled } from '../firebase';
import { useSyncRefresh } from '../contexts/SyncContext';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

const defaultPorteros = [
  { name: 'MARC', active: true },
  { name: 'IKER', active: true },
  { name: 'CANDAL', active: true },
];

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

function useTaskVideoUrls(tasks) {
  const [urls, setUrls] = useState({});

  useEffect(() => {
    const newUrls = {};
    for (const task of tasks) {
      if (task.videoBlob) {
        newUrls[task.id] = URL.createObjectURL(task.videoBlob);
      } else if (task.videoPath) {
        newUrls[task.id] = task.videoPath;
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

function useSessionVideoUrl(videoBlob) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (videoBlob) {
      const newUrl = URL.createObjectURL(videoBlob);
      setUrl(newUrl);
      return () => URL.revokeObjectURL(newUrl);
    }
    setUrl(null);
  }, [videoBlob]);

  return url;
}

function SectionHeader({ icon: Icon, title, badge }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="p-1.5 rounded-lg bg-gk-accent/10">
        <Icon size={14} className="text-gk-accent" />
      </div>
      <span className="text-sm font-semibold uppercase tracking-wider" style={{color: '#e8ac65'}}>{title}</span>
      {badge && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-gk-elevated text-gk-text-tertiary">{badge}</span>
      )}
    </div>
  );
}

function DynamicInputList({ items, onChange, placeholder }) {
  function updateItem(index, value) {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  }

  function addItem() {
    onChange([...items, '']);
  }

  function removeItem(index) {
    if (items.length <= 2) return;
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {items.map((line, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <input
            type="text"
            value={line}
            onChange={e => updateItem(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 rounded-lg text-gk-text-primary text-sm placeholder-gk-text-tertiary focus:outline-none focus:bg-gk-card/70 transition-all" style={{background: 'rgba(30, 28, 24, 0.55)', border: 'none'}}
          />
          {items.length > 2 && (
            <button
              onClick={() => removeItem(i)}
              className="opacity-0 group-hover:opacity-100 p-1 text-gk-text-tertiary hover:text-stat-rose transition-all"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex items-center gap-1.5 text-xs text-gk-accent/70 hover:text-gk-accent transition-colors mt-1"
      >
        <Plus size={12} /> Añadir línea
      </button>
    </div>
  );
}

function SessionDetailModal({ session, sessionTasks, allTasks, onSave, onClose, onDelete, seasons, confirm }) {
  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);
  const savedOnce = useRef(!!session?.id);
  const savePromiseRef = useRef(Promise.resolve());
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const [name, setName] = useState(session?.name || '');
  const [date, setDate] = useState(session?.date || todayISO());
  const [seasonId, setSeasonId] = useState(session?.seasonId || (seasons?.length > 0 ? seasons[seasons.length - 1].id : null));
  const [microciclo, setMicrociclo] = useState(session?.templateFields?.microciclo || '');
  const [tipoMD, setTipoMD] = useState(session?.templateFields?.tipoMD || '');
  const [tasks, setTasks] = useState(sessionTasks || []);
  const [porteros, setPorteros] = useState(() => {
    const saved = session?.templateFields?.porteros;
    return saved && saved.length > 0 ? saved : [];
  });
  const [valoracionGeneral, setValoracionGeneral] = useState(session?.valoracionGeneral || 0);
  const [feedbackGeneral, setFeedbackGeneral] = useState(session?.feedbackGeneral || '');
  const [rpePorteros, setRpePorteros] = useState(session?.rpePorteros || {});
  const [contenidos, setContenidos] = useState(() => {
    const saved = session?.templateFields?.contenidos;
    return saved && saved.length >= 2 ? saved : ['', ''];
  });
  const [objetivos, setObjetivos] = useState(() => {
    const saved = session?.templateFields?.objetivos;
    return saved && saved.length >= 2 ? saved : ['', ''];
  });
  const [focos, setFocos] = useState(() => {
    const saved = session?.templateFields?.focos;
    return saved && saved.length >= 2 ? saved : ['', ''];
  });
  const [videoBlob, setVideoBlob] = useState(session?.videoBlob || null);
  const [sessionVideoMode, setSessionVideoMode] = useState(
    session?.videoType === 'youtube' ? 'youtube' : 'local'
  );
  const [sessionYoutubeUrlInput, setSessionYoutubeUrlInput] = useState(session?.youtubeUrl || '');
  const [sessionYoutubeUrl, setSessionYoutubeUrl] = useState(session?.youtubeUrl || null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [sessionTeamName, setSessionTeamName] = useState(session?.templateFields?.teamName || 'Club Deportivo Lugo');
  const [sessionTeamCrest, setSessionTeamCrest] = useState(session?.templateFields?.teamCrest || null);
  const [sessionSecondaryImage, setSessionSecondaryImage] = useState(session?.templateFields?.secondaryImage || null);
  const [sessionCorporateColor, setSessionCorporateColor] = useState(session?.templateFields?.corporateColor || '#dc2626');
  const sessionVideoUrl = useSessionVideoUrl(videoBlob);
  const { upload: ytUpload, uploading: ytUploading, progress: ytProgress, error: ytError } = useYouTubeUpload();

  const autoSaveRef = useRef(async () => {});
  autoSaveRef.current = async function doSave(force = false) {
    if (!name.trim() || !seasonId || !microciclo.trim() || !tipoMD) return;
    if (savingRef.current) {
      if (!force) return;
      await savePromiseRef.current;
      if (!name.trim() || !seasonId || !microciclo.trim() || !tipoMD) return;
    }
    savingRef.current = true;
    savePromiseRef.current = (async () => {
      try {
      const sessionVideoType = sessionVideoMode === 'youtube' && sessionYoutubeUrl ? 'youtube'
        : videoBlob ? 'local' : 'none';
      const data = {
        name,
        date,
        tasks: tasks.map(t => t.id),
        updatedAt: new Date(),
        seasonId,
        valoracionGeneral,
        feedbackGeneral,
        rpePorteros,
        videoBlob: sessionVideoMode === 'local' ? videoBlob : null,
        videoType: sessionVideoType,
        youtubeUrl: sessionVideoMode === 'youtube' ? sessionYoutubeUrl : null,
      };
      const mergedTemplateFields = {
        ...(sessionRef.current?.templateFields || {}),
        porteros,
        contenidos,
        objetivos,
        focos,
        microciclo,
        tipoMD,
        teamName: sessionTeamName,
        teamCrest: sessionTeamCrest,
        secondaryImage: sessionSecondaryImage,
        corporateColor: sessionCorporateColor,
      };
      data.templateFields = mergedTemplateFields;

      let targetId = sessionRef.current?.id;
      if (!targetId) {
        targetId = crypto.randomUUID();
      }
      data.id = targetId;
      data.createdAt = data.createdAt || new Date();
      data.updatedAt = new Date();
      await db.sessions.put(data);

      const today = todayISO();
      for (const task of tasks) {
        const exists = await db.taskHistory.where({ taskId: task.id, sessionId: targetId }).first();
        if (!exists) {
          await db.taskHistory.add({
            taskId: task.id,
            sessionId: targetId,
            sessionName: name,
            date: date || today,
          });
        }
      }

      const taskIds = tasks.map(t => t.id);
      const existingHistory = await db.taskHistory.where('taskId').anyOf(taskIds).toArray();
      const counts = {};
      const lastDates = {};
      existingHistory.forEach(h => {
        counts[h.taskId] = (counts[h.taskId] || 0) + 1;
        if (!lastDates[h.taskId] || h.date > lastDates[h.taskId]) {
          lastDates[h.taskId] = h.date;
        }
      });

      for (const taskId of taskIds) {
        const task = await db.tasks.get(taskId);
        if (task) {
          await db.tasks.update(taskId, {
            usageCount: counts[taskId] || task.usageCount || 0,
            lastUsedDate: lastDates[taskId] || task.lastUsedDate,
            updatedAt: new Date(),
          });
        }
      }

      if (!savedOnce.current) {
        savedOnce.current = true;
        await onSaveRef.current({ ...sessionRef.current, id: targetId, ...data });
      }
    } finally {
      savingRef.current = false;
    }
  })();
    await savePromiseRef.current;
  };

  function scheduleAutoSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => autoSaveRef.current(), 800);
  }

  useEffect(() => {
    scheduleAutoSave();
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [name, date, seasonId, microciclo, tipoMD, tasks, porteros, valoracionGeneral, feedbackGeneral, rpePorteros, contenidos, objetivos, focos, sessionTeamName, sessionTeamCrest, sessionSecondaryImage, sessionCorporateColor, videoBlob, sessionYoutubeUrl]);

  async function handleClose() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const missing = [];
    if (!name.trim()) missing.push('Nombre');
    if (!seasonId) missing.push('Temporada');
    if (!microciclo.trim()) missing.push('Microciclo');
    if (!tipoMD) missing.push('Tipo MD');
    const requiredMissing = missing.length > 0;
    if (requiredMissing && confirm) {
      const html = `Hay campos obligatorios sin completar:<br/><br/>${missing.map(f => `<span style="color:#ef4444">- ${f}</span>`).join('<br/>')}<br/><br/>Si sales no se guardarán los cambios. ¿Salir?`;
      const ok = await confirm('', { title: 'Campos obligatorios', messageHtml: html });
      if (!ok) return;
    } else if (!requiredMissing) {
      await autoSaveRef.current(true);
    }
    onClose();
  }

  useEffect(() => {
    if (!session?.templateFields?.porteros || session.templateFields.porteros.length === 0) {
      getSetting('defaultPorteros').then(p => {
        if (p && p.length > 0) setPorteros(p);
      });
    }
    if (!session?.templateFields?.corporateColor) {
      getSetting('corporateColor').then(c => {
        if (c) setSessionCorporateColor(c);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved = session?.templateFields?.porteros;
    if (saved && saved.length > 0) {
      setPorteros(saved);
    }
    if (session?.valoracionGeneral !== undefined) setValoracionGeneral(session.valoracionGeneral);
    if (session?.feedbackGeneral !== undefined) setFeedbackGeneral(session.feedbackGeneral);
    if (session?.rpePorteros) setRpePorteros(session.rpePorteros);
    if (session?.templateFields?.contenidos) setContenidos(session.templateFields.contenidos);
    if (session?.templateFields?.objetivos) setObjetivos(session.templateFields.objetivos);
    if (session?.templateFields?.focos) setFocos(session.templateFields.focos);
    if (session?.templateFields?.teamName) setSessionTeamName(session.templateFields.teamName);
    if (session?.templateFields?.teamCrest !== undefined) setSessionTeamCrest(session.templateFields.teamCrest);
    if (session?.templateFields?.secondaryImage !== undefined) setSessionSecondaryImage(session.templateFields.secondaryImage);
    if (session?.templateFields?.corporateColor) setSessionCorporateColor(session.templateFields.corporateColor);
    if (session?.videoBlob) setVideoBlob(session.videoBlob);
    if (session?.youtubeUrl) {
      setSessionYoutubeUrl(session.youtubeUrl);
      setSessionYoutubeUrlInput(session.youtubeUrl);
      setSessionVideoMode('youtube');
    }
  }, [session?.templateFields?.porteros, session?.valoracionGeneral, session?.feedbackGeneral, session?.rpePorteros, session?.templateFields?.contenidos, session?.templateFields?.objetivos, session?.templateFields?.focos, session?.templateFields?.teamName, session?.templateFields?.teamCrest, session?.templateFields?.secondaryImage, session?.templateFields?.corporateColor, session?.videoBlob]);

  const [showPicker, setShowPicker] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [search, setSearch] = useState('');
  const [newPorteroName, setNewPorteroName] = useState('');
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(-1);
  const [taskFeedback, setTaskFeedback] = useState('');
  const { addToast } = useToast();

  const selectedTask = selectedTaskIndex >= 0 && selectedTaskIndex < tasks.length ? tasks[selectedTaskIndex] : null;
  const urls = useTaskImageUrls(tasks);
  const videoUrls = useTaskVideoUrls(tasks);

  useEffect(() => {
    setTasks(sessionTasks || []);
  }, [sessionTasks]);

  const filteredPicker = allTasks.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.title?.toLowerCase().includes(s) || t.focus?.toLowerCase().includes(s);
  }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  async function handleDelete() {
    if (!session?.id) return;
    const ok = await confirm('¿Eliminar esta sesión? Podrás deshacerlo desde el panel de administración durante 7 días.', { title: 'Eliminar sesión' });
    if (!ok) return;
    await db.sessions.update(session.id, { deletedAt: new Date(), updatedAt: new Date() });
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

  function addPortero() {
    if (!newPorteroName.trim()) return;
    setPorteros(prev => [...prev, { name: newPorteroName.trim().toUpperCase(), active: false }]);
    setNewPorteroName('');
  }

  function removePortero(index) {
    setPorteros(prev => prev.filter((_, i) => i !== index));
  }

  function handleVideoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoBlob(file);
    setSessionVideoMode('local');
    setSessionYoutubeUrl(null);
    setSessionYoutubeUrlInput('');
  }

  function handleSessionYouTubeUrl(url) {
    setSessionYoutubeUrlInput(url);
    const vid = extractYouTubeId(url);
    if (vid) {
      setSessionYoutubeUrl(`https://www.youtube.com/watch?v=${vid}`);
    }
  }

  async function handleSessionYouTubeUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await ytUpload(file, name || 'Sesión GKApp', '');
      setSessionYoutubeUrl(url);
      setSessionYoutubeUrlInput(url);
      setSessionVideoMode('youtube');
      setVideoBlob(null);
      addToast('Vídeo de sesión subido a YouTube', 'success');
    } catch {
      addToast('Error al subir: ' + (ytError || 'Error desconocido'), 'error');
    }
  }

  function removeVideo() {
    setVideoBlob(null);
    setSessionYoutubeUrl(null);
    setSessionYoutubeUrlInput('');
  }

  function togglePortero(index) {
    setPorteros(prev => prev.map((p, i) => i === index ? { ...p, active: !p.active } : p));
  }

  function openTaskDetail(index) {
    setSelectedTaskIndex(index);
    setTaskFeedback(tasks[index]?.feedback || '');
  }

  function closeTaskDetail() {
    setSelectedTaskIndex(-1);
    setTaskFeedback('');
  }

  function goToTask(offset) {
    const newIndex = selectedTaskIndex + offset;
    if (newIndex < 0 || newIndex >= tasks.length) return;
    openTaskDetail(newIndex);
  }

  async function saveTaskFeedback() {
    if (!selectedTask) return;
    await db.tasks.update(selectedTask.id, { feedback: taskFeedback, updatedAt: new Date() });
    setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, feedback: taskFeedback } : t));
    addToast('Feedback guardado', 'success');
  }

  async function updateTaskRating(rating) {
    if (!selectedTask) return;
    await db.tasks.update(selectedTask.id, { rating, updatedAt: new Date() });
    setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, rating } : t));
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.7)'}} onClick={handleClose}>
          <div
            className="glass-card-static max-w-5xl w-full max-h-[92vh] overflow-y-auto v2-scrollbar relative"
            style={{ borderRadius: 24 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 p-4 flex items-center justify-between z-10" style={{background: 'rgba(22,20,16,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(185,165,135,0.08)', borderRadius: '24px 24px 0 0'}}>
              <h2 className="text-xl font-bold" style={{color: '#f1ede7'}}>{session ? 'Editar sesión' : 'Nueva sesión'}</h2>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowTemplate(true)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl font-medium transition-all"
                  style={{
                    background: 'rgba(147, 112, 219, 0.12)',
                    border: '1px solid rgba(147, 112, 219, 0.25)',
                    color: '#c4a5ff',
                  }}
                >
                  <LayoutTemplate size={13} /> Plantilla
                </button>
                <button
                  onClick={() => { setShowTemplate(true); setTimeout(() => window.print(), 300); }}
                  className="v2-btn-ghost text-xs px-2.5 py-1.5"
                >
                  <Printer size={13} /> Imprimir
                </button>
                {session?.id && (
                  <button
                    onClick={handleDelete}
                    className="v2-btn-danger p-1.5"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button onClick={handleClose} className="v2-btn-ghost p-1.5">
                  <X size={20} />
                </button>
              </div>
            </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Session info */}
            <div className="p-4 rounded-xl" style={{background: 'rgba(22,20,16,0.4)'}}>
              <SectionHeader icon={Calendar} title="Información" />
              <div className="space-y-3 mt-3">
                <div className="flex flex-col md:flex-row items-center gap-3">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nombre de la sesión"
                    className="v2-input flex-1"
                    style={{background: 'rgba(30, 28, 24, 0.55)', border: 'none'}}
                  />
                  <select
                    value={seasonId || ''}
                    onChange={e => setSeasonId(e.target.value || null)}
                    className="v2-select"
                  >
                    <option value="">Temporada...</option>
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="v2-input"
                    style={{background: 'rgba(30, 28, 24, 0.55)', border: 'none'}}
                  />
                  <button
                    onClick={() => setDate(todayISO())}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: date === todayISO() ? 'rgba(232,172,101,0.15)' : 'rgba(22,20,16,0.6)',
                      color: date === todayISO() ? '#e8ac65' : '#997b66',
                      border: date === todayISO() ? '1px solid rgba(232,172,101,0.25)' : '1px solid rgba(185,165,135,0.08)',
                    }}
                  >
                    Hoy
                  </button>
                  <button
                    onClick={() => setDate(tomorrowISO())}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: date === tomorrowISO() ? 'rgba(232,172,101,0.15)' : 'rgba(22,20,16,0.6)',
                      color: date === tomorrowISO() ? '#e8ac65' : '#997b66',
                      border: date === tomorrowISO() ? '1px solid rgba(232,172,101,0.25)' : '1px solid rgba(185,165,135,0.08)',
                    }}
                  >
                    Mañana
                  </button>
                  <input
                    type="text"
                    value={microciclo}
                    onChange={e => setMicrociclo(e.target.value)}
                    placeholder="Microciclo *"
                  className={`v2-input w-24 text-center ${!microciclo.trim() ? '' : ''}`}
                  style={{background: 'rgba(30, 28, 24, 0.55)', border: 'none'}}
                  />
                  <select
                    value={tipoMD}
                    onChange={e => setTipoMD(e.target.value)}
                    className={`v2-select ${!tipoMD ? '' : ''}`}
                  >
                    <option value="">Tipo MD *</option>
                    <option value="Pretemporada">Pretemporada</option>
                    <option value="MD-5">MD-5</option>
                    <option value="MD-4">MD-4</option>
                    <option value="MD-3">MD-3</option>
                    <option value="MD-2">MD-2</option>
                    <option value="MD-1">MD-1</option>
                    <option value="MD+1">MD+1</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contenidos */}
            <div className="p-4 rounded-xl" style={{background: 'rgba(22,20,16,0.4)'}}>
              <SectionHeader icon={BookOpen} title="Contenidos" />
              <div className="mt-3">
                <DynamicInputList items={contenidos} onChange={setContenidos} placeholder="Contenido..." />
              </div>
            </div>

            {/* Objetivos */}
            <div className="p-4 rounded-xl" style={{background: 'rgba(22,20,16,0.4)'}}>
              <SectionHeader icon={Target} title="Objetivos" />
              <div className="mt-3">
                <DynamicInputList items={objetivos} onChange={setObjetivos} placeholder="Objetivo..." />
              </div>
            </div>

            {/* Focos */}
            <div className="p-4 rounded-xl" style={{background: 'rgba(22,20,16,0.4)'}}>
              <SectionHeader icon={EyeIcon} title="Focos" />
              <div className="mt-3">
                <DynamicInputList items={focos} onChange={setFocos} placeholder="Foco..." />
              </div>
            </div>

            {/* Task list */}
            <div className="p-4 rounded-xl" style={{background: 'rgba(22,20,16,0.4)'}}>
              <div className="flex items-center justify-between mb-3">
                <SectionHeader icon={BookOpen} title="Tareas" badge={tasks.length} />
                <button
                  onClick={() => setShowPicker(true)}
                  className="v2-btn-ghost text-xs"
                >
                  <Plus size={13} /> Añadir
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{color: '#997b66'}}>No hay tareas en esta sesión</div>
              ) : (
                <div className="space-y-1.5">
                  {tasks.map((task, idx) => (
                    <div key={task.id + idx} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors group" style={{background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.06)'}}>
                      <span className="text-xs w-5 text-center" style={{color: '#997b66', fontFamily: "'JetBrains Mono', monospace"}}>{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => openTaskDetail(idx)}
                          className="text-sm font-medium truncate text-left w-full transition-colors"
                          style={{color: '#f1ede7'}}
                        >
                          {task.title}
                        </button>
                        <div className="text-xs" style={{color: '#997b66'}}>{task.phase} • {Array.isArray(task.category) ? task.category.join(' · ') : task.category} • {Array.isArray(task.dimension) ? task.dimension.join(' · ') : task.dimension} • {Array.isArray(task.situation) ? task.situation.join(' · ') : task.situation} • {task.time || '-'}</div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        {videoUrls[task.id] && (
                          <button onClick={(e) => { e.stopPropagation(); openTaskDetail(idx); }} className="v2-btn-ghost p-1" title="Ver video">
                            <Play size={13} />
                          </button>
                        )}
                        <button onClick={() => moveTask(idx, -1)} disabled={idx === 0} className="v2-btn-ghost p-1" style={{opacity: idx === 0 ? 0.3 : 1}}>
                          <ArrowUp size={13} />
                        </button>
                        <button onClick={() => moveTask(idx, 1)} disabled={idx === tasks.length - 1} className="v2-btn-ghost p-1" style={{opacity: idx === tasks.length - 1 ? 0.3 : 1}}>
                          <ArrowDown size={13} />
                        </button>
                        <button onClick={() => removeTask(idx)} className="v2-btn-danger p-1" style={{background: 'none', border: 'none'}}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Porteros */}
            <div className="p-4 rounded-xl" style={{background: 'rgba(22,20,16,0.4)'}}>
              <SectionHeader icon={User} title="Porteros" badge={porteros.length} />
              <div className="flex flex-wrap gap-2 mt-3">
                {porteros.map((p, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition-colors`}
                    style={{
                      background: p.active ? 'rgba(34,197,94,0.12)' : 'rgba(22,20,16,0.6)',
                      borderColor: p.active ? 'rgba(34,197,94,0.30)' : 'rgba(185,165,135,0.08)',
                      color: p.active ? '#4ade80' : '#997b66',
                    }}
                  >
                    <span className="font-medium">{p.name}</span>
                    <button onClick={() => togglePortero(i)} className="ml-1 hover:opacity-70" title={p.active ? 'Desactivar' : 'Activar'}>
                      <div className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                        style={{
                          background: p.active ? '#22c55e' : 'transparent',
                          borderColor: p.active ? '#22c55e' : 'rgba(185,165,135,0.20)',
                        }}
                      >
                        {p.active && <span style={{color: 'white', fontSize: '10px'}}>✓</span>}
                      </div>
                    </button>
                    {porteros.length > 1 && (
                      <button onClick={() => removePortero(i)} style={{color: '#997b66', border: 'none', background: 'none', cursor: 'pointer'}}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newPorteroName}
                    onChange={e => setNewPorteroName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addPortero()}
                    placeholder="Nombre..."
                    className="px-2 py-1.5 rounded-lg text-gk-text-primary text-sm placeholder-gk-text-tertiary focus:outline-none focus:bg-gk-card/70 w-28 transition-colors" style={{background: 'rgba(30, 28, 24, 0.55)', border: 'none'}}
                  />
                  <button onClick={addPortero} className="p-1.5 bg-gk-accent hover:bg-gk-accent rounded-lg text-white transition-colors">
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Valoración General */}
            <div className="p-4 rounded-xl" style={{background: 'rgba(22,20,16,0.4)'}}>
              <SectionHeader icon={Star} title="Valoración General" />
              <div className="flex items-center gap-1 mt-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setValoracionGeneral(i === valoracionGeneral ? 0 : i)}
                    className="p-0.5 cursor-pointer hover:scale-110 transition-transform"
                  >
                    <Star
                      size={22}
                      className={i <= valoracionGeneral ? 'fill-yellow-400 text-stat-amber' : 'text-gk-text-tertiary'}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback General */}
            <div className="p-4 rounded-xl" style={{background: 'rgba(22,20,16,0.4)'}}>
              <SectionHeader icon={BookOpen} title="Feedback General" />
              <textarea
                value={feedbackGeneral}
                onChange={e => setFeedbackGeneral(e.target.value)}
                placeholder="Notas generales de la sesión..."
                rows={3}
                className="w-full mt-3 px-3 py-2 rounded-lg text-gk-text-primary text-sm placeholder-gk-text-tertiary focus:outline-none focus:bg-gk-card/70 resize-none transition-colors" style={{background: 'rgba(30, 28, 24, 0.55)', border: 'none'}}
              />
            </div>

            {/* Video de sesión */}
            <div className="p-4 rounded-xl" style={{background: 'rgba(22,20,16,0.4)'}}>
              <SectionHeader icon={Film} title="Video de Sesión" />

              {/* Mode tabs */}
              <div className="flex gap-1 mt-3 mb-3 bg-gk-page p-1 rounded-lg w-fit">
                {[
                  { key: 'local',   icon: Video,       label: 'Archivo local' },
                  { key: 'youtube', icon: Link,        label: 'URL YouTube' },
                  ...(isFirebaseEnabled && import.meta.env.VITE_YOUTUBE_CLIENT_ID
                    ? [{ key: 'upload', icon: CloudUpload, label: 'Subir a YouTube' }]
                    : []),
                ].map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setSessionVideoMode(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      sessionVideoMode === key ? 'bg-gk-elevated text-gk-accent' : 'text-gk-text-tertiary hover:text-gk-text-primary'
                    }`}
                  >
                    <Icon size={13} />{label}
                  </button>
                ))}
              </div>

              {/* Local */}
              {sessionVideoMode === 'local' && (
                videoBlob ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0 px-3 py-2.5 bg-gk-card/50 border border-gk-border/30 rounded-lg text-sm text-gk-text-secondary truncate">
                      {videoBlob.name}
                    </div>
                    <button
                      onClick={() => setShowVideoPlayer(true)}
                      className="p-2.5 bg-gk-accent hover:bg-gk-accent rounded-lg text-white transition-colors"
                    >
                      <Play size={16} />
                    </button>
                    <button onClick={removeVideo} className="p-2.5 bg-stat-rose/10 hover:bg-stat-rose/15 rounded-lg text-stat-rose border border-red-600/20">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gk-border/50 rounded-xl text-gk-text-tertiary hover:border-gk-accent/50 hover:text-gk-accent cursor-pointer transition-all bg-gk-card/20">
                    <Video size={16} />
                    <span className="text-sm font-medium">Seleccionar video</span>
                    <input type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
                  </label>
                )
              )}

              {/* YouTube URL */}
              {sessionVideoMode === 'youtube' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={sessionYoutubeUrlInput}
                      onChange={e => handleSessionYouTubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 px-3 py-2 bg-gk-card/50 border border-gk-border/50 rounded-lg text-gk-text-primary text-sm placeholder-gk-text-tertiary focus:outline-none focus:border-gk-accent/50"
                    />
                    {sessionYoutubeUrl && (
                      <button onClick={removeVideo} className="p-2 bg-red-900/30 hover:bg-red-900/50 rounded-lg text-stat-rose">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {sessionYoutubeUrl && extractYouTubeId(sessionYoutubeUrl) && (
                    <iframe
                      src={youtubeEmbedUrl(extractYouTubeId(sessionYoutubeUrl))}
                      className="w-full aspect-video rounded-lg border border-gk-border"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Vista previa sesión"
                    />
                  )}
                </div>
              )}

              {/* Upload to YouTube */}
              {sessionVideoMode === 'upload' && (
                <div className="space-y-3">
                  {ytUploading ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gk-text-secondary">
                        <Loader2 size={16} className="animate-spin text-gk-accent" />
                        Subiendo… {ytProgress}%
                      </div>
                      <div className="w-full bg-gk-elevated rounded-full h-2">
                        <div className="bg-gk-accent h-2 rounded-full transition-all" style={{ width: `${ytProgress}%` }} />
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gk-border/50 rounded-xl text-gk-text-tertiary hover:border-gk-accent/50 hover:text-gk-accent cursor-pointer transition-all bg-gk-card/20">
                      <CloudUpload size={16} />
                      <span className="text-sm font-medium">Subir vídeo a tu YouTube</span>
                      <input type="file" accept="video/*" onChange={handleSessionYouTubeUpload} className="hidden" />
                    </label>
                  )}
                  {sessionYoutubeUrl && !ytUploading && (
                    <div className="flex items-center gap-2 text-xs text-gk-accent bg-gk-accent/10 border border-gk-accent/20 rounded-lg px-3 py-2">
                      <Link size={12} />
                      <a href={sessionYoutubeUrl} target="_blank" rel="noreferrer" className="underline truncate">{sessionYoutubeUrl}</a>
                      <button onClick={removeVideo} className="ml-auto text-stat-rose"><X size={12} /></button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RPE Porteros */}
            <div className="p-4 rounded-xl" style={{background: 'rgba(22,20,16,0.4)'}}>
              <SectionHeader icon={User} title="RPE Porteros" />
              <div className="flex flex-wrap gap-3 mt-3">
                {porteros.map((p, i) => (
                  <div key={i} className="bg-gk-card/40 p-3 rounded-lg border border-gk-border/30 min-w-[120px]">
                    <div className="text-xs text-gk-text-tertiary mb-2 font-medium">{p.name}</div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setRpePorteros(prev => ({ ...prev, [p.name]: prev[p.name] === val ? 0 : val }))}
                          className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                            rpePorteros[p.name] === val
                              ? val <= 3 ? 'bg-green-600 text-white' : val <= 6 ? 'bg-yellow-600 text-white' : 'bg-red-600 text-white'
                              : 'bg-gk-card/50 text-gk-text-tertiary hover:bg-gk-elevated/50'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task picker */}
      {showPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.7)'}} onClick={() => setShowPicker(false)}>
          <div
            className="glass-card-static max-w-2xl w-full max-h-[80vh] flex flex-col"
            style={{borderRadius: 20}}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 flex items-center justify-between" style={{borderBottom: '1px solid rgba(185,165,135,0.08)'}}>
              <h3 className="text-lg font-bold" style={{color: '#f1ede7'}}>Añadir tareas</h3>
              <button onClick={() => setShowPicker(false)} className="v2-btn-ghost rounded-lg p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{color: '#997b66'}} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="v2-input w-full"
                  style={{paddingLeft: 40}}
                />
              </div>
              <div className="overflow-y-auto max-h-[50vh] space-y-2 v2-scrollbar">
                {filteredPicker.length === 0 && (
                  <div className="text-sm text-center py-4" style={{color: '#997b66'}}>No hay tareas disponibles</div>
                )}
                {filteredPicker.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
                    style={{background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)'}}
                    onClick={() => { addTask(task); setShowPicker(false); }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate" style={{color: '#f1ede7'}}>{task.title}</div>
                      <div className="text-xs mt-0.5" style={{color: '#997b66'}}>{task.phase}{task.phase && ' • '}{Array.isArray(task.category) && task.category.length > 0 ? task.category.join(' · ') : task.category || '—'}{' • '}{Array.isArray(task.dimension) && task.dimension.length > 0 ? task.dimension.join(' · ') : task.dimension || '—'}{' • '}{Array.isArray(task.situation) && task.situation.length > 0 ? task.situation.join(' · ') : task.situation || '—'}</div>
                    </div>
                    <Plus size={16} style={{color: '#e8ac65'}} className="shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task detail overlay */}
      {selectedTask && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80" onClick={closeTaskDetail}>
          <div
            className="bg-gk-card rounded-xl border border-gk-border max-w-4xl w-full max-h-[90vh] overflow-y-auto relative"
            onClick={e => e.stopPropagation()}
          >
            {selectedTaskIndex > 0 && (
              <button
                onClick={() => goToTask(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-gk-page/80 hover:bg-gk-elevated rounded-full text-white transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {selectedTaskIndex < tasks.length - 1 && (
              <button
                onClick={() => goToTask(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-gk-page/80 hover:bg-gk-elevated rounded-full text-white transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            )}

            <div className="sticky top-0 bg-gk-card border-b border-gk-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={closeTaskDetail} className="p-1 hover:bg-gk-elevated rounded text-gk-text-tertiary">
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-lg font-bold text-gk-text-primary pr-4">{selectedTask.title}</h2>
              </div>
              <span className="text-sm text-gk-text-tertiary">{selectedTaskIndex + 1} / {tasks.length}</span>
            </div>

            <div className="p-4 space-y-4">
              {urls[selectedTask.id] && (
                <img src={urls[selectedTask.id]} alt={selectedTask.title} className="w-full rounded-lg border border-gk-border" />
              )}
              {/* Task video: YouTube embed or local blob */}
              {selectedTask.videoType === 'youtube' && selectedTask.youtubeUrl && extractYouTubeId(selectedTask.youtubeUrl) ? (
                <div className="bg-gk-page p-3 rounded-lg">
                  <div className="text-xs text-gk-text-tertiary mb-2">Video (YouTube)</div>
                  <iframe
                    src={youtubeEmbedUrl(extractYouTubeId(selectedTask.youtubeUrl))}
                    className="w-full aspect-video rounded-lg border border-gk-border"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={selectedTask.title}
                  />
                </div>
              ) : videoUrls[selectedTask.id] ? (
                <div className="bg-gk-page p-3 rounded-lg">
                  <div className="text-xs text-gk-text-tertiary mb-2">Video (local)</div>
                  <video src={videoUrls[selectedTask.id]} controls className="w-full rounded-lg border border-gk-border" />
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                <div className="bg-gk-page p-3 rounded-lg">
                  <div className="text-xs text-gk-text-tertiary mb-1">Fase</div>
                  <div className="text-sm font-medium text-gk-accent">{selectedTask.phase}</div>
                </div>
                <div className="bg-gk-page p-3 rounded-lg">
                  <div className="text-xs text-gk-text-tertiary mb-1">Dimensión</div>
                  <div className="text-sm font-medium text-gk-accent">{Array.isArray(selectedTask.dimension) ? selectedTask.dimension.join(' · ') : selectedTask.dimension}</div>
                </div>
                <div className="bg-gk-page p-3 rounded-lg">
                  <div className="text-xs text-gk-text-tertiary mb-1">Categoría</div>
                  <div className="text-sm font-medium text-gk-accent">{Array.isArray(selectedTask.category) ? selectedTask.category.join(' · ') : selectedTask.category}</div>
                </div>
                <div className="bg-gk-page p-3 rounded-lg">
                  <div className="text-xs text-gk-text-tertiary mb-1">Situación</div>
                  <div className="text-sm font-medium text-gk-accent">{Array.isArray(selectedTask.situation) ? selectedTask.situation.join(' · ') : selectedTask.situation}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gk-page p-3 rounded-lg">
                  <div className="text-xs text-gk-text-tertiary mb-1">Tiempo</div>
                  <div className="text-sm font-medium text-gk-text-primary">{selectedTask.time || '-'}</div>
                </div>
                <div className="bg-gk-page p-3 rounded-lg">
                  <div className="text-xs text-gk-text-tertiary mb-1">Repeticiones</div>
                  <div className="text-sm font-medium text-gk-text-primary">{selectedTask.reps || '-'}</div>
                </div>
              </div>
              {selectedTask.subtitle && (
                <div className="bg-gk-page p-3 rounded-lg">
                  <div className="text-xs text-gk-text-tertiary mb-1">Contenido</div>
                  <div className="text-sm font-medium text-gk-text-primary">{selectedTask.subtitle}</div>
                </div>
              )}
              <div className="bg-gk-page p-3 rounded-lg">
                <div className="text-xs text-gk-text-tertiary mb-1">Foco</div>
                <div className="text-sm font-medium text-gk-text-primary">{selectedTask.focus || '-'}</div>
              </div>
              <div className="bg-gk-page p-3 rounded-lg">
                <div className="text-xs text-gk-text-tertiary mb-1">Descripción</div>
                <div className="text-sm text-gk-text-secondary whitespace-pre-wrap">{(selectedTask.description || '-').replace(/\\n/g, '\n')}</div>
              </div>

              <div className="bg-gk-page p-3 rounded-lg">
                <div className="text-xs text-gk-text-tertiary mb-2">Valoración</div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateTaskRating(i)}
                      className="cursor-pointer hover:scale-110 transition-transform"
                    >
                      <Star
                        size={14}
                        className={i <= (selectedTask.rating || 0) ? 'fill-yellow-400 text-stat-amber' : 'text-gk-text-tertiary'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gk-page p-3 rounded-lg">
                <div className="text-xs text-gk-text-tertiary mb-2">Feedback</div>
                <textarea
                  value={taskFeedback}
                  onChange={e => setTaskFeedback(e.target.value)}
                  placeholder="Notas sobre esta tarea..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gk-card border border-gk-border rounded-lg text-gk-text-primary text-sm placeholder-gk-text-tertiary focus:outline-none focus:border-gk-accent resize-none"
                />
                <button
                  onClick={saveTaskFeedback}
                  className="mt-2 px-3 py-1.5 bg-gk-accent hover:bg-gk-accent rounded-lg text-white text-sm font-medium transition-colors"
                >
                  Guardar feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template editor - rendered via portal for clean printing */}
      {showTemplate && createPortal(
        <SessionTemplateEditor
          session={{ ...session, name, date, templateFields: { ...(session?.templateFields || {}), microciclo, tipoMD } }}
          sessionTasks={tasks}
          taskImageUrls={urls}
          porteros={porteros}
          seasons={seasons}
          contenidos={contenidos}
          objetivos={objetivos}
          focos={focos}
          hasSavedTemplate={!!session?.templateFields}
          onSave={async (fields) => {
            if (fields.porteros) setPorteros(fields.porteros);
            if (fields.contenidos) setContenidos(fields.contenidos);
            if (fields.objetivos) setObjetivos(fields.objetivos);
            if (fields.focos) setFocos(fields.focos);
            if (fields.teamName) setSessionTeamName(fields.teamName);
            if (fields.teamCrest !== undefined) setSessionTeamCrest(fields.teamCrest);
            if (fields.secondaryImage !== undefined) setSessionSecondaryImage(fields.secondaryImage);
            if (fields.corporateColor) setSessionCorporateColor(fields.corporateColor);
            setShowTemplate(false);
          }}
          onClose={() => setShowTemplate(false)}
        />,
        document.body
      )}

      {/* Video player modal */}
      {showVideoPlayer && sessionVideoUrl && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90" onClick={() => setShowVideoPlayer(false)}>
          <div
            className="bg-gk-card rounded-xl border border-gk-border max-w-4xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gk-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-gk-text-primary truncate pr-4">{videoBlob?.name || 'Video'}</h3>
              <button onClick={() => setShowVideoPlayer(false)} className="p-1 hover:bg-gk-elevated rounded text-gk-text-tertiary">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <video src={sessionVideoUrl} controls className="w-full rounded-lg border border-gk-border" autoPlay />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function SkeletonSession() {
  return (
    <div className="bg-gk-card rounded-xl border border-gk-border p-4 animate-pulse space-y-3">
      <div className="h-5 bg-gk-elevated rounded w-3/4" />
      <div className="h-3 bg-gk-elevated rounded w-1/2" />
      <div className="flex gap-2">
        <div className="h-3 bg-gk-elevated rounded w-12" />
        <div className="h-3 bg-gk-elevated rounded w-8" />
      </div>
    </div>
  );
}

export default function SessionBuilder() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [seasonAnalyses, setSeasonAnalyses] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedSessionTasks, setSelectedSessionTasks] = useState([]);
  const [listVideoUrl, setListVideoUrl] = useState(null);
  const [showRPEStats, setShowRPEStats] = useState(false);
  const [showContentAnalysis, setShowContentAnalysis] = useState(false);
  const [refreshSessions, setRefreshSessions] = useState(0);
  const [selectedPorteros, setSelectedPorteros] = useState([]);
  const [editingSeasonId, setEditingSeasonId] = useState(null);
  const [editSeasonName, setEditSeasonName] = useState('');
  const listVideoBlobRef = useRef(null);
  const { addToast } = useToast();
  const prompt = usePrompt();
  const confirm = useConfirm();
  const { refreshKey } = useSyncRefresh();

  useEffect(() => {
    loadSeasons();
    loadAllTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    if (selectedSeason) {
      loadSessionsForSeason(selectedSeason.id);
      loadAnalysesForSeason(selectedSeason.id);
    }
  }, [selectedSeason]);

  useEffect(() => {
    if (selectedSeason) {
      loadSessionsForSeason(selectedSeason.id);
    }
  }, [refreshSessions]);

  async function loadAnalysesForSeason(seasonId) {
    const all = await db.analyses.toArray();
    const filtered = all.filter(a => a.seasonId === seasonId && !a.deletedAt);
    setSeasonAnalyses(filtered);
  }

  async function loadSeasons() {
    const all = await db.seasons.toArray();
    const active = all.filter(s => !s.deletedAt);
    setSeasons(active);
    if (active.length > 0 && !selectedSeason) {
      setSelectedSeason(active[active.length - 1]);
    }
  }

  async function loadSessionsForSeason(seasonId) {
    const all = await db.sessions.toArray();
    const filtered = all.filter(s => s.seasonId === seasonId && !s.deletedAt);
    setSessions(filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    setLoading(false);
  }

  async function loadAllTasks() {
    const all = await db.tasks.toArray();
    setAllTasks(all.filter(t => !t.deletedAt));
  }

  const allPorteros = [...new Set(sessions.flatMap(s =>
    (s.templateFields?.porteros || []).filter(p => p.active).map(p => p.name)
  ))].sort();
  const filteredSessions = selectedPorteros.length > 0
    ? sessions.filter(s => {
        const activePorteros = (s.templateFields?.porteros || []).filter(p => p.active).map(p => p.name);
        return selectedPorteros.some(p => activePorteros.includes(p));
      })
    : sessions;

  async function addSeason() {
    const nextYear = new Date().getFullYear() % 100;
    const nextYear2 = (nextYear + 1) % 100;
    const defaultName = `${nextYear}-${String(nextYear2).padStart(2, '0')}`;
    const name = await prompt('Nombre de la temporada:', { placeholder: defaultName, defaultValue: defaultName, required: true });
    if (!name) return;
    const newId = crypto.randomUUID();
    await db.seasons.add({ id: newId, name, createdAt: new Date(), updatedAt: new Date() });
    await loadSeasons();
    setSelectedSeason({ id: newId, name, createdAt: new Date() });
    addToast('Temporada creada', 'success');
  }

  async function deleteSeason(season) {
    const ok = await confirm(`¿Eliminar la temporada "${season.name}" y todas sus sesiones? Podrás deshacerlo desde el panel de administración durante 7 días.`, { title: 'Eliminar temporada' });
    if (!ok) return;
    const seasonSessions = await db.sessions.where('seasonId').equals(season.id).toArray();
    for (const s of seasonSessions) {
      await db.sessions.update(s.id, { deletedAt: new Date(), updatedAt: new Date() });
    }

    await db.seasons.update(season.id, { deletedAt: new Date(), updatedAt: new Date() });
    await loadSeasons();
    if (selectedSeason?.id === season.id) {
      setSelectedSeason(null);
      setSessions([]);
    }
    addToast('Temporada eliminada', 'success');
  }

  function startEditSeason(season) {
    setEditingSeasonId(season.id);
    setEditSeasonName(season.name);
  }

  async function saveSeasonName(seasonId) {
    const trimmed = editSeasonName.trim();
    if (!trimmed) return;
    await db.seasons.update(seasonId, { name: trimmed, updatedAt: new Date() });
    setEditingSeasonId(null);
    setEditSeasonName('');
    await loadSeasons();
    if (selectedSeason?.id === seasonId) {
      setSelectedSeason(prev => ({ ...prev, name: trimmed }));
    }
    addToast('Temporada actualizada', 'success');
  }

  async function openSession(session) {
    setSelectedSession(session);
    const tasks = await db.tasks.where('id').anyOf(session.tasks || []).toArray();
    const ordered = (session.tasks || []).map(tid => tasks.find(t => t.id === tid && !t.deletedAt)).filter(Boolean);
    setSelectedSessionTasks(ordered);
  }

  function openNewSession() {
    if (!selectedSeason) {
      addToast('Selecciona una temporada primero', 'warning');
      return;
    }
    const sessionCount = sessions.length;
    const nextNum = sessionCount + 1;
    const defaultName = `Sesión ${nextNum}`;
    setSelectedSession({ id: crypto.randomUUID(), name: defaultName, date: todayISO(), tasks: [], seasonId: selectedSeason.id });
    setSelectedSessionTasks([]);
  }

  async function handleSave(updatedSession) {
    const targetSeasonId = updatedSession.seasonId;
    if (targetSeasonId && targetSeasonId !== selectedSeason?.id) {
      const newSeason = seasons.find(s => s.id === targetSeasonId);
      if (newSeason) {
        setSelectedSeason(newSeason);
        await loadSessionsForSeason(newSeason.id);
      } else {
        await loadSessionsForSeason(selectedSeason.id);
      }
    } else {
      await loadSessionsForSeason(selectedSeason.id);
    }
    const freshSession = await db.sessions.get(updatedSession.id);
    if (freshSession && !freshSession.deletedAt) {
      setSelectedSession(freshSession);
      const tasks = await db.tasks.where('id').anyOf(freshSession.tasks || []).toArray();
      const ordered = (freshSession.tasks || []).map(tid => tasks.find(t => t.id === tid && !t.deletedAt)).filter(Boolean);
      setSelectedSessionTasks(ordered);
    }
  }

  async function handleDelete(deletedId) {
    await loadSessionsForSeason(selectedSeason.id);
    if (selectedSession?.id === deletedId) {
      setSelectedSession(null);
      setSelectedSessionTasks([]);
    }
  }

  async function playSessionVideo(session) {
    if (!session.videoBlob) return;
    listVideoBlobRef.current = session.videoBlob;
    const url = URL.createObjectURL(session.videoBlob);
    setListVideoUrl(url);
  }

  function closeListVideo() {
    if (listVideoUrl) {
      URL.revokeObjectURL(listVideoUrl);
    }
    setListVideoUrl(null);
    listVideoBlobRef.current = null;
  }

  return (
    <>
    <div className="animate-v2-fade-in-up -mx-4 -my-6 px-4 py-6 min-h-[calc(100vh-4rem)]" style={{ backgroundColor: '#0c0b09' }}>
      {/* Season selector */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold" style={{color: '#f1ede7'}}>Sesiones</h1>
          <button
            onClick={addSeason}
            className="v2-btn-ghost"
          >
            <Plus size={16} /> Nueva Temporada
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {seasons.map(s => (
            <div
              key={s.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all`}
              style={{
                background: selectedSeason?.id === s.id ? 'rgba(232,172,101,0.08)' : 'rgba(22,20,16,0.6)',
                borderColor: selectedSeason?.id === s.id ? 'rgba(232,172,101,0.20)' : 'rgba(185,165,135,0.08)',
                color: selectedSeason?.id === s.id ? '#e8ac65' : '#997b66',
              }}
              onClick={() => setSelectedSeason(s)}
            >
              <FolderOpen size={16} />
              {editingSeasonId === s.id ? (
                <input
                  value={editSeasonName}
                  onChange={e => setEditSeasonName(e.target.value)}
                  onBlur={() => saveSeasonName(s.id)}
                  onKeyDown={e => { if (e.key === 'Enter') saveSeasonName(s.id); if (e.key === 'Escape') setEditingSeasonId(null); }}
                  onClick={e => e.stopPropagation()}
                  className="v2-input px-2 py-0.5 text-sm"
                  style={{width: 96}}
                  autoFocus
                />
              ) : (
                <span className="font-medium">{s.name}</span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); startEditSeason(s); }}
                className="v2-btn-ghost p-0.5"
                title="Renombrar temporada"
              >
                <Pencil size={12} />
              </button>
              {seasons.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSeason(s); }}
                  className="v2-btn-danger p-0.5"
                  style={{background: 'none', border: 'none'}}
                  title="Eliminar temporada"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Session list */}
      {selectedSeason && (
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold" style={{color: '#f1ede7'}}>{selectedSeason.name}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRPEStats(true)}
                className="v2-btn-ghost"
              >
                <BarChart3 size={16} /> RPE
              </button>
              <button
                onClick={() => setShowContentAnalysis(true)}
                className="v2-btn-ghost"
              >
                <PieChart size={16} /> Análisis
              </button>
              <button
                onClick={openNewSession}
                className="v2-btn-ghost"
                style={{
                  background: 'rgba(232,172,101,0.08)',
                  borderColor: 'rgba(232,172,101,0.15)',
                  color: '#e8ac65',
                }}
              >
                <Plus size={16} /> Nueva Sesión
              </button>
            </div>
          </div>

          {allPorteros.length > 0 && (
            <div className="mb-4">
              <MultiSelectDropdown
                options={allPorteros}
                selected={selectedPorteros}
                onChange={setSelectedPorteros}
                placeholder="Filtrar por portero..."
              />
            </div>
          )}

          <div className="space-y-2">
            {loading && sessions.length === 0 && (
              Array.from({ length: 4 }).map((_, i) => <SkeletonSession key={i} />)
            )}
            {filteredSessions.map(s => {
              const rpeValues = Object.values(s.rpePorteros || {}).filter(v => v > 0);
              const rpeAvg = rpeValues.length > 0 ? (rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length).toFixed(1) : null;
              return (
                <div
                  key={s.id}
                  onClick={() => openSession(s)}
                  className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all group"
                  style={{background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)'}}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{color: '#f1ede7'}}>{s.name}</div>
                    <div className="text-xs mt-1" style={{color: '#997b66'}}>{s.tasks?.length || 0} tareas {s.date ? `• ${formatDateDDMMYY(s.date)}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.valoracionGeneral > 0 && (
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} size={14} style={{color: i <= s.valoracionGeneral ? '#e8ac65' : 'rgba(185,165,135,0.10)'}} />
                        ))}
                      </div>
                    )}
                    {rpeAvg && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)'}}>
                        <span className="text-xs font-medium" style={{color: '#baa587'}}>RPE</span>
                        <span className="text-xs font-bold" style={{color: rpeAvg <= 3 ? '#3dd68c' : rpeAvg <= 6 ? '#e8ac65' : '#e04a4a'}}>{rpeAvg}</span>
                      </div>
                    )}
                    {s.videoBlob && (
                      <button
                        onClick={(e) => { e.stopPropagation(); playSessionVideo(s); }}
                        className="v2-btn-ghost p-2"
                        title="Reproducir video"
                      >
                        <Play size={16} />
                      </button>
                    )}
                    <Eye size={16} style={{color: '#997b66'}} />
                  </div>
                </div>
              );
            })}
            {filteredSessions.length === 0 && (
              <div className="text-center py-12" style={{color: '#997b66'}}>
                <p className="text-lg mb-2">No hay sesiones en esta temporada</p>
                <p className="text-sm">Crea una nueva sesión para empezar</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>

      {/* RPE Stats modal */}
      {showRPEStats && (
        <RPEStatsModal
          sessions={sessions}
          analyses={seasonAnalyses}
          seasonName={selectedSeason?.name || ''}
          onClose={() => setShowRPEStats(false)}
        />
      )}

      {showContentAnalysis && (
        <ContentAnalysisModal
          sessions={sessions}
          seasonName={selectedSeason?.name || ''}
          onClose={() => setShowContentAnalysis(false)}
        />
      )}

      {/* Session detail modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          sessionTasks={selectedSessionTasks}
          allTasks={allTasks}
          onSave={handleSave}
          onClose={() => { setSelectedSession(null); setSelectedSessionTasks([]); setRefreshSessions(n => n + 1); }}
          onDelete={handleDelete}
          seasons={seasons}
          confirm={confirm}
        />
      )}

      {/* Video player from list */}
      {listVideoUrl && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.9)'}} onClick={closeListVideo}>
          <div
            className="glass-card-static max-w-4xl w-full"
            style={{ borderRadius: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 flex items-center justify-between" style={{borderBottom: '1px solid rgba(185,165,135,0.08)'}}>
              <h3 className="text-lg font-bold truncate pr-4" style={{color: '#f1ede7'}}>Video de Sesión</h3>
              <button onClick={closeListVideo} className="v2-btn-ghost p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <video src={listVideoUrl} controls className="w-full rounded-xl" style={{border: '1px solid rgba(185,165,135,0.08)'}} autoPlay />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
