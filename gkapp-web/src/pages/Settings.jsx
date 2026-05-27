import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Upload, X, Trash2, ArrowLeft, Plus, GripVertical, DownloadCloud, RotateCcw, Loader2 } from 'lucide-react';
import { db, getSetting, setSetting } from '../db';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Modal';
import { useSyncRefresh } from '../contexts/SyncContext';
import { getBackup, restoreFromBackup } from '../utils/adminFirestore';
import { useAuth } from '../contexts/AuthContext';
import { syncFromFirestore } from '../sync';

export default function Settings() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const crestInputRef = useRef();
  const secondaryInputRef = useRef();
  const { refreshKey } = useSyncRefresh();

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
  const [dragOverType, setDragOverType] = useState(null);
  const [dragOverPorteroIdx, setDragOverPorteroIdx] = useState(null);
  const [lastBackup, setLastBackup] = useState(null);
  const [restoring, setRestoring] = useState(false);

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
    const seen = { phase: new Set(), category: new Set(), situation: new Set() };
    all.forEach(t => {
      if (grouped[t.type] && !seen[t.type].has(t.name)) {
        grouped[t.type].push(t.name);
        seen[t.type].add(t.name);
      }
    });
    setTags(grouped);
  }

  useEffect(() => {
    loadSettings();
    loadTags();
    loadBackupInfo();
  }, [refreshKey]);

  async function loadBackupInfo() {
    if (!user?.uid) return;
    try {
      const meta = await getBackup(user.uid);
      setLastBackup(meta);
    } catch {
      setLastBackup(null);
    }
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
    e.dataTransfer.setData('text/plain', tagName);
  }

  function handleDragOver(e, type) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverType(type);
  }

  function handleDragLeave(type) {
    if (dragOverType === type) setDragOverType(null);
  }

  function handleDrop(e, toType) {
    e.preventDefault();
    setDragOverType(null);
    if (draggedTag) {
      moveTag(draggedTag.name, draggedTag.type, toType);
      setDraggedTag(null);
    }
  }

  function handlePorteroDragStart(e, idx) {
    setDraggedPorteroIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handlePorteroDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPorteroIdx(idx);
  }

  function handlePorteroDragLeave() {
    setDragOverPorteroIdx(null);
  }

  function handlePorteroDrop(e, targetIdx) {
    e.preventDefault();
    setDragOverPorteroIdx(null);
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
    setDragOverPorteroIdx(null);
  }

  function renderTagSection(type, label) {
    const isOver = dragOverType === type;
    return (
      <div
        className={`bg-gk-page rounded-lg p-4 transition-colors ${isOver ? 'ring-2 ring-gk-accent/50 bg-gk-card' : ''}`}
        onDragOver={(e) => handleDragOver(e, type)}
        onDragLeave={() => handleDragLeave(type)}
        onDrop={(e) => handleDrop(e, type)}
      >
        <h4 className="text-sm font-medium text-gk-text-secondary mb-3">{label}</h4>
        <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
          {tags[type].length === 0 && (
            <span className="text-xs text-gk-text-tertiary">No hay etiquetas</span>
          )}
          {tags[type].map(name => (
            <span
              key={name}
              draggable
              onDragStart={(e) => handleDragStart(e, name, type)}
              className={`inline-flex items-center gap-1 px-3 py-1 bg-gk-card border border-gk-border rounded-lg text-sm text-gk-text-secondary cursor-grab active:cursor-grabbing ${draggedTag?.name === name && draggedTag?.type === type ? 'opacity-50' : ''}`}
            >
              {name}
              <button onClick={() => deleteTag(type, name)} className="text-stat-rose hover:text-stat-rose ml-1">
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
            className="flex-1 px-3 py-1.5 bg-gk-card border border-gk-border rounded-lg text-sm text-gk-text-primary placeholder-gk-text-tertiary focus:outline-none focus:border-gk-accent"
          />
          <button onClick={() => addTag(type)} className="px-3 py-1.5 bg-gk-accent hover:bg-gk-accent rounded-lg text-sm text-white flex items-center gap-1 transition-colors">
            <Plus size={14} /> Añadir
          </button>
        </div>
      </div>
    );
  }

  async function handleRestore() {
    if (!user?.uid) return;
    const ok = await confirm(
      'Se van a SOBREESCRIBIR todos tus datos actuales con los del backup. Los cambios realizados después del backup se perderán. ¿Continuar?',
      { title: 'Restaurar backup', confirmText: 'Restaurar', confirmColor: 'amber' }
    );
    if (!ok) return;
    setRestoring(true);
    try {
      await restoreFromBackup(user.uid);
      addToast('Datos restaurados. Sincronizando...', 'info');
      await syncFromFirestore(user.uid);
      addToast('Restauración completada', 'success');
      await loadSettings();
      await loadTags();
      await loadBackupInfo();
    } catch (err) {
      addToast('Error al restaurar: ' + err.message, 'error');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-gk-card rounded-lg text-gk-text-tertiary">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold font-serif text-gk-text-primary tracking-tight">Ajustes</h1>
      </div>

      <div className="bg-gk-card rounded-xl border border-gk-border p-6 space-y-8">
        {/* Team info */}
        <div>
          <h3 className="text-sm font-semibold text-gk-text-tertiary uppercase tracking-wider mb-4">Equipo</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gk-text-tertiary mb-2">Nombre del equipo</label>
              <input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="Mi equipo"
                className="w-full px-4 py-2 bg-gk-page border border-gk-border rounded-lg text-gk-text-primary focus:outline-none focus:border-gk-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gk-text-tertiary mb-2">Escudo</label>
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  onClick={() => crestInputRef.current?.click()}
                  className="px-4 py-2 bg-gk-elevated hover:bg-gk-elevated rounded-lg text-gk-text-primary flex items-center gap-2 transition-colors"
                >
                  <Upload size={16} /> {teamCrest ? 'Cambiar escudo' : 'Subir escudo'}
                </button>
                {teamCrest && (
                  <button onClick={() => removeImage('teamCrest')} className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-stat-rose flex items-center gap-2 transition-colors">
                    <X size={16} /> Eliminar
                  </button>
                )}
                <input ref={crestInputRef} type="file" accept="image/*" onChange={e => handleImageUpload('teamCrest', e.target.files[0])} className="hidden" />
              </div>
              {teamCrest && (
                <img src={teamCrest} alt="Escudo" className="mt-3 h-20 w-auto rounded-lg border border-gk-border" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gk-text-tertiary mb-2">Imagen secundaria</label>
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  onClick={() => secondaryInputRef.current?.click()}
                  className="px-4 py-2 bg-gk-elevated hover:bg-gk-elevated rounded-lg text-gk-text-primary flex items-center gap-2 transition-colors"
                >
                  <Upload size={16} /> {secondaryImage ? 'Cambiar imagen' : 'Subir imagen'}
                </button>
                {secondaryImage && (
                  <button onClick={() => removeImage('secondaryImage')} className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-stat-rose flex items-center gap-2 transition-colors">
                    <X size={16} /> Eliminar
                  </button>
                )}
                <input ref={secondaryInputRef} type="file" accept="image/*" onChange={e => handleImageUpload('secondaryImage', e.target.files[0])} className="hidden" />
              </div>
              {secondaryImage && (
                <img src={secondaryImage} alt="Imagen secundaria" className="mt-3 h-20 w-auto rounded-lg border border-gk-border" />
              )}
            </div>
          </div>
        </div>

        {/* Porteros */}
        <div>
          <h3 className="text-sm font-semibold text-gk-text-tertiary uppercase tracking-wider mb-4">Porteros por defecto</h3>
          <div className="space-y-2 mb-3">
              {porteros.map((p, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={(e) => handlePorteroDragStart(e, i)}
                  onDragOver={(e) => handlePorteroDragOver(e, i)}
                  onDragLeave={handlePorteroDragLeave}
                  onDrop={(e) => handlePorteroDrop(e, i)}
                  onDragEnd={handlePorteroDragEnd}
                  className={`flex items-center gap-3 bg-gk-page px-4 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all ${
                    draggedPorteroIdx === i ? 'opacity-50' : ''
                  } ${
                    dragOverPorteroIdx === i && draggedPorteroIdx !== i ? 'ring-2 ring-gk-accent/50 scale-[1.02]' : ''
                  }`}
                >
                <GripVertical size={14} className="text-gk-text-tertiary shrink-0" />
                <span className="text-sm text-gk-text-primary flex-1">{p.name}</span>
                {porteros.length > 1 && (
                  <button onClick={() => removePortero(i)} className="p-1 hover:bg-red-900/30 rounded text-gk-text-tertiary hover:text-stat-rose transition-colors">
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
              className="flex-1 px-3 py-2 bg-gk-page border border-gk-border rounded-lg text-sm text-gk-text-primary placeholder-gk-text-tertiary focus:outline-none focus:border-gk-accent"
            />
            <button onClick={addPortero} className="px-4 py-2 bg-gk-accent hover:bg-gk-accent rounded-lg text-sm text-white flex items-center gap-1 transition-colors">
              <Plus size={14} /> Añadir
            </button>
          </div>
        </div>

        {/* Etiquetas */}
        <div>
          <h3 className="text-sm font-semibold text-gk-text-tertiary uppercase tracking-wider mb-4">Etiquetas</h3>
          <div className="space-y-4">
            {renderTagSection('phase', 'Fases')}
            {renderTagSection('category', 'Categorías')}
            {renderTagSection('situation', 'Situaciones')}
          </div>
        </div>

        {/* Backup */}
        {user?.uid && (
          <div>
            <h3 className="text-sm font-semibold text-gk-text-tertiary uppercase tracking-wider mb-4">
              <DownloadCloud size={16} className="inline mr-2" />
              Copia de seguridad
            </h3>
            {lastBackup ? (
              <div className="space-y-3">
                <p className="text-sm text-gk-text-tertiary">
                  Último backup:{' '}
                  <span className="text-gk-text-primary font-medium">
                    {lastBackup._createdAt?.toDate?.()?.toLocaleDateString('es-ES', {
                      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) || 'desconocida'}
                  </span>
                </p>
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
                >
                  {restoring ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                  {restoring ? 'Restaurando...' : 'Restaurar desde backup'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gk-text-tertiary">No hay backups disponibles</p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-gk-border">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-gk-accent hover:bg-gk-accent disabled:opacity-50 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar ajustes'}
          </button>
        </div>
      </div>
    </div>
  );
}
