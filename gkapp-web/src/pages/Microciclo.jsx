import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X, Printer, Copy, Search, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, getSetting } from '../db';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Modal';
import { useSyncRefresh } from '../contexts/SyncContext';
import MicrocicloTemplate from '../components/MicrocicloTemplate';
import { generateDays, getInclusiveDayCount, isValidMicrocycleRange, getDimensionById } from '../data/microcicloItems';
import { formatDateDDMMYY } from '../utils/date';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function nextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function normalizeMicrocicloDay(day, fallback) {
  const base = fallback || generateDays(day?.date || nextMonday(), day?.date || nextMonday())[0];
  const source = day || {};
  const sourceGrid = source.grid || {};
  const sourceFisico = sourceGrid.fisico || {};
  return {
    ...base,
    ...source,
    grid: {
      ...base.grid,
      ...sourceGrid,
      dimension: Array.isArray(sourceGrid.dimension) ? sourceGrid.dimension : (sourceGrid.dimension ? [sourceGrid.dimension] : []),
      situacion: Array.isArray(sourceGrid.situacion) ? sourceGrid.situacion : [],
      categoria: Array.isArray(sourceGrid.categoria) ? sourceGrid.categoria : [],
      fisico: {
        ...base.grid.fisico,
        ...sourceFisico,
        customFields: Array.isArray(sourceFisico.customFields) ? sourceFisico.customFields : [],
      },
    },
    match: { ...base.match, ...(source.match || {}) },
  };
}

function NewMicrocicloRangeModal({ onConfirm, onClose }) {
  const [dateStart, setDateStart] = useState(nextMonday());
  const [dateEnd, setDateEnd] = useState(addDays(nextMonday(), 6));
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!isValidMicrocycleRange(dateStart, dateEnd)) {
      setError(`El rango debe tener entre 3 y 14 días (actual: ${getInclusiveDayCount(dateStart, dateEnd)}).`);
      return;
    }
    onConfirm({ dateStart, dateEnd });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl p-6" style={{ background: '#171512', border: '1px solid rgba(232,172,101,0.22)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#f1ede7' }}>Nuevo microciclo</h2>
            <p className="text-xs mt-1" style={{ color: '#997b66' }}>Define primero el periodo de trabajo</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg" style={{ color: '#997b66' }}><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: '#997b66' }}>
              Desde
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="v2-input w-full mt-1" />
            </label>
            <label className="text-xs" style={{ color: '#997b66' }}>
              Hasta
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="v2-input w-full mt-1" />
            </label>
          </div>
          <div className="text-xs" style={{ color: '#baa587' }}>
            {getInclusiveDayCount(dateStart, dateEnd)} días seleccionados. Mínimo 3, máximo 14.
          </div>
          {error && <div className="text-xs" style={{ color: '#e04a4a' }}>{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="v2-btn-ghost">Cancelar</button>
          <button type="submit" className="v2-btn-ghost" style={{ background: 'rgba(232,172,101,0.14)', borderColor: 'rgba(232,172,101,0.25)', color: '#e8ac65' }}>Abrir plantilla</button>
        </div>
      </form>
    </div>
  );
}

