import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Upload, X, Trash2, ArrowLeft, Plus, GripVertical } from 'lucide-react';
import { db, getSetting, setSetting, cleanupOrphanTags } from '../db';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Modal';

export default function Settings() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const crestInputRef = useRef();
  const secondaryInputRef = useRef();

  const [teamName, setTeamName] = useState('Club Deportivo Lugo');
  const [teamCrest, setTeamCrest] = useState(null);
  const [secondaryImage, setSecondaryImage] = useState(null);
  const [porteros, setPorteros] = useState([]);
  const [newPorteroName, setNewPorteroName] = useState('');
  const [tags, setTags] = useState({ phase: [], category: [], situation: [] });
  const [newTagInputs, setNewTagInputs] = useState({ phase: '', category: '', situation: '' });
  const [saving, setSaving] = useState(false);
  const [draggedTag, setDraggedTag] = useState(null);
  const [draggedPorteroIdx, setDraggedPorteroIdx] = useState(null);

  useEffect(() => {
    loadSettings();
    loadTags();
  }, []);

  async function loadSettings() {
    const name = await getSetting('teamName');
    const crest = await getSetting('teamCrest');
    const secondary = await getSetting('secondaryImage');
    const porterosData = await getSetting('defaultPorteros');
    if (name !== null) setTeamName(name);
    if (crest) setTeamCrest(crest);
    if (secondary) setSecondaryImage(secondary);
    if (porterosData) setPorteros(porterosData);
  }

  async function loadTags() {
    const all = await db.tags.toArray();
    const grouped = { phase: [], category: [], situation: [] };
    all.forEach(t => {
      if (grouped[t.type]) grouped[t.type].push(t.name);
    });
    setTags(grouped);
  }

  function handleImageUpload(field, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (field === 'teamCrest') setTeamCrest(e.target.result);
      else setSecondaryImage(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  function removeImage(field) {
    if (field === 'teamCrest') setTeamCrest(null);
    else setSecondaryImage(null);
  }

  function addPortero() {
    if (!newPorteroName.trim()) return;
    setPorteros(prev => [...prev, { name: newPorteroName.trim().toUpperCase(), active: false }]);
    setNewPorteroName('');
  }

  function removePortero(index) {
    setPorteros(prev => prev.filter((_, i) => i !== index));
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await setSetting('teamName', teamName);
      await setSetting('teamCrest', teamCrest);
      await setSetting('secondaryImage', secondaryImage);
      await setSetting('defaultPorteros', porteros);
      addToast('Ajustes guardados', 'success');
    } catch (err) {
      addToast('Error al guardar: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function addTag(type) {
    const name = newTagInputs[type].trim();
    if (!name) return;
    const exists = await db.tags.where({ type, name }).first();
    if (!exists) {
      await db.tags.add({ type, name });
      setTags(prev => ({ ...prev, [type]: [...prev[type], name] }));
    }
    setNewTagInputs(prev => ({ ...prev, [type]: '' }));
  }

  async function deleteTag(type, name) {
    const ok = await confirm(`¿Eliminar la etiqueta "${name}"?`, { title: 'Eliminar etiqueta' });
    if (!ok) return;
    const tag = await db.tags.where({ type, name }).first();
    if (tag) {
      await db.tags.delete(tag.id);
      setTags(prev => ({ ...prev, [type]: prev[type].filter(t => t !== name) }));
      addToast(`Etiqueta "${name}" eliminada`, 'success');
    }
  }

  async function moveTag(tagName, fromType, toType) {
    if (fromType === toType) return;
    const tag = await db.tags.where({ type: fromType, name: tagName }).first();
    if (!tag) return;
    
    const exists = await db.tags.where({ type: toType, name: tagName }).first();
    if (exists) {
      await db.tags.delete(tag.id);
      setTags(prev => ({
        ...prev,
        [fromType]: prev[fromType].filter(t => t !== tagName),
      }));
    } else {
      await db.tags.update(tag.id, { type: toType });
      setTags(prev => ({
        ...prev,
        [fromType]: prev[fromType].filter(t => t !== tagName),
        [toType]: [...prev[toType], tagName],
      }));
    }
    addToast(`Etiqueta "${tagName}" movida`, 'success');
  }

  function handleDragStart(e, tagName, type) {
    setDraggedTag({ name: tagName, type });
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e, toType) {
    e.preventDefault();
    if (draggedTag) {
      moveTag(draggedTag.name, draggedTag.type, toType);
      setDraggedTag(null);
    }
  }

  function handlePorteroDragStart(e, idx) {
    setDraggedPorteroIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handlePorteroDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handlePorteroDrop(e, targetIdx) {
    e.preventDefault();
    if (draggedPorteroIdx === null || draggedPorteroIdx === targetIdx) return;
    setPorteros(prev => {
      const updated = [...prev];
      const [removed] = updated.splice(draggedPorteroIdx, 1);
      updated.splice(targetIdx, 0, removed);
      return updated;
    });
    setDraggedPorteroIdx(null);
  }

  function handlePorteroDragEnd() {
    setDraggedPorteroIdx(null);
  }

  function renderTagSection(type, label) {
    return (
      <div
        className="bg-slate-900 rounded-lg p-4"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, type)}
      >
        <h4 className="text-sm font-medium text-slate-300 mb-3">{label}</h4>
        <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
          {tags[type].length === 0 && (
            <span className="text-xs text-slate-500">No hay etiquetas</span>
          )}
          {tags[type].map(name => (
            <span
              key={name}
              draggable
              onDragStart={(e) => handleDragStart(e, name, type)}
              className={`inline-flex items-center gap-1 px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 cursor-grab active:cursor-grabbing ${draggedTag?.name === name && draggedTag?.type === type ? 'opacity-50' : ''}`}
            >
              {name}
              <button onClick={() => deleteTag(type, name)} className="text-red-400 hover:text-red-300 ml-1">
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newTagInputs[type]}
            onChange={e => setNewTagInputs(prev => ({ ...prev, [type]: e.target.value }))}
            placeholder={`Nueva ${label.toLowerCase()}`}
            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
          <button onClick={() => addTag(type)} className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm text-white flex items-center gap-1 transition-colors">
            <Plus size={14} /> Añadir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-100">Ajustes</h1>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-8">
        {/* Team info */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Equipo</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Nombre del equipo</label>
              <input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="Mi equipo"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Escudo</label>
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  onClick={() => crestInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 flex items-center gap-2 transition-colors"
                >
                  <Upload size={16} /> {teamCrest ? 'Cambiar escudo' : 'Subir escudo'}
                </button>
                {teamCrest && (
                  <button onClick={() => removeImage('teamCrest')} className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-red-300 flex items-center gap-2 transition-colors">
                    <X size={16} /> Eliminar
                  </button>
                )}
                <input ref={crestInputRef} type="file" accept="image/*" onChange={e => handleImageUpload('teamCrest', e.target.files[0])} className="hidden" />
              </div>
              {teamCrest && (
                <img src={teamCrest} alt="Escudo" className="mt-3 h-20 w-auto rounded-lg border border-slate-700" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Imagen secundaria</label>
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  onClick={() => secondaryInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 flex items-center gap-2 transition-colors"
                >
                  <Upload size={16} /> {secondaryImage ? 'Cambiar imagen' : 'Subir imagen'}
                </button>
                {secondaryImage && (
                  <button onClick={() => removeImage('secondaryImage')} className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-red-300 flex items-center gap-2 transition-colors">
                    <X size={16} /> Eliminar
                  </button>
                )}
                <input ref={secondaryInputRef} type="file" accept="image/*" onChange={e => handleImageUpload('secondaryImage', e.target.files[0])} className="hidden" />
              </div>
              {secondaryImage && (
                <img src={secondaryImage} alt="Imagen secundaria" className="mt-3 h-20 w-auto rounded-lg border border-slate-700" />
              )}
            </div>
          </div>
        </div>

        {/* Porteros */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Porteros por defecto</h3>
          <div className="space-y-2 mb-3">
            {porteros.map((p, i) => (
              <div
                key={i}
                draggable
                onDragStart={(e) => handlePorteroDragStart(e, i)}
                onDragOver={handlePorteroDragOver}
                onDrop={(e) => handlePorteroDrop(e, i)}
                onDragEnd={handlePorteroDragEnd}
                className={`flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-opacity ${draggedPorteroIdx === i ? 'opacity-50' : ''}`}
              >
                <GripVertical size={14} className="text-slate-500 shrink-0" />
                <span className="text-sm text-slate-200 flex-1">{p.name}</span>
                {porteros.length > 1 && (
                  <button onClick={() => removePortero(i)} className="p-1 hover:bg-red-900/30 rounded text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newPorteroName}
              onChange={e => setNewPorteroName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPortero()}
              placeholder="Nombre del portero"
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
            <button onClick={addPortero} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm text-white flex items-center gap-1 transition-colors">
              <Plus size={14} /> Añadir
            </button>
          </div>
        </div>

        {/* Etiquetas */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Etiquetas</h3>
          <div className="space-y-4">
            {renderTagSection('phase', 'Fases')}
            {renderTagSection('category', 'Categorías')}
            {renderTagSection('situation', 'Situaciones')}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-700">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar ajustes'}
          </button>
        </div>
      </div>
    </div>
  );
}
