import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Trash2, ArrowLeft, Upload, X, Paintbrush, ClipboardList, Video, Link, CloudUpload, Loader2 } from 'lucide-react';
import { db, getSetting } from '../db';
import ImageEditor from '../components/ImageEditor';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { useTags } from '../hooks/useTags';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Modal';
import { useYouTubeUpload, extractYouTubeId, youtubeEmbedUrl } from '../hooks/useYouTubeUpload';
import { isFirebaseEnabled } from '../firebase';
import { useSyncRefresh } from '../contexts/SyncContext';

export default function TaskEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const fileInputRef = useRef();
  const videoFileInputRef = useRef();

  const [task, setTask] = useState({
    title: '',
    subtitle: '',
    phase: '',
    category: [],
    dimension: [],
    situation: [],
    time: '',
    reps: '',
    focus: '',
    description: '',
    imageBlob: null,
    imageElements: null,
    videoBlob: null,
    videoPath: null,
    videoType: 'none',  // 'none' | 'local' | 'youtube'
    youtubeUrl: null,
  });
  const [newTags, setNewTags] = useState({ phase: '', category: '', situation: '' });
  const [showNewTag, setShowNewTag] = useState({ phase: false, category: false });
  const [previewUrl, setPreviewUrl]       = useState(null);
  const [videoUrl, setVideoUrl]           = useState(null);    // blob URL for local videos
  const [videoMode, setVideoMode]         = useState('local'); // active tab: 'local'|'youtube'|'upload'
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [saving, setSaving]               = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [hasChanges, setHasChanges]       = useState(false);
  const [corporateColor, setCorporateColor] = useState('#dc2626');
  const [autoRepair, setAutoRepair] = useState(false);

  const { upload: ytUpload, uploading: ytUploading, progress: ytProgress, error: ytError } = useYouTubeUpload();

  const { tags, addTag: addTagHook } = useTags();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const { refreshKey } = useSyncRefresh();

  const loadTask = async (taskId) => {
    const t = await db.tasks.get(taskId || id);
    if (t && !t.deletedAt) {
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
      setTask(t);
      if (t.imageBlob) setPreviewUrl(URL.createObjectURL(t.imageBlob));
      else if (t.imagePath) setPreviewUrl(t.imagePath);
      else setPreviewUrl(null);

      if (t.videoType === 'youtube' && t.youtubeUrl) {
        setYoutubeUrlInput(t.youtubeUrl);
        setVideoMode('youtube');
        setVideoUrl(null);
      } else if (t.videoBlob) {
        setVideoUrl(URL.createObjectURL(t.videoBlob));
        setVideoMode('local');
      } else if (t.videoPath) {
        setVideoUrl(t.videoPath);
        setVideoMode('local');
      } else {
        setVideoUrl(null);
      }
      if (t.imageElements && !t.imageBlob) {
        setAutoRepair(true);
        setShowImageEditor(true);
      }
    } else {
      addToast('Tarea no encontrada', 'error');
      navigate('/');
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  useEffect(() => {
    if (isNew) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadTask();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isNew && id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadTask(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, refreshKey]);

  useEffect(() => {
    getSetting('corporateColor').then(c => { if (c) setCorporateColor(c); });
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setTask(prev => ({ ...prev, [name]: value }));
    setHasChanges(true);
  }

  function toggleSituation(sit) {
    setTask(prev => {
      const current = Array.isArray(prev.situation) ? prev.situation : [];
      if (current.includes(sit)) {
        return { ...prev, situation: current.filter(s => s !== sit) };
      } else {
        return { ...prev, situation: [...current, sit] };
      }
    });
    setHasChanges(true);
  }

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setTask(prev => ({ ...prev, imageBlob: file }));
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setHasChanges(true);
  }

  function removeImage() {
    setTask(prev => ({ ...prev, imageBlob: null }));
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setHasChanges(true);
  }

  function handleVideoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setTask(prev => ({ ...prev, videoBlob: file, videoType: 'local', youtubeUrl: null }));
    if (videoUrl && videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
    setHasChanges(true);
  }

  function handleYouTubeUrl(url) {
    setYoutubeUrlInput(url);
    const vid = extractYouTubeId(url);
    if (vid) {
      const canonical = `https://www.youtube.com/watch?v=${vid}`;
      setTask(prev => ({ ...prev, youtubeUrl: canonical, videoType: 'youtube', videoBlob: null, videoPath: null }));
      setHasChanges(true);
    }
  }

  async function handleYouTubeUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await ytUpload(file, task.title || 'GKApp Video', task.description || '');
      setTask(prev => ({ ...prev, youtubeUrl: url, videoType: 'youtube', videoBlob: null, videoPath: null }));
      setYoutubeUrlInput(url);
      setHasChanges(true);
      addToast('Vídeo subido a YouTube correctamente', 'success');
    } catch {
      addToast('Error al subir a YouTube: ' + (ytError || 'Error desconocido'), 'error');
    }
  }

  function removeVideo() {
    setTask(prev => ({ ...prev, videoBlob: null, videoPath: null, videoType: 'none', youtubeUrl: null }));
    if (videoUrl && videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setYoutubeUrlInput('');
    setHasChanges(true);
  }

  async function saveTask(addToSession = false) {
    if (!task.title.trim()) {
      addToast('El título es obligatorio', 'warning');
      return;
    }
    setSaving(true);
    try {
      const data = { ...task, updatedAt: new Date() };
      if (isNew) {
        data.id = crypto.randomUUID();
        data.createdAt = new Date();
        data.pageNumber = 0;
        data.rating = 0;
        data.usageCount = 0;
        data.lastUsedDate = null;
        await db.tasks.add(data);
        setHasChanges(false);
        if (addToSession) {
          navigate(`/?task=${data.id}&addToSession=true`);
        } else {
          navigate('/');
        }
        addToast('Tarea creada correctamente', 'success');
      } else {
        await db.tasks.update(id, data);
        setHasChanges(false);
        if (addToSession) {
          navigate(`/?task=${id}&addToSession=true`);
        } else {
          navigate(`/?task=${id}`);
        }
        addToast('Tarea actualizada correctamente', 'success');
      }
    } catch (err) {
      console.error(err);
      addToast('Error al guardar: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask() {
    const ok = await confirm('¿Eliminar esta tarea? Podrás deshacerlo desde el panel de administración durante 7 días.', { title: 'Eliminar tarea' });
    if (!ok) return;
    await db.tasks.update(id, { deletedAt: new Date(), updatedAt: new Date() });
    setHasChanges(false);
    navigate('/');
    addToast('Tarea eliminada', 'success');
  }

  async function addTag(type) {
    const name = newTags[type].trim();
    if (!name) return;
    const result = await addTagHook(type, name);
    if (result) {
      setTask(prev => ({ ...prev, [type]: result }));
    }
    setNewTags(prev => ({ ...prev, [type]: '' }));
  }

  async function handleInlineAdd(type) {
    const name = newTags[type].trim();
    if (!name) return;
    const result = await addTagHook(type, name);
    if (result) {
      setTask(prev => ({ ...prev, [type]: result }));
      setHasChanges(true);
    }
    setNewTags(prev => ({ ...prev, [type]: '' }));
    setShowNewTag(prev => ({ ...prev, [type]: false }));
  }

  function goBack() {
    if (hasChanges) {
      const ok = window.confirm('Tienes cambios sin guardar. ¿Seguro que deseas salir?');
      if (!ok) return;
    }
    if (isNew) {
      navigate('/');
    } else {
      navigate(`/?task=${id}`);
    }
  }

  return (
    <>
    <div className="animate-v2-fade-in-up -mx-4 -my-6 px-4 py-6 min-h-[calc(100vh-4rem)]" style={{ backgroundColor: '#0c0b09' }}>
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={goBack} className="v2-btn-ghost rounded-xl p-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold" style={{ color: '#f1ede7' }}>{isNew ? 'Nueva Tarea' : 'Editar Tarea'}</h1>
      </div>

      <div className="glass-card-static p-6 space-y-6" style={{ borderRadius: 20 }}>
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Título / Contenido</label>
          <input
            name="title"
            value={task.title}
            onChange={handleChange}
            className="v2-input w-full"
            placeholder="Nombre del ejercicio"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Contenido</label>
          <input
            name="subtitle"
            value={task.subtitle}
            onChange={handleChange}
            className="v2-input w-full"
            placeholder="Contenido o subtítulo del ejercicio"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Fase</label>
            {showNewTag.phase ? (
              <div className="flex gap-2">
                <input autoFocus value={newTags.phase} onChange={e => setNewTags(prev => ({ ...prev, phase: e.target.value }))} placeholder="Nueva fase" className="v2-input flex-1 py-1.5 text-xs" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInlineAdd('phase'); } if (e.key === 'Escape') { setShowNewTag(prev => ({ ...prev, phase: false })); setNewTags(prev => ({ ...prev, phase: '' })); } }} />
                <button onClick={() => { setShowNewTag(prev => ({ ...prev, phase: false })); setNewTags(prev => ({ ...prev, phase: '' })); }} className="v2-btn-ghost py-1.5 text-xs">✕</button>
              </div>
            ) : (
              <select value={task.phase} onChange={e => { const val = e.target.value; if (val === '__add_new__') { setShowNewTag(prev => ({ ...prev, phase: true })); return; } setTask(prev => ({ ...prev, phase: val })); setHasChanges(true); }} className="v2-select w-full">
                <option value="">Seleccionar...</option>
                {tags.phase.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="__add_new__" style={{color: '#e8ac65'}}>+ Añadir</option>
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Dimensión</label>
            <MultiSelectDropdown
              options={tags.dimension}
              selected={Array.isArray(task.dimension) ? task.dimension : []}
              onChange={(val) => { setTask(prev => ({ ...prev, dimension: val })); setHasChanges(true); }}
              placeholder="Seleccionar dimensiones"
              onAddNew={(name) => {
                if (name && name.trim()) {
                  addTagHook('dimension', name.trim()).then(result => {
                    if (result) {
                      setTask(prev => ({
                        ...prev,
                        dimension: prev.dimension.includes(result) ? prev.dimension : [...prev.dimension, result]
                      }));
                      setHasChanges(true);
                    }
                  });
                }
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Categoría</label>
            <MultiSelectDropdown
              options={tags.category}
              selected={Array.isArray(task.category) ? task.category : []}
              onChange={(val) => { setTask(prev => ({ ...prev, category: val })); setHasChanges(true); }}
              placeholder="Seleccionar categorías"
              onAddNew={(name) => {
                if (name && name.trim()) {
                  addTagHook('category', name.trim()).then(result => {
                    if (result) {
                      setTask(prev => ({
                        ...prev,
                        category: prev.category.includes(result) ? prev.category : [...prev.category, result]
                      }));
                      setHasChanges(true);
                    }
                  });
                }
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Situación</label>
            <MultiSelectDropdown
              options={tags.situation}
              selected={Array.isArray(task.situation) ? task.situation : []}
              onChange={(val) => { setTask(prev => ({ ...prev, situation: val })); setHasChanges(true); }}
              placeholder="Seleccionar situaciones"
              onAddNew={(name) => {
                if (name && name.trim()) {
                  addTag('situation', name.trim());
                }
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Tiempo</label>
            <input
              name="time"
              value={task.time}
              onChange={handleChange}
              className="v2-input w-full"
              placeholder="Ej: 20'"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Repeticiones</label>
            <input
              name="reps"
              value={task.reps}
              onChange={handleChange}
              className="v2-input w-full"
              placeholder="Ej: 4x2"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Foco</label>
          <input
            name="focus"
            value={task.focus}
            onChange={handleChange}
            className="v2-input w-full"
            placeholder="Objetivo principal del ejercicio"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Descripción</label>
          <textarea
            name="description"
            value={task.description}
            onChange={handleChange}
            onDoubleClick={e => e.target.select()}
            rows={5}
            className="v2-input w-full resize-none"
            placeholder="Detalles del ejercicio..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Imagen</label>
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="v2-btn-ghost"
            >
              <Upload size={16} /> Subir imagen
            </button>
            <button
              onClick={() => setShowImageEditor(true)}
              className="v2-btn-ghost"
            >
              <Paintbrush size={16} /> Crear / Editar imagen
            </button>
            {previewUrl && (
              <button onClick={removeImage} className="v2-btn-danger">
                <X size={16} /> Eliminar
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </div>
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="mt-4 max-h-64 rounded-xl" style={{border: '1px solid rgba(185,165,135,0.08)'}} />
          )}
        </div>

        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: '#997b66' }}>Video</label>

          <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{background: 'rgba(22,20,16,0.6)', width: 'fit-content'}}>
            {[
              { key: 'local',  icon: Video,       label: 'Archivo local' },
              { key: 'youtube', icon: Link,        label: 'URL YouTube' },
              ...(isFirebaseEnabled && import.meta.env.VITE_YOUTUBE_CLIENT_ID
                ? [{ key: 'upload', icon: CloudUpload, label: 'Subir a YouTube' }]
                : []),
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setVideoMode(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: videoMode === key ? 'rgba(232,172,101,0.08)' : 'transparent',
                  color: videoMode === key ? '#e8ac65' : '#997b66',
                }}
              >
                <Icon size={13} />{label}
              </button>
            ))}
          </div>

          {videoMode === 'local' && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => videoFileInputRef.current?.click()}
                className="v2-btn-ghost"
              >
                <Video size={16} /> Seleccionar video
              </button>
              {(videoUrl || task.videoType === 'local') && (
                <button onClick={removeVideo} className="v2-btn-danger">
                  <X size={16} /> Eliminar
                </button>
              )}
              <input ref={videoFileInputRef} type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
              <p className="w-full text-xs" style={{ color: '#997b66' }}>El vídeo se guarda en este dispositivo. No se sincroniza entre dispositivos.</p>
            </div>
          )}
          {videoMode === 'local' && videoUrl && (
            <video src={videoUrl} controls className="mt-3 max-h-64 rounded-xl w-full" style={{border: '1px solid rgba(185,165,135,0.08)'}} />
          )}

          {videoMode === 'youtube' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={youtubeUrlInput}
                  onChange={e => handleYouTubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="v2-input flex-1"
                />
                {task.youtubeUrl && (
                  <button onClick={removeVideo} className="v2-btn-danger px-2.5">
                    <X size={16} />
                  </button>
                )}
              </div>
              {task.youtubeUrl && extractYouTubeId(task.youtubeUrl) && (
                <iframe
                  src={youtubeEmbedUrl(extractYouTubeId(task.youtubeUrl))}
                  className="mt-2 w-full aspect-video rounded-xl" style={{border: '1px solid rgba(185,165,135,0.08)'}}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="YouTube preview"
                />
              )}
              <p className="text-xs" style={{ color: '#997b66' }}>Pega cualquier URL de YouTube. El vídeo puede ser público, no listado o privado.</p>
            </div>
          )}

          {videoMode === 'upload' && (
            <div className="space-y-3">
              {ytUploading ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm" style={{color: '#baa587'}}>
                    <Loader2 size={16} className="animate-spin" style={{color: '#e8ac65'}} />
                    Subiendo a YouTube… {ytProgress}%
                  </div>
                  <div className="w-full rounded-full h-2" style={{background: 'rgba(185,165,135,0.08)'}}>
                    <div className="h-2 rounded-full transition-all duration-300" style={{width: `${ytProgress}%`, background: '#e8ac65'}} />
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed rounded-xl cursor-pointer transition-all" style={{borderColor: 'rgba(185,165,135,0.12)', color: '#997b66', background: 'rgba(22,20,16,0.4)'}}>
                  <CloudUpload size={18} />
                  <span className="text-sm font-medium">Seleccionar vídeo para subir a tu YouTube</span>
                  <input type="file" accept="video/*" onChange={handleYouTubeUpload} className="hidden" />
                </label>
              )}
              {task.youtubeUrl && !ytUploading && (
                <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{color: '#e8ac65', background: 'rgba(232,172,101,0.08)', border: '1px solid rgba(232,172,101,0.15)'}}>
                  <Link size={12} />
                  <a href={task.youtubeUrl} target="_blank" rel="noreferrer" className="underline truncate" style={{color: '#e8ac65'}}>{task.youtubeUrl}</a>
                  <button onClick={removeVideo} className="ml-auto" style={{color: '#d08c60'}}><X size={12} /></button>
                </div>
              )}
              <p className="text-xs" style={{color: '#997b66'}}>Se subirá como "No listado" a tu canal de YouTube. Solo accesible mediante enlace directo.</p>
            </div>
          )}
        </div>

        {showImageEditor && (
          <div className="fixed inset-0 z-50 flex flex-col" style={{background: '#0c0b09'}}>
            <ImageEditor
              taskData={{ title: task.title, subtitle: task.subtitle, time: task.time, reps: task.reps, focus: task.focus, description: task.description }}
              initialElements={task.imageElements || null}
              corporateColor={corporateColor}
              autoRepair={autoRepair}
              onSave={async (blob, elements) => {
                if (autoRepair) {
                  setAutoRepair(false);
                  await db.tasks.update(id, { imageBlob: blob, imageElements: elements, updatedAt: new Date() });
                  if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(URL.createObjectURL(blob));
                  setShowImageEditor(false);
                  addToast('Imagen reparada automáticamente', 'success');
                } else {
                  setTask(prev => ({ ...prev, imageBlob: blob, imageElements: elements }));
                  if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(URL.createObjectURL(blob));
                  setShowImageEditor(false);
                  setHasChanges(true);
                }
              }}
              onCancel={() => { setAutoRepair(false); setShowImageEditor(false); }}
            />
        </div>
      )}

        <div className="flex gap-3 pt-4" style={{borderTop: '1px solid rgba(185,165,135,0.08)'}}>
          <button
            onClick={() => saveTask(false)}
            disabled={saving}
            style={{
              flex: 1,
              background: 'rgba(232,172,101,0.12)',
              border: '1px solid rgba(232,172,101,0.15)',
              borderRadius: 14,
              padding: '12px 16px',
              color: '#e8ac65',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: saving ? 0.5 : 1,
            }}
          >
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            onClick={() => saveTask(true)}
            disabled={saving}
            style={{
              flex: 1,
              background: 'rgba(155,155,122,0.12)',
              border: '1px solid rgba(155,155,122,0.20)',
              borderRadius: 14,
              padding: '12px 16px',
              color: '#9b9b7a',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: saving ? 0.5 : 1,
            }}
          >
            <ClipboardList size={16} /> {saving ? 'Guardando...' : 'Guardar y añadir a sesión'}
          </button>
          {!isNew && (
            <button
              onClick={deleteTask}
              className="v2-btn-danger py-2.5 rounded-xl"
            >
              <Trash2 size={16} /> Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
    </div>

      {showImageEditor && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{background: '#0c0b09'}}>
          <ImageEditor
            taskData={{ title: task.title, subtitle: task.subtitle, time: task.time, reps: task.reps, focus: task.focus, description: task.description }}
            initialElements={task.imageElements || null}
            corporateColor={corporateColor}
            autoRepair={autoRepair}
            onSave={async (blob, elements) => {
              if (autoRepair) {
                setAutoRepair(false);
                await db.tasks.update(id, { imageBlob: blob, imageElements: elements, updatedAt: new Date() });
                if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(URL.createObjectURL(blob));
                setShowImageEditor(false);
                addToast('Imagen reparada automáticamente', 'success');
              } else {
                setTask(prev => ({ ...prev, imageBlob: blob, imageElements: elements }));
                if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(URL.createObjectURL(blob));
                setShowImageEditor(false);
                setHasChanges(true);
              }
            }}
            onCancel={() => { setAutoRepair(false); setShowImageEditor(false); }}
          />
        </div>
      )}
    </>
  );
}