function MicrocicloEditor({ microciclo, seasons, onSave, onClose, onDelete, confirm, addToast }) {
  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);
  const savePromiseRef = useRef(Promise.resolve());
  const microcicloIdRef = useRef(microciclo?.id || crypto.randomUUID());
  const createdAtRef = useRef(microciclo?.createdAt || new Date());
  const savedOnce = useRef(!!microciclo?.id);
  const autoSaveRef = useRef(async () => {});
  const navigate = useNavigate();

  const [name, setName] = useState(microciclo?.name || '');
  const [seasonId, setSeasonId] = useState(microciclo?.seasonId || (seasons?.length > 0 ? seasons[seasons.length - 1].id : null));
  const [dateStart, setDateStart] = useState(microciclo?.dateStart || nextMonday());
  const [dateEnd, setDateEnd] = useState(microciclo?.dateEnd || addDays(nextMonday(), 6));
  const [rival, setRival] = useState(microciclo?.rival || '');
  const [days, setDays] = useState(() => {
    const start = microciclo?.dateStart || nextMonday();
    const end = microciclo?.dateEnd || addDays(nextMonday(), 6);
    const generated = generateDays(start, end);
    if (microciclo?.days && microciclo.days.length > 0) {
      return microciclo.days.map((day, index) => normalizeMicrocicloDay(day, generated[index] || generated[0]));
    }
    return generated;
  });
  const [proposito, setProposito] = useState(microciclo?.proposito || '');
  const [tipologiaTareas, setTipologiaTareas] = useState(microciclo?.tipologiaTareas || '');
  const [observacionesPre, setObservacionesPre] = useState(microciclo?.observacionesPre || '');
  const [observacionesPost, setObservacionesPost] = useState(microciclo?.observacionesPost || '');
  const [showPrint, setShowPrint] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamCrest, setTeamCrest] = useState(null);
  const [corporateColor, setCorporateColor] = useState('#2e7d32');

  useEffect(() => {
    getSetting('teamName').then(n => { if (n) setTeamName(n); });
    getSetting('teamCrest').then(c => { if (c) setTeamCrest(c); });
    getSetting('corporateColor').then(c => { if (c) setCorporateColor(c); });
  }, []);

  useEffect(() => {
    const newDays = generateDays(dateStart, dateEnd);
    const oldByDate = {};
    days.forEach(d => { oldByDate[d.date] = d; });
    const merged = newDays.map(d => oldByDate[d.date]
      ? normalizeMicrocicloDay({ ...oldByDate[d.date], dayName: d.dayName, date: d.date, dayIndex: d.dayIndex }, d)
      : d);
    setDays(merged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStart, dateEnd]);

  const numSesiones = useMemo(() => days.filter(d => !d.isRestDay).length, [days]);

  autoSaveRef.current = async function doSave(force = false) {
    const cName = name;
    const cSeasonId = seasonId;
    const cDateStart = dateStart;
    const cDateEnd = dateEnd;
    const cDays = days;
    const cRival = rival;
    const cProposito = proposito;
    const cTipologia = tipologiaTareas;
    const cPre = observacionesPre;
    const cPost = observacionesPost;
    const cNumSesiones = cDays.filter(d => !d.isRestDay).length;
    if (!cName.trim() || !cSeasonId || !cDateStart || !cDateEnd) return;
    if (savingRef.current) {
      if (!force) return;
      await savePromiseRef.current;
    }
    savingRef.current = true;
    savePromiseRef.current = (async () => {
      const id = microcicloIdRef.current;
      await db.microciclos.put({
        id,
        name: cName.trim(),
        seasonId: cSeasonId,
        dateStart: cDateStart,
        dateEnd: cDateEnd,
        rival: cRival,
        days: cDays,
        proposito: cProposito,
        tipologiaTareas: cTipologia,
        observacionesPre: cPre,
        observacionesPost: cPost,
        numSesiones: cNumSesiones,
        createdAt: createdAtRef.current,
        updatedAt: new Date(),
        deletedAt: null,
      });
      if (!savedOnce.current) {
        savedOnce.current = true;
        onSave({ id, name: cName.trim(), seasonId: cSeasonId, dateStart: cDateStart, dateEnd: cDateEnd, rival: cRival, days: cDays, proposito: cProposito, tipologiaTareas: cTipologia, observacionesPre: cPre, observacionesPost: cPost, numSesiones: cNumSesiones });
      }
    })();
    try {
      await savePromiseRef.current;
    } finally {
      savingRef.current = false;
    }
  };

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => autoSaveRef.current(), 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [name, seasonId, dateStart, dateEnd, days, rival, proposito, tipologiaTareas, observacionesPre, observacionesPost]);

  function handleUpdateDay(index, updates) {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d));
  }

  function handleUpdateDayGrid(index, updates) {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, grid: { ...d.grid, ...updates } } : d));
  }

  function handleUpdateDayFisico(index, updates) {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, grid: { ...d.grid, fisico: { ...d.grid.fisico, ...updates } } } : d));
  }

  function handleUpdateDayMatch(index, updates) {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, match: { ...d.match, ...updates } } : d));
  }

  function handleDropItem(index, rowType, item) {
    const dimension = item.dimensionId ? getDimensionById(item.dimensionId) : null;
    setDays(prev => prev.map((day, i) => {
      if (i !== index || day.isRestDay) return day;
      const grid = day.grid || {};
      if (rowType === 'dimension') {
        const dimensions = Array.isArray(grid.dimension) ? grid.dimension : (grid.dimension ? [grid.dimension] : []);
        if (dimensions.includes(item.label)) return day;
        return { ...day, grid: { ...grid, dimension: [...dimensions, item.label] } };
      }
      if ((rowType === 'situacion' || rowType === 'categoria') && dimension) {
        const dimensions = Array.isArray(grid.dimension) ? grid.dimension : (grid.dimension ? [grid.dimension] : []);
        if (dimensions.length > 0 && !dimensions.includes(dimension.name)) return day;
        const key = rowType === 'situacion' ? 'situacion' : 'categoria';
        const values = Array.isArray(grid[key]) ? grid[key] : [];
        if (values.includes(item.label)) return day;
        return { ...day, grid: { ...grid, dimension: dimensions.includes(dimension.name) ? dimensions : [...dimensions, dimension.name], [key]: [...values, item.label] } };
      }
      if (rowType === 'fisicoTipo') {
        if (grid.fisico?.tipo === item.label) return day;
        return { ...day, grid: { ...grid, fisico: { ...grid.fisico, tipo: item.label } } };
      }
      return day;
    }));
  }

  function handleDatesChange(nextStart, nextEnd) {
    if (!isValidMicrocycleRange(nextStart, nextEnd)) {
      addToast(`El rango debe tener entre 3 y 14 días (actual: ${getInclusiveDayCount(nextStart, nextEnd)}).`, 'warning');
      return;
    }
    setDateStart(nextStart);
    setDateEnd(nextEnd);
  }

  function handleCycleDay(index) {
    setDays(prev => prev.map((d, i) => {
      if (i !== index) return d;
      if (!d.isRestDay && !d.match?.hasMatch) return { ...d, isRestDay: true, match: { ...d.match, hasMatch: false } };
      if (d.isRestDay) return { ...d, isRestDay: false, match: { ...d.match, hasMatch: true } };
      if (d.match?.hasMatch) return { ...d, isRestDay: false, match: { ...d.match, hasMatch: false } };
      return d;
    }));
  }

  function handleAddFisicoField(index) {
    setDays(prev => prev.map((d, i) => i === index ? {
      ...d,
      grid: {
        ...d.grid,
        fisico: {
          ...d.grid.fisico,
          customFields: [...d.grid.fisico.customFields, { id: crypto.randomUUID(), label: '', value: '' }]
        }
      }
    } : d));
  }

  function handleRemoveFisicoField(index, fieldId) {
    setDays(prev => prev.map((d, i) => i === index ? {
      ...d,
      grid: {
        ...d.grid,
        fisico: {
          ...d.grid.fisico,
          customFields: d.grid.fisico.customFields.filter(f => f.id !== fieldId)
        }
      }
    } : d));
  }

  function handleUpdateFisicoCustom(index, fieldId, field) {
    setDays(prev => prev.map((d, i) => i === index ? {
      ...d,
      grid: {
        ...d.grid,
        fisico: {
          ...d.grid.fisico,
          customFields: d.grid.fisico.customFields.map(f => f.id === fieldId ? field : f)
        }
      }
    } : d));
  }

  async function handleLinkSession(dayIndex) {
    const day = days[dayIndex];
    if (!day) return;
    const id = crypto.randomUUID();
    const season = seasons.find(s => s.id === seasonId);
    await db.sessions.put({
      id,
      name: `${day.dayName} - ${name}`,
      date: day.date,
      seasonId,
      tasks: [],
      templateFields: { microciclo: name, teamName: '', porteros: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    handleUpdateDay(dayIndex, { sessionId: id });
    addToast(`Sesión creada para ${day.dayName}`, 'success');
    navigate(`/sessions/${id}`);
  }

  function handleViewSession(sessionId) {
    navigate(`/sessions/${sessionId}`);
  }

  async function handleDuplicate() {
    const newId = crypto.randomUUID();
    const start = new Date(dateStart);
    start.setDate(start.getDate() + 7);
    const end = new Date(dateEnd);
    end.setDate(end.getDate() + 7);
    const newStart = start.toISOString().split('T')[0];
    const newEnd = end.toISOString().split('T')[0];
    await db.microciclos.put({
      id: newId,
      name: name.trim(),
      seasonId,
      dateStart: newStart,
      dateEnd: newEnd,
      rival,
      days: generateDays(newStart, newEnd),
      proposito: '',
      tipologiaTareas: '',
      observacionesPre: '',
      observacionesPost: '',
      numSesiones: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    addToast('Microciclo duplicado para la próxima semana', 'success');
    navigate('/microciclos');
  }

  async function handleDelete() {
    if (!microciclo?.id) return;
    const ok = await confirm('¿Eliminar este microciclo? Podrás deshacerlo desde el panel de administración durante 7 días.', { title: 'Eliminar microciclo' });
    if (!ok) return;
    await db.microciclos.update(microciclo.id, { deletedAt: new Date(), updatedAt: new Date() });
    onDelete(microciclo.id);
  }

  async function handleClose() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const missing = [];
    if (!name.trim()) missing.push('Nombre');
    if (!seasonId) missing.push('Temporada');
    const hasMissing = missing.length > 0;
    if (hasMissing && confirm) {
      const html = `Hay campos obligatorios sin completar:<br/><br/>${missing.map(f => `<span style="color:#ef4444">- ${f}</span>`).join('<br/>')}<br/><br/>Si sales no se guardarán los cambios. ¿Salir?`;
      const ok = await confirm('', { title: 'Campos obligatorios', messageHtml: html });
      if (!ok) return;
    } else if (!hasMissing) {
      await autoSaveRef.current(true);
    }
    onClose();
  }

  const printRef = useRef(null);

  function handlePrintTrigger() {
    setShowPrint(true);
  }

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
        {/* Floating action buttons */}
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2">
          <button onClick={() => setShowPrint(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all" style={{ background: 'rgba(30,28,24,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(185,165,135,0.15)', color: '#baa587' }}>
            <Printer size={14} /> Imprimir
          </button>
          {microciclo?.id && (
            <>
              <button onClick={handleDuplicate} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all" style={{ background: 'rgba(30,28,24,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(185,165,135,0.15)', color: '#baa587' }}>
                <Copy size={14} /> Duplicar
              </button>
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all" style={{ background: 'rgba(224,74,74,0.15)', border: '1px solid rgba(224,74,74,0.25)', color: '#e04a4a' }}>
                <Trash2 size={14} /> Eliminar
              </button>
            </>
          )}
          <button onClick={handleClose} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all" style={{ background: 'rgba(30,28,24,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(185,165,135,0.15)', color: '#baa587' }}>
            <X size={14} /> Cerrar
          </button>
        </div>

        {/* Scrollable template area */}
        <div className="w-full h-full overflow-y-auto p-8" onClick={e => e.stopPropagation()}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <MicrocicloTemplate
              name={name}
              seasonName={seasons.find(s => s.id === seasonId)?.name || ''}
              rival={rival}
              days={days}
              dateStart={dateStart}
              dateEnd={dateEnd}
              proposito={proposito}
              tipologiaTareas={tipologiaTareas}
              observacionesPre={observacionesPre}
              observacionesPost={observacionesPost}
              teamName={teamName}
              teamCrest={teamCrest}
              secondaryImage={null}
              corporateColor={corporateColor}
              numSesiones={numSesiones}
              seasonId={seasonId}
              seasons={seasons}
              readOnly={false}
              onChangeName={setName}
              onChangeSeason={setSeasonId}
              onChangeRival={setRival}
               onDatesChange={handleDatesChange}
              onUpdateDay={handleUpdateDay}
              onUpdateDayGrid={handleUpdateDayGrid}
              onUpdateDayFisico={handleUpdateDayFisico}
              onUpdateDayMatch={handleUpdateDayMatch}
              onCycleDay={handleCycleDay}
              onAddFisicoField={handleAddFisicoField}
              onRemoveFisicoField={handleRemoveFisicoField}
               onUpdateFisicoCustom={handleUpdateFisicoCustom}
               onDropItem={handleDropItem}
              onChangeProposito={setProposito}
              onChangeTipologia={setTipologiaTareas}
              onChangePre={setObservacionesPre}
              onChangePost={setObservacionesPost}
              onLinkSession={handleLinkSession}
              onViewSession={handleViewSession}
            />
          </div>
        </div>
      </div>

      {/* Print portal with auto-scale */}
      {showPrint && createPortal(
        <PrintTemplateWrapper onClose={() => setShowPrint(false)}>
          <MicrocicloTemplate
            name={name}
            seasonName={seasons.find(s => s.id === seasonId)?.name || ''}
            rival={rival}
            days={days}
            dateStart={dateStart}
            dateEnd={dateEnd}
            proposito={proposito}
            tipologiaTareas={tipologiaTareas}
            observacionesPre={observacionesPre}
            observacionesPost={observacionesPost}
            teamName={teamName}
            teamCrest={teamCrest}
            secondaryImage={null}
            corporateColor={corporateColor}
            numSesiones={numSesiones}
            seasonId={seasonId}
            seasons={seasons}
            readOnly={true}
            onChangeName={() => {}}
            onChangeSeason={() => {}}
            onChangeRival={() => {}}
            onDatesChange={() => {}}
            onUpdateDay={() => {}}
            onUpdateDayGrid={() => {}}
            onUpdateDayFisico={() => {}}
            onUpdateDayMatch={() => {}}
            onCycleDay={() => {}}
            onAddFisicoField={() => {}}
            onRemoveFisicoField={() => {}}
               onUpdateFisicoCustom={() => {}}
               onDropItem={() => {}}
            onChangeProposito={() => {}}
            onChangeTipologia={() => {}}
            onChangePre={() => {}}
            onChangePost={() => {}}
            onLinkSession={() => {}}
            onViewSession={() => {}}
          />
        </PrintTemplateWrapper>,
        document.body
      )}
    </>
  );
}

function PrintTemplateWrapper({ children, onClose }) {
  const wrapperRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const styleId = 'mc-print-orientation';
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '@page { size: A4 portrait; margin: 6mm; }';
    document.head.appendChild(style);

    function cleanupStyle() {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    }

    function finishPrint() {
      cleanupStyle();
      onCloseRef.current?.();
    }

    const timer = setTimeout(() => {
      if (wrapperRef.current) {
        const el = wrapperRef.current;
        const w = el.scrollWidth;
        const h = el.scrollHeight;
        const pageW = 740;
        const pageH = 1030;
        const scale = Math.min(pageW / w, pageH / h, 1.0);
        if (scale < 1.0) {
          el.style.transform = `scale(${scale})`;
          el.style.transformOrigin = 'top center';
        }
      }
      window.print();
    }, 300);

    window.addEventListener('afterprint', finishPrint);
    return () => { clearTimeout(timer); cleanupStyle(); window.removeEventListener('afterprint', finishPrint); };
  }, []);

  return (
    <div className="microciclo-print-wrapper fixed inset-0" style={{ background: 'white', zIndex: 9999, overflow: 'auto' }}>
      <button
        type="button"
        className="no-print"
        onClick={() => onCloseRef.current?.()}
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 2, padding: '8px 12px', borderRadius: 8, border: '1px solid #bbb', background: '#fff', color: '#333', cursor: 'pointer' }}
      >
        Cerrar impresión
      </button>
      <div style={{ padding: '6mm', display: 'flex', justifyContent: 'center' }}>
        <div ref={wrapperRef} style={{ width: '100%', maxWidth: 740 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Microciclo() {
  const [seasons, setSeasons] = useState([]);
  const [microciclos, setMicrociclos] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [editing, setEditing] = useState(null);
  const [newRange, setNewRange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { addToast } = useToast();
  const confirm = useConfirm();
  const { refreshKey } = useSyncRefresh();

  useEffect(() => {
    loadSeasons();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    if (selectedSeason) loadMicrociclos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason, refreshKey]);

  async function loadSeasons() {
    const all = await db.seasons.toArray();
    const active = all.filter(s => !s.deletedAt);
    setSeasons(active);
    if (active.length > 0 && !selectedSeason) {
      setSelectedSeason(active[active.length - 1]);
    }
    setLoading(false);
  }

  async function loadMicrociclos() {
    if (!selectedSeason) return;
    const all = await db.microciclos.toArray();
    const filtered = all.filter(m => m.seasonId === selectedSeason.id && !m.deletedAt);
    setMicrociclos(filtered.sort((a, b) => new Date(b.dateStart || 0) - new Date(a.dateStart || 0)));
  }

  function openNew() {
    setNewRange(true);
  }

  function handleNewRange(range) {
    setNewRange(null);
    setEditing(range);
  }

  function openEdit(microciclo) {
    setEditing(microciclo);
  }

  function handleSave(saved) {
    loadMicrociclos();
  }

  function handleDelete() {
    loadMicrociclos();
    setEditing(null);
  }

  const filtered = microciclos.filter(m => {
    if (!search) return true;
    const s = search.toLowerCase();
    return m.name?.toLowerCase().includes(s) || m.rival?.toLowerCase().includes(s);
  });

  return (
    <div className="animate-v2-fade-in-up -mx-4 -my-6 px-4 py-6 min-h-[calc(100vh-4rem)]" style={{ backgroundColor: '#0c0b09' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#f1ede7' }}>Microciclos</h1>
          <button onClick={openNew} className="v2-btn-ghost" style={{ background: 'rgba(232,172,101,0.08)', borderColor: 'rgba(232,172,101,0.15)', color: '#e8ac65' }}>
            <Plus size={16} /> Nuevo Microciclo
          </button>
        </div>

        {/* Season tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {seasons.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSeason(s)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all"
              style={{
                background: selectedSeason?.id === s.id ? 'rgba(232,172,101,0.08)' : 'rgba(22,20,16,0.6)',
                borderColor: selectedSeason?.id === s.id ? 'rgba(232,172,101,0.20)' : 'rgba(185,165,135,0.08)',
                color: selectedSeason?.id === s.id ? '#e8ac65' : '#997b66',
              }}
            >
              <FolderOpen size={16} />
              {s.name}
            </button>
          ))}
        </div>

        {selectedSeason && (
          <>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: '#997b66' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar microciclo..." className="v2-input w-full" style={{ paddingLeft: 40, background: 'rgba(30, 28, 24, 0.55)', border: 'none' }} />
            </div>

            {/* List */}
            <div className="space-y-2">
              {loading && <div className="text-center py-8" style={{ color: '#997b66' }}>Cargando...</div>}
              {filtered.map(m => {
                const activeDays = (m.days || []).filter(d => !d.isRestDay);
                const matchDays = (m.days || []).filter(d => d.match?.hasMatch);
                return (
                  <div
                    key={m.id}
                    onClick={() => openEdit(m)}
                    className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all group"
                    style={{ background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: '#f1ede7' }}>{m.name}</div>
                      <div className="text-xs mt-1" style={{ color: '#997b66' }}>
                        {m.dateStart && m.dateEnd ? `${formatDateDDMMYY(m.dateStart)} - ${formatDateDDMMYY(m.dateEnd)}` : ''}
                        {m.numSesiones > 0 ? ` • ${m.numSesiones} sesiones` : ''}
                        {m.days ? ` • ${m.days.length} días` : ''}
                        {m.rival ? ` • vs ${m.rival}` : ''}
                        {matchDays.length > 0 ? ` • ${matchDays.length} partido(s)` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      {matchDays.length > 0 && <span style={{ color: '#e8ac65' }}>🏠</span>}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#997b66" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && !loading && (
                <div className="text-center py-12" style={{ color: '#997b66' }}>
                  <p className="text-lg mb-2">No hay microciclos en esta temporada</p>
                  <p className="text-sm">Crea un nuevo microciclo para empezar</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Editor modal */}
      {newRange && (
        <NewMicrocicloRangeModal
          onConfirm={handleNewRange}
          onClose={() => setNewRange(null)}
        />
      )}
      {editing && (
        <MicrocicloEditor
          microciclo={editing}
          seasons={seasons}
          onSave={handleSave}
          onClose={() => {
            loadMicrociclos();
            setEditing(null);
          }}
          onDelete={handleDelete}
          confirm={confirm}
          addToast={addToast}
        />
      )}
    </div>
  );
}
