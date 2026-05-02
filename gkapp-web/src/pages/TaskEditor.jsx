import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Trash2, ArrowLeft, Upload, X, Paintbrush, ClipboardList, Video, Play } from 'lucide-react';
import { db } from '../db';
import ImageEditor from '../components/ImageEditor';
import { useTags } from '../hooks/useTags';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Modal';

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
  });
  const [newTags, setNewTags] = useState({ phase: '', category: '', situation: '' });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { tags, addTag: addTagHook } = useTags();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const loadTask = async (taskId) => {
    const t = await db.tasks.get(taskId || id);
    if (t) {
      setTask(t);
      if (t.imageBlob) setPreviewUrl(URL.createObjectURL(t.imageBlob));
      else if (t.imagePath) setPreviewUrl(t.imagePath);
      else setPreviewUrl(null);
      if (t.videoBlob) setVideoUrl(URL.createObjectURL(t.videoBlob));
      else if (t.videoPath) setVideoUrl(t.videoPath);
      else setVideoUrl(null);
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
    setTask(prev => ({ ...prev, videoBlob: file }));
    if (videoUrl && videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
    setHasChanges(true);
  }

  function removeVideo() {
    setTask(prev => ({ ...prev, videoBlob: null, videoPath: null }));
    if (videoUrl && videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
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
    const ok = await confirm('¿Eliminar esta tarea permanentemente?', { title: 'Eliminar tarea' });
    if (!ok) return;
    await db.tasks.delete(id);
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
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => videoFileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 flex items-center gap-2 transition-colors"
            >
              <Video size={16} /> Subir video
            </button>
            {videoUrl && (
              <button onClick={removeVideo} className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-red-300 flex items-center gap-2 transition-colors">
                <X size={16} /> Eliminar
              </button>
            )}
            <input ref={videoFileInputRef} type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
          </div>
          {videoUrl && (
            <video src={videoUrl} controls className="mt-4 max-h-64 rounded-lg border border-slate-700 w-full" />
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
