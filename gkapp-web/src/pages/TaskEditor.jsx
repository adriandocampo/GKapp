import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Trash2, ArrowLeft, Upload, X, Paintbrush, ClipboardList, Video, Link, CloudUpload, Loader2 } from 'lucide-react';
import { db } from '../db';
import ImageEditor from '../components/ImageEditor';
import { useTags } from '../hooks/useTags';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Modal';
import { useYouTubeUpload, extractYouTubeId, youtubeEmbedUrl } from '../hooks/useYouTubeUpload';
import { isFirebaseEnabled } from '../firebase';

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
    category: '',
    situation: '',
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
  const [previewUrl, setPreviewUrl]       = useState(null);
  const [videoUrl, setVideoUrl]           = useState(null);    // blob URL for local videos
  const [videoMode, setVideoMode]         = useState('local'); // active tab: 'local'|'youtube'|'upload'
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [saving, setSaving]               = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [hasChanges, setHasChanges]       = useState(false);

  const { upload: ytUpload, uploading: ytUploading, progress: ytProgress, error: ytError } = useYouTubeUpload();

  const { tags, addTag: addTagHook } = useTags();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const loadTask = async (taskId) => {
    const t = await db.tasks.get(taskId || id);
    if (t && !t.deletedAt) {
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
  }, [id]);

  function handleChange(e) {
    const { name, value } = e.target;
    setTask(prev => ({ ...prev, [name]: value }));
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
    const ok = await confirm('¿Eliminar esta tarea? Podrás deshacerlo desde el panel de administración durante 4 días.', { title: 'Eliminar tarea' });
    if (!ok) return;
    await db.tasks.update(id, { deletedAt: new Date() });
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
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={goBack} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-100">{isNew ? 'Nueva Tarea' : 'Editar Tarea'}</h1>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Título / Contenido</label>
          <input
            name="title"
            value={task.title}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
            placeholder="Nombre del ejercicio"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Contenido</label>
          <input
            name="subtitle"
            value={task.subtitle}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
            placeholder="Contenido o subtítulo del ejercicio"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Fase</label>
            <select
              name="phase"
              value={task.phase}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
            >
              <option value="">Seleccionar...</option>
              {tags.phase.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="flex gap-2 mt-2">
              <input
                value={newTags.phase}
                onChange={e => setNewTags(prev => ({ ...prev, phase: e.target.value }))}
                placeholder="Nueva fase"
                className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100"
              />
              <button onClick={() => addTag('phase')} className="px-2 py-1 bg-teal-600 rounded text-xs text-white">Añadir</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Categoría</label>
            <select
              name="category"
              value={task.category}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
            >
              <option value="">Seleccionar...</option>
              {tags.category.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-2 mt-2">
              <input
                value={newTags.category}
                onChange={e => setNewTags(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Nueva categoría"
                className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100"
              />
              <button onClick={() => addTag('category')} className="px-2 py-1 bg-teal-600 rounded text-xs text-white">Añadir</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Situación</label>
            <select
              name="situation"
              value={task.situation}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
            >
              <option value="">Seleccionar...</option>
              {tags.situation.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex gap-2 mt-2">
              <input
                value={newTags.situation}
                onChange={e => setNewTags(prev => ({ ...prev, situation: e.target.value }))}
                placeholder="Nueva situación"
                className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100"
              />
              <button onClick={() => addTag('situation')} className="px-2 py-1 bg-teal-600 rounded text-xs text-white">Añadir</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Tiempo</label>
            <input
              name="time"
              value={task.time}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
              placeholder="Ej: 20'"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Repeticiones</label>
            <input
              name="reps"
              value={task.reps}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
              placeholder="Ej: 4x2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Foco</label>
          <input
            name="focus"
            value={task.focus}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
            placeholder="Objetivo principal del ejercicio"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Descripción</label>
          <textarea
            name="description"
            value={task.description}
            onChange={handleChange}
            onDoubleClick={e => e.target.select()}
            rows={5}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
            placeholder="Detalles del ejercicio..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Imagen</label>
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 flex items-center gap-2 transition-colors"
            >
              <Upload size={16} /> Subir imagen
            </button>
            <button
              onClick={() => setShowImageEditor(true)}
              className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 rounded-lg text-slate-200 flex items-center gap-2 transition-colors"
            >
              <Paintbrush size={16} /> Crear / Editar imagen
            </button>
            {previewUrl && (
              <button onClick={removeImage} className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-red-300 flex items-center gap-2 transition-colors">
                <X size={16} /> Eliminar
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </div>
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="mt-4 max-h-64 rounded-lg border border-slate-700" />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Video</label>

          {/* Mode tabs */}
          <div className="flex gap-1 mb-3 bg-slate-900 p-1 rounded-lg w-fit">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  videoMode === key
                    ? 'bg-slate-700 text-teal-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={13} />{label}
              </button>
            ))}
          </div>

          {/* Local file mode */}
          {videoMode === 'local' && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => videoFileInputRef.current?.click()}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 flex items-center gap-2 transition-colors"
              >
                <Video size={16} /> Seleccionar video
              </button>
              {(videoUrl || task.videoType === 'local') && (
                <button onClick={removeVideo} className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-red-300 flex items-center gap-2 transition-colors">
                  <X size={16} /> Eliminar
                </button>
              )}
              <input ref={videoFileInputRef} type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
              <p className="w-full text-xs text-slate-500">El vídeo se guarda en este dispositivo. No se sincroniza entre dispositivos.</p>
            </div>
          )}
          {videoMode === 'local' && videoUrl && (
            <video src={videoUrl} controls className="mt-3 max-h-64 rounded-lg border border-slate-700 w-full" />
          )}

          {/* YouTube URL mode */}
          {videoMode === 'youtube' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={youtubeUrlInput}
                  onChange={e => handleYouTubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                {task.youtubeUrl && (
                  <button onClick={removeVideo} className="px-3 py-2 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-red-300 transition-colors">
                    <X size={16} />
                  </button>
                )}
              </div>
              {task.youtubeUrl && extractYouTubeId(task.youtubeUrl) && (
                <iframe
                  src={youtubeEmbedUrl(extractYouTubeId(task.youtubeUrl))}
                  className="mt-2 w-full aspect-video rounded-lg border border-slate-700"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="YouTube preview"
                />
              )}
              <p className="text-xs text-slate-500">Pega cualquier URL de YouTube. El vídeo puede ser público, no listado o privado.</p>
            </div>
          )}

          {/* Upload to YouTube mode */}
          {videoMode === 'upload' && (
            <div className="space-y-3">
              {ytUploading ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Loader2 size={16} className="animate-spin text-teal-400" />
                    Subiendo a YouTube… {ytProgress}%
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-teal-500 h-2 rounded-full transition-all duration-300" style={{ width: `${ytProgress}%` }} />
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-slate-700/50 rounded-xl text-slate-400 hover:border-teal-500/50 hover:text-teal-400 cursor-pointer transition-all bg-slate-900/30">
                  <CloudUpload size={18} />
                  <span className="text-sm font-medium">Seleccionar vídeo para subir a tu YouTube</span>
                  <input type="file" accept="video/*" onChange={handleYouTubeUpload} className="hidden" />
                </label>
              )}
              {task.youtubeUrl && !ytUploading && (
                <div className="flex items-center gap-2 text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2">
                  <Link size={12} />
                  <a href={task.youtubeUrl} target="_blank" rel="noreferrer" className="underline truncate">{task.youtubeUrl}</a>
                  <button onClick={removeVideo} className="ml-auto text-red-400 hover:text-red-300"><X size={12} /></button>
                </div>
              )}
              <p className="text-xs text-slate-500">Se subirá como "No listado" a tu canal de YouTube. Solo accesible mediante enlace directo.</p>
            </div>
          )}
        </div>

        {showImageEditor && (
          <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col p-4">
            <ImageEditor
              taskData={{ title: task.title, subtitle: task.subtitle, time: task.time, reps: task.reps, focus: task.focus, description: task.description }}
              initialElements={task.imageElements || null}
              onSave={(blob, elements) => {
                setTask(prev => ({ ...prev, imageBlob: blob, imageElements: elements }));
                if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(URL.createObjectURL(blob));
                setShowImageEditor(false);
                setHasChanges(true);
              }}
              onCancel={() => setShowImageEditor(false)}
            />
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-slate-700">
          <button
            onClick={() => saveTask(false)}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            onClick={() => saveTask(true)}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ClipboardList size={16} /> {saving ? 'Guardando...' : 'Guardar y añadir a sesión'}
          </button>
          {!isNew && (
            <button
              onClick={deleteTask}
              className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-red-300 font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} /> Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
