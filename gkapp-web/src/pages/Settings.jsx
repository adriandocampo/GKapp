import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Upload, X, Trash2, ArrowLeft, Plus, GripVertical, DownloadCloud, RotateCcw, Loader2, User, Shield, Tags, Sliders } from 'lucide-react';
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
  const porteroPhotoRefs = useRef([]);
  const { refreshKey } = useSyncRefresh();

  const [teamName, setTeamName] = useState('Club Deportivo Lugo');
  const [teamCrest, setTeamCrest] = useState(null);
  const [secondaryImage, setSecondaryImage] = useState(null);
  const [porteros, setPorteros] = useState([]);
  const [newPorteroName, setNewPorteroName] = useState('');
  const [tags, setTags] = useState({ phase: [], category: [], situation: [], dimension: [] });
  const [newTagInputs, setNewTagInputs] = useState({ phase: '', category: '', situation: '' });
  const [saving, setSaving] = useState(false);
  const [draggedTag, setDraggedTag] = useState(null);
  const [draggedPorteroIdx, setDraggedPorteroIdx] = useState(null);
  const [dragOverType, setDragOverType] = useState(null);
  const [dragOverPorteroIdx, setDragOverPorteroIdx] = useState(null);
  const [lastBackup, setLastBackup] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [defaultAttributes, setDefaultAttributes] = useState({ dimensions: [] });
  const [newAttrNames, setNewAttrNames] = useState({});
  const [newDimName, setNewDimName] = useState('');
  const [editingDimIdx, setEditingDimIdx] = useState(null);
  const [editingDimName, setEditingDimName] = useState('');
  const [editingMicroIdx, setEditingMicroIdx] = useState(null);
  const [editingMicroName, setEditingMicroName] = useState('');
  const [corporateColor, setCorporateColor] = useState('#dc2626');
  const [activeTab, setActiveTab] = useState('equipo');

  async function loadSettings() {
    const name = await getSetting('teamName');
    const crest = await getSetting('teamCrest');
    const secondary = await getSetting('secondaryImage');
    const porterosData = await getSetting('defaultPorteros');
    const attrsData = await getSetting('defaultAttributes');
    if (name !== null) setTeamName(name);
    if (crest) setTeamCrest(crest);
    if (secondary) setSecondaryImage(secondary);
    if (porterosData) setPorteros(porterosData);
    if (attrsData?.dimensions?.length > 0) {
      setDefaultAttributes(attrsData);
    } else {
      const defaults = {
        dimensions: [
          {
            name: 'Defensa de Portería',
            microItems: [
              { name: 'Parada en portería', value: 70 },
              { name: '1 contra 1', value: 70 },
              { name: 'Velocidad de reacción', value: 70 },
              { name: 'Impulso', value: 70 },
            ],
          },
          {
            name: 'Defensa de Espacio',
            microItems: [
              { name: 'Altura en relación a línea defensiva', value: 70 },
              { name: 'Juego aéreo', value: 70 },
              { name: 'Coberturas', value: 70 },
            ],
          },
          {
            name: 'Juego Ofensivo',
            microItems: [
              { name: 'Continuidad', value: 70 },
              { name: 'Reinicios', value: 70 },
              { name: 'Saque de volea', value: 70 },
              { name: 'Saque de mano', value: 70 },
            ],
          },
          {
            name: 'Perfil Psicológico',
            microItems: [
              { name: 'Liderazgo', value: 70 },
              { name: 'Compostura', value: 70 },
              { name: 'Asertividad', value: 70 },
            ],
          },
        ],
      };
      setDefaultAttributes(defaults);
      await setSetting('defaultAttributes', defaults);
    }
    const color = await getSetting('corporateColor');
    if (color) setCorporateColor(color);
  }

  async function loadTags() {
    const all = await db.tags.toArray();
    const grouped = { phase: [], category: [], situation: [], dimension: [] };
    const seen = { phase: new Set(), category: new Set(), situation: new Set(), dimension: new Set() };
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
    setPorteros(prev => [...prev, { name: newPorteroName.trim().toUpperCase(), active: false, photo: null }]);
    setNewPorteroName('');
  }

  function handlePorteroPhotoUpload(index, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setPorteros(prev => prev.map((p, i) => i === index ? { ...p, photo: e.target.result } : p));
    };
    reader.readAsDataURL(file);
  }

  function removePorteroPhoto(index) {
    setPorteros(prev => prev.map((p, i) => i === index ? { ...p, photo: null } : p));
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
      await setSetting('defaultAttributes', defaultAttributes);
      await setSetting('corporateColor', corporateColor);
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
            className={`glass-card-static p-4 transition-colors ${isOver ? 'ring-2 ring-gk-accent/50' : ''}`}
            onDragOver={(e) => handleDragOver(e, type)}
            onDragLeave={() => handleDragLeave(type)}
            onDrop={(e) => handleDrop(e, type)}
          >
            <h4 className="text-sm font-medium mb-3" style={{color: '#baa587'}}>{label}</h4>
            <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
              {tags[type].length === 0 && (
                <span className="text-xs" style={{color: '#997b66'}}>No hay etiquetas</span>
              )}
              {tags[type].map(name => (
                <span
                  key={name}
                  draggable
                  onDragStart={(e) => handleDragStart(e, name, type)}
                  className="inline-flex items-center gap-1 px-3 py-1 border rounded-lg text-sm cursor-grab active:cursor-grabbing"
                  style={{
                    background: 'rgba(22,20,16,0.6)',
                    borderColor: 'rgba(185,165,135,0.1)',
                    color: '#baa587',
                    opacity: draggedTag?.name === name && draggedTag?.type === type ? 0.5 : 1,
                  }}
                >
                  {name}
                  <button onClick={() => deleteTag(type, name)} className="hover:text-stat-rose ml-1" style={{color: '#997b66'}}>
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
                className="v2-input flex-1"
              />
              <button onClick={() => addTag(type)} className="v2-btn-ghost" style={{background: 'rgba(232,172,101,0.12)', borderColor: 'rgba(232,172,101,0.2)', color: '#ecbd83'}}>
                <Plus size={14} /> Añadir
              </button>
            </div>
          </div>
    );
  }

  async function addMicroItem(dimIdx) {
    const input = (newAttrNames[dimIdx] || '').trim();
    if (!input) return;
    const updatedAttrs = {
      ...defaultAttributes,
      dimensions: defaultAttributes.dimensions.map((d, i) =>
        i === dimIdx ? { ...d, microItems: [...d.microItems, { name: input, value: 70 }] } : d
      )
    };
    setDefaultAttributes(updatedAttrs);
    setNewAttrNames(prev => ({ ...prev, [dimIdx]: '' }));
    await setSetting('defaultAttributes', updatedAttrs);
    try {
      const all = await db.porteros.toArray();
      for (const gk of all) {
        const gkAttrs = gk.customAttributes;
        if (!gkAttrs || !gkAttrs.dimensions || gkAttrs.dimensions.length <= dimIdx) continue;
        await db.porteros.update(gk.id, {
          customAttributes: {
            ...gkAttrs,
            dimensions: gkAttrs.dimensions.map((d, i) =>
              i === dimIdx ? { ...d, microItems: [...d.microItems, { name: input, value: 50 }] } : d
            )
          },
          updatedAt: new Date()
        });
      }
    } catch (err) {
      console.error('[addMicroItem] Error syncing goalkeepers:', err);
    }
  }

  async function removeMicroItem(dimIdx, microIdx) {
    const removedName = defaultAttributes.dimensions[dimIdx]?.microItems[microIdx]?.name;
    if (!removedName) return;
    const updatedAttrs = {
      ...defaultAttributes,
      dimensions: defaultAttributes.dimensions.map((d, i) =>
        i === dimIdx ? { ...d, microItems: d.microItems.filter(m => m.name !== removedName) } : d
      )
    };
    setDefaultAttributes(updatedAttrs);
    await setSetting('defaultAttributes', updatedAttrs);
    try {
      const all = await db.porteros.toArray();
      for (const gk of all) {
        const gkAttrs = gk.customAttributes;
        if (!gkAttrs || !gkAttrs.dimensions || gkAttrs.dimensions.length <= dimIdx) continue;
        await db.porteros.update(gk.id, {
          customAttributes: {
            ...gkAttrs,
            dimensions: gkAttrs.dimensions.map((d, i) =>
              i === dimIdx ? { ...d, microItems: d.microItems.filter(m => m.name !== removedName) } : d
            )
          },
          updatedAt: new Date()
        });
      }
    } catch (err) {
      console.error('[removeMicroItem] Error syncing goalkeepers:', err);
    }
  }

  function updateMicroValue(dimIdx, microIdx, value) {
    setDefaultAttributes(prev => ({
      ...prev,
      dimensions: prev.dimensions.map((d, i) =>
        i === dimIdx ? { ...d, microItems: d.microItems.map((m, mi) => mi === microIdx ? { ...m, value } : m) } : d
      )
    }));
  }

  async function renameMicroItem(dimIdx, microIdx, name) {
    const oldName = defaultAttributes.dimensions[dimIdx]?.microItems[microIdx]?.name;
    if (!oldName) return;
    const updatedAttrs = {
      ...defaultAttributes,
      dimensions: defaultAttributes.dimensions.map((d, i) =>
        i === dimIdx ? { ...d, microItems: d.microItems.map((m, mi) => mi === microIdx ? { ...m, name } : m) } : d
      )
    };
    setDefaultAttributes(updatedAttrs);
    setEditingMicroIdx(null);
    if (oldName !== name) {
      await setSetting('defaultAttributes', updatedAttrs);
    }
    try {
      const all = await db.porteros.toArray();
      for (const gk of all) {
        const gkAttrs = gk.customAttributes;
        if (!gkAttrs || !gkAttrs.dimensions || gkAttrs.dimensions.length <= dimIdx) continue;
        await db.porteros.update(gk.id, {
          customAttributes: {
            ...gkAttrs,
            dimensions: gkAttrs.dimensions.map((d, i) =>
              i === dimIdx ? { ...d, microItems: d.microItems.map(m => m.name === oldName ? { ...m, name } : m) } : d
            )
          },
          updatedAt: new Date()
        });
      }
    } catch (err) {
      console.error('[renameMicroItem] Error syncing goalkeepers:', err);
    }
  }

  async function addDimension() {
    if (!newDimName.trim()) return;
    const name = newDimName.trim();
    const newDim = { name, microItems: [{ name: 'Nuevo atributo', value: 70 }] };
    const updatedAttrs = {
      ...defaultAttributes,
      dimensions: [...defaultAttributes.dimensions, newDim]
    };
    setDefaultAttributes(updatedAttrs);
    setNewDimName('');
    await setSetting('defaultAttributes', updatedAttrs);
    try {
      const gkDim = { name, microItems: [{ name: 'Nuevo atributo', value: 50 }] };
      const all = await db.porteros.toArray();
      for (const gk of all) {
        const gkAttrs = gk.customAttributes;
        if (!gkAttrs || !gkAttrs.dimensions) continue;
        await db.porteros.update(gk.id, {
          customAttributes: {
            ...gkAttrs,
            dimensions: [...gkAttrs.dimensions, { ...gkDim, microItems: gkDim.microItems.map(m => ({ ...m })) }]
          },
          updatedAt: new Date()
        });
      }
    } catch (err) {
      console.error('[addDimension] Error syncing goalkeepers:', err);
    }
  }

  async function removeDimension(dimIdx) {
    const removedName = defaultAttributes.dimensions[dimIdx]?.name;
    if (!removedName) return;
    const updatedAttrs = {
      ...defaultAttributes,
      dimensions: defaultAttributes.dimensions.filter((_, i) => i !== dimIdx)
    };
    setDefaultAttributes(updatedAttrs);
    await setSetting('defaultAttributes', updatedAttrs);
    try {
      const all = await db.porteros.toArray();
      for (const gk of all) {
        const gkAttrs = gk.customAttributes;
        if (!gkAttrs || !gkAttrs.dimensions) continue;
        await db.porteros.update(gk.id, {
          customAttributes: {
            ...gkAttrs,
            dimensions: gkAttrs.dimensions.filter(d => d.name !== removedName)
          },
          updatedAt: new Date()
        });
      }
    } catch (err) {
      console.error('[removeDimension] Error syncing goalkeepers:', err);
    }
  }

  async function renameDimension(dimIdx, name) {
    const oldName = defaultAttributes.dimensions[dimIdx]?.name;
    if (!oldName) return;
    const updatedAttrs = {
      ...defaultAttributes,
      dimensions: defaultAttributes.dimensions.map((d, i) => i === dimIdx ? { ...d, name } : d)
    };
    setDefaultAttributes(updatedAttrs);
    setEditingDimIdx(null);
    if (oldName !== name) {
      await setSetting('defaultAttributes', updatedAttrs);
    }
    try {
      const all = await db.porteros.toArray();
      for (const gk of all) {
        const gkAttrs = gk.customAttributes;
        if (!gkAttrs || !gkAttrs.dimensions) continue;
        await db.porteros.update(gk.id, {
          customAttributes: {
            ...gkAttrs,
            dimensions: gkAttrs.dimensions.map(d => d.name === oldName ? { ...d, name } : d)
          },
          updatedAt: new Date()
        });
      }
    } catch (err) {
      console.error('[renameDimension] Error syncing goalkeepers:', err);
    }
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

  const tabs = [
    { key: 'equipo', icon: Shield, label: 'Equipo' },
    { key: 'etiquetas', icon: Tags, label: 'Etiquetas' },
    { key: 'atributos', icon: Sliders, label: 'Atributos' },
  ];

  return (
    <div className="animate-v2-fade-in-up -mx-4 -my-6 px-4 py-6 min-h-[calc(100vh-4rem)]" style={{ backgroundColor: '#0c0b09' }}>
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="v2-btn-ghost p-2 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold" style={{color: '#f1ede7'}}>Ajustes</h1>
      </div>

      <div className="glass-card-static overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Sidebar */}
          <div className="md:w-48 shrink-0 border-b md:border-b-0 md:border-r" style={{borderColor: 'rgba(185,165,135,0.08)', background: 'rgba(22,20,16,0.3)'}}>
            <nav className="p-3 space-y-1">
              {tabs.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: activeTab === key ? 'rgba(232,172,101,0.1)' : 'transparent',
                    color: activeTab === key ? '#e8ac65' : '#997b66',
                    border: activeTab === key ? '1px solid rgba(232,172,101,0.2)' : '1px solid transparent',
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
              {user?.uid && (
                <>
                  <div className="my-3 border-t" style={{borderColor: 'rgba(185,165,135,0.08)'}} />
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-medium mb-2" style={{color: '#baa587'}}>
                      <DownloadCloud size={12} />
                      Copia de seguridad
                    </div>
                    {lastBackup ? (
                      <p className="text-xs mb-2" style={{color: '#997b66'}}>
                        Último:{' '}
                        <span style={{color: '#f1ede7'}}>
                          {lastBackup._createdAt?.toDate?.()?.toLocaleDateString('es-ES', {
                            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          }) || 'desconocida'}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs mb-2" style={{color: '#997b66'}}>No hay backups</p>
                    )}
                    <button
                      onClick={handleRestore}
                      disabled={restoring}
                      className="w-full py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                      style={{background: 'rgba(232,172,101,0.08)', border: '1px solid rgba(232,172,101,0.15)', color: '#ecbd83'}}
                    >
                      {restoring ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                      {restoring ? 'Restaurando...' : 'Restaurar'}
                    </button>
                  </div>
                </>
              )}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 lg:p-8 overflow-y-auto" style={{maxHeight: 'calc(100vh - 14rem)'}}>
            {activeTab === 'equipo' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 pb-3" style={{color: '#baa587', borderBottom: '1px solid rgba(185,165,135,0.08)'}}>Equipo</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{color: '#baa587'}}>Nombre del equipo</label>
                      <input
                        value={teamName}
                        onChange={e => setTeamName(e.target.value)}
                        placeholder="Mi equipo"
                        className="v2-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{color: '#baa587'}}>Escudo</label>
                      <div className="flex items-center gap-4 flex-wrap">
                        <button
                          onClick={() => crestInputRef.current?.click()}
                          className="v2-btn-ghost"
                        >
                          <Upload size={16} /> {teamCrest ? 'Cambiar escudo' : 'Subir escudo'}
                        </button>
                        {teamCrest && (
                          <button onClick={() => removeImage('teamCrest')} className="v2-btn-danger">
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
                      <label className="block text-sm font-medium mb-2" style={{color: '#baa587'}}>Imagen secundaria</label>
                      <div className="flex items-center gap-4 flex-wrap">
                        <button
                          onClick={() => secondaryInputRef.current?.click()}
                          className="v2-btn-ghost"
                        >
                          <Upload size={16} /> {secondaryImage ? 'Cambiar imagen' : 'Subir imagen'}
                        </button>
                        {secondaryImage && (
                          <button onClick={() => removeImage('secondaryImage')} className="v2-btn-danger">
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

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 pb-3" style={{color: '#baa587', borderBottom: '1px solid rgba(185,165,135,0.08)'}}>Color corporativo</h3>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={corporateColor}
                      onChange={e => setCorporateColor(e.target.value)}
                      className="h-10 w-16 rounded-lg cursor-pointer"
                      style={{ border: '1px solid rgba(185,165,135,0.15)', background: 'transparent', padding: 2 }}
                    />
                    <span className="text-sm font-mono text-gk-text-primary">{corporateColor}</span>
                    <span className="text-xs" style={{color: '#997b66'}}>Se usa en las líneas de la plantilla de sesión</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 pb-3" style={{color: '#baa587', borderBottom: '1px solid rgba(185,165,135,0.08)'}}>Porteros por defecto</h3>
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
                        <div className="relative shrink-0">
                          {p.photo ? (
                            <div className="relative group">
                              <img src={p.photo} alt={p.name} referrerpolicy="no-referrer"
                                className="w-9 h-9 rounded-lg object-cover border border-gk-border" />
                              <button
                                onClick={() => removePorteroPhoto(i)}
                                className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'rgba(208,140,96,0.9)', color: 'white' }}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => porteroPhotoRefs.current[i]?.click()}
                              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                              style={{ background: 'rgba(22,20,16,0.8)', border: '1px dashed rgba(185,165,135,0.2)', color: '#997b66' }}
                              title="Añadir foto"
                            >
                              <User size={14} />
                            </button>
                          )}
                          <input
                            ref={el => porteroPhotoRefs.current[i] = el}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handlePorteroPhotoUpload(i, e.target.files?.[0])}
                          />
                        </div>
                        <span className="text-sm text-gk-text-primary flex-1 min-w-0 truncate">{p.name}</span>
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
                      className="v2-input flex-1"
                    />
                    <button onClick={addPortero} className="v2-btn-ghost" style={{background: 'rgba(232,172,101,0.12)', borderColor: 'rgba(232,172,101,0.2)', color: '#ecbd83'}}>
                      <Plus size={14} /> Añadir
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'etiquetas' && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 pb-3" style={{color: '#baa587', borderBottom: '1px solid rgba(185,165,135,0.08)'}}>Etiquetas</h3>
                <div className="space-y-4">
                  {renderTagSection('phase', 'Fases')}
                  {renderTagSection('dimension', 'Dimensiones')}
                  {renderTagSection('category', 'Categorías')}
                  {renderTagSection('situation', 'Situaciones')}
                </div>
              </div>
            )}

            {activeTab === 'atributos' && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 pb-3" style={{color: '#baa587', borderBottom: '1px solid rgba(185,165,135,0.08)'}}>Atributos Personalizados</h3>
                <p className="text-xs mb-3" style={{color: '#997b66'}}>Estos atributos se usarán al crear un nuevo portero</p>
                <div className="space-y-3">
                  {defaultAttributes.dimensions && defaultAttributes.dimensions.map((dim, di) => (
                    <div key={di} className="rounded-xl p-4" style={{background: 'rgba(22,20,16,0.4)'}}>
                      <div className="flex items-center justify-between mb-3 pb-2" style={{borderBottom: '1px solid rgba(185,165,135,0.08)'}}>
                        {editingDimIdx === di ? (
                          <input type="text" value={editingDimName}
                            onChange={e => setEditingDimName(e.target.value)}
                            onBlur={() => { renameDimension(di, editingDimName); }}
                            onKeyDown={e => e.key === 'Enter' && renameDimension(di, editingDimName)}
                            className="v2-input text-sm py-1 px-2 flex-1" autoFocus />
                        ) : (
                          <h4 className="text-sm font-semibold cursor-pointer" style={{color: '#f1ede7'}}
                            onClick={() => { setEditingDimIdx(di); setEditingDimName(dim.name); }}>
                            {dim.name}
                          </h4>
                        )}
                        <button onClick={() => removeDimension(di)} className="p-1 hover:bg-red-900/30 rounded transition-colors" style={{color: '#d08c60'}}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {dim.microItems.map((item, mi) => (
                          <div key={mi} className="flex items-center gap-2">
                            {editingMicroIdx?.dimIdx === di && editingMicroIdx?.microIdx === mi ? (
                              <input type="text" value={editingMicroName}
                                onChange={e => setEditingMicroName(e.target.value)}
                                onBlur={() => { renameMicroItem(di, mi, editingMicroName); }}
                                onKeyDown={e => e.key === 'Enter' && renameMicroItem(di, mi, editingMicroName)}
                                className="v2-input text-xs py-1 px-2 flex-1" autoFocus />
                            ) : (
                              <span className="text-sm flex-1 min-w-0 truncate cursor-pointer" style={{color: '#baa587'}}
                                onClick={() => { setEditingMicroIdx({ dimIdx: di, microIdx: mi }); setEditingMicroName(item.name); }}>
                                {item.name}
                              </span>
                            )}
                            <input type="range" min="0" max="100" value={item.value}
                              onChange={e => updateMicroValue(di, mi, parseInt(e.target.value))}
                              className="v2-rpe" style={{width: 80}} />
                            <span className="text-xs font-bold w-6 text-right" style={{color: '#e8ac65'}}>{item.value}</span>
                            <button onClick={() => removeMicroItem(di, mi)} className="p-1 hover:bg-red-900/30 rounded transition-colors" style={{color: '#997b66'}}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3 pt-3" style={{borderTop: '1px solid rgba(185,165,135,0.06)'}}>
                        <input value={newAttrNames[di] || ''} onChange={e => setNewAttrNames(prev => ({ ...prev, [di]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addMicroItem(di)}
                          placeholder={`Nuevo atributo en ${dim.name}`} className="v2-input flex-1 text-xs" />
                        <button onClick={() => addMicroItem(di)} className="v2-btn-ghost text-xs py-1 px-2 shrink-0" style={{background: 'rgba(232,172,101,0.12)', borderColor: 'rgba(232,172,101,0.2)', color: '#ecbd83'}}>
                          <Plus size={12} /> Añadir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <input value={newDimName} onChange={e => setNewDimName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDimension()}
                    placeholder="Nueva dimensión" className="v2-input flex-1" />
                  <button onClick={addDimension} className="v2-btn-ghost" style={{background: 'rgba(232,172,101,0.12)', borderColor: 'rgba(232,172,101,0.2)', color: '#ecbd83'}}>
                    <Plus size={14} /> Añadir dimensión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t p-4" style={{borderColor: 'rgba(185,165,135,0.08)'}}>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #e8ac65, #ecbd83)',
              color: '#0c0b09',
              fontSize: '0.95rem',
              opacity: saving ? 0.5 : 1,
              boxShadow: saving ? 'none' : '0 4px 20px rgba(232,172,101,0.3)',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            <Save size={18} /> {saving ? 'Guardando...' : 'Guardar ajustes'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
