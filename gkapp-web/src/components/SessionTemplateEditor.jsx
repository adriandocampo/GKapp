import { useState, useRef, useEffect } from 'react';
import { X, Printer, Save, Eye, BookOpen, Target, Eye as EyeIcon } from 'lucide-react';
import { getSetting } from '../db';

function extractSessionNumber(name) {
  if (!name) return '';
  const match = name.match(/(\d+)/);
  return match ? match[1] : '';
}

function formatDateDDMMYY(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

const defaultTemplateFields = {
  temporada: '2025-26',
  fecha: '',
  microciclo: '',
  instalacion: '',
  hora: '',
  tiempoSesion: '',
  sesionNumero: '',
  equipo: {
    chinosBajos: '',
    chinos: '',
    picas: '',
    picasClavar: '',
    hinchable: '',
    muñeco: '',
    rebounder: '',
    escalera: '',
    aros: '',
    fitball: '',
    miniPT: '',
  },
  contenidos: ['', '', '', ''],
  objetivos: ['', '', '', ''],
  focos: ['', ''],
  notasGenerales: '',
};

export default function SessionTemplateEditor({ session, sessionTasks, taskImageUrls, porteros, seasons, contenidos: contenidosProp, objetivos: objetivosProp, focos: focosProp, onSave, onClose }) {
  const normalizePorteros = (p) =>
    p.map(x => ({ ...x, active: x.active === false ? false : true }));

  const [fields, setFields] = useState(() => {
    const saved = session?.templateFields;
    const sessionSeason = seasons?.find(s => s.id === session?.seasonId);
    const seasonName = sessionSeason?.name || '2025-26';
    const today = formatDateDDMMYY(session?.date || new Date().toISOString().split('T')[0]);
    const sessionNum = extractSessionNumber(session?.name);
    if (saved) {
      return { ...defaultTemplateFields, temporada: seasonName, fecha: today, ...saved };
    }
    return { ...defaultTemplateFields, temporada: seasonName, fecha: today, sesionNumero: sessionNum };
  });
  const [showPreview, setShowPreview] = useState(false);
  const [teamName, setTeamName] = useState('Club Deportivo Lugo');
  const [teamCrest, setTeamCrest] = useState(null);
  const [secondaryImage, setSecondaryImage] = useState(null);
  const [activePorteros, setActivePorteros] = useState(() => normalizePorteros(porteros || []));
  const printRef = useRef(null);

  useEffect(() => {
    getSetting('teamName').then(n => { if (n) setTeamName(n); });
    getSetting('teamCrest').then(c => { if (c) setTeamCrest(c); });
    getSetting('secondaryImage').then(s => { if (s) setSecondaryImage(s); });
  }, []);

  useEffect(() => {
    if (porteros && porteros.length > 0) {
      setActivePorteros(normalizePorteros(porteros));
    } else {
      getSetting('defaultPorteros').then(p => {
        if (p && p.length > 0) setActivePorteros(normalizePorteros(p));
      });
    }
  }, [porteros]);

  useEffect(() => {
    if (contenidosProp && contenidosProp.length > 0) {
      setFields(prev => ({ ...prev, contenidos: contenidosProp }));
    }
  }, [contenidosProp]);

  useEffect(() => {
    if (objetivosProp && objetivosProp.length > 0) {
      setFields(prev => ({ ...prev, objetivos: objetivosProp }));
    }
  }, [objetivosProp]);

  useEffect(() => {
    if (focosProp && focosProp.length > 0) {
      setFields(prev => ({ ...prev, focos: focosProp }));
    }
  }, [focosProp]);

  function updateField(path, value) {
    setFields(prev => {
      const keys = path.split('.');
      const updated = { ...prev };
      let current = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  }

  function updateArrayItem(path, index, value) {
    setFields(prev => {
      const keys = path.split('.');
      const updated = { ...prev };
      let current = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      const arr = [...(current[keys[keys.length - 1]] || [])];
      arr[index] = value;
      current[keys[keys.length - 1]] = arr;
      return updated;
    });
  }

  function handleSave() {
    onSave(fields);
  }

  function handlePrint() {
    setShowPreview(true);
    setTimeout(() => window.print(), 100);
  }

  const porteroClass = (active) =>
    active === false
      ? 'bg-gradient-to-b from-gray-300 to-gray-400 text-gray-600 font-bold'
      : 'bg-gradient-to-b from-green-500 to-green-600 text-white font-bold shadow-sm';

  const inputClass =
    'text-sm font-bold text-red-600 text-center bg-transparent border-b-2 border-gray-200 focus:border-red-500 outline-none w-full py-0.5 transition-colors';
  const labelClass = 'text-[9px] font-semibold text-gray-400 uppercase tracking-wider text-center block';

  const lineInputClass =
    'w-full text-[11px] text-gray-700 border-b border-dotted border-gray-300 py-1.5 bg-transparent outline-none focus:border-red-400 placeholder-gray-300 transition-colors';

  const half = Math.ceil(activePorteros.length / 2);
  const row1 = activePorteros.slice(0, half);
  const row2 = activePorteros.slice(half);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 print:p-0 print:bg-white print:fixed print:inset-0 print:z-auto template-print-target">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full h-full flex flex-col print:bg-white print:border-0 print:rounded-none print:h-auto print:w-auto">
        {/* Header - hidden when printing */}
        <div className="p-3 border-b border-slate-700 flex items-center justify-between shrink-0 print:hidden">
          <h2 className="text-lg font-bold text-slate-100">Editar Plantilla de Sesión</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm flex items-center gap-1.5 transition-colors"
            >
              <Eye size={14} /> {showPreview ? 'Editar' : 'Vista previa'}
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm flex items-center gap-1.5 transition-colors"
            >
              <Printer size={14} /> Imprimir / PDF
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-white text-sm flex items-center gap-1.5 transition-colors"
            >
              <Save size={14} /> Guardar
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded text-slate-400">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Template Content */}
        <div ref={printRef} className="flex-1 overflow-auto p-2 print:p-0 print:overflow-visible">
          <div
            className="bg-white mx-auto shadow-2xl print:shadow-none print:mx-0"
            style={{ width: '100%', maxWidth: '1100px', aspectRatio: '841/595' }}
          >
            <div className="flex flex-col h-full border-2 border-red-600">
              {/* Top Header Bar */}
              <div className="flex border-b-2 border-red-600 shrink-0" style={{ minHeight: '60px' }}>
                {/* Logo area */}
                <div
                  className="flex items-center gap-2 px-3 border-r-2 border-red-600 bg-gradient-to-b from-white to-gray-50"
                  style={{ width: '25%', minWidth: '180px' }}
                >
                  <div className="w-12 h-12 flex items-center justify-center shrink-0">
                    {teamCrest ? (
                      <img src={teamCrest} alt={teamName} className="w-full h-full object-contain drop-shadow-sm" />
                    ) : (
                      <img src={`${import.meta.env.BASE_URL}images/lugo_badge.webp`} alt="CD Lugo" className="w-full h-full object-contain drop-shadow-sm" />
                    )}
                  </div>
                  <span className="text-red-600 font-extrabold text-base whitespace-nowrap tracking-tight">{teamName}</span>
                </div>

                {/* Info fields container */}
                <div className="flex flex-1" style={{ minWidth: 0 }}>
                  {/* Temporada */}
                  <div className="flex flex-col justify-center items-center px-2 py-1.5 border-r border-red-600 flex-1 bg-gradient-to-b from-white to-gray-50" style={{ minWidth: 0 }}>
                    <span className={labelClass}>Temporada</span>
                    {seasons && seasons.length > 1 ? (
                      <select value={fields.temporada} onChange={e => updateField('temporada', e.target.value)} className={`${inputClass} cursor-pointer`} disabled={showPreview}>
                        {seasons.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        {!seasons.find(s => s.name === fields.temporada) && <option value={fields.temporada}>{fields.temporada}</option>}
                      </select>
                    ) : (
                      <input type="text" value={fields.temporada} onChange={e => updateField('temporada', e.target.value)} className={inputClass} readOnly={showPreview} />
                    )}
                  </div>
                  {/* Fecha + Microciclo */}
                  <div className="flex flex-col justify-center items-center px-2 py-1.5 border-r border-red-600 flex-1 bg-gradient-to-b from-white to-gray-50" style={{ minWidth: 0 }}>
                    <span className={labelClass}>Fecha</span>
                    <input type="text" value={fields.fecha} onChange={e => updateField('fecha', e.target.value)} placeholder="DD/MM/YY" maxLength={8} className="text-sm font-bold text-red-600 text-center bg-transparent outline-none w-full" readOnly={showPreview} />
                    <span className={`${labelClass} mt-0.5`}>Microciclo</span>
                    <input type="text" value={fields.microciclo} onChange={e => updateField('microciclo', e.target.value)} className="text-sm font-bold text-red-600 text-center bg-transparent outline-none w-full" readOnly={showPreview} />
                  </div>
                  {/* Instalación + Hora */}
                  <div className="flex flex-col justify-center items-center px-2 py-1.5 border-r border-red-600 flex-1 bg-gradient-to-b from-white to-gray-50" style={{ minWidth: 0 }}>
                    <span className={labelClass}>Instalación</span>
                    <input type="text" value={fields.instalacion} onChange={e => updateField('instalacion', e.target.value)} className={inputClass} readOnly={showPreview} />
                    <span className={`${labelClass} mt-0.5`}>Hora</span>
                    <input type="text" value={fields.hora} onChange={e => updateField('hora', e.target.value)} placeholder="HH:MM" className="text-sm font-bold text-red-600 text-center bg-transparent outline-none w-full" readOnly={showPreview} />
                  </div>
                  {/* Tiempo sesión PT */}
                  <div className="flex flex-col justify-center items-center px-2 py-1.5 flex-1 bg-gradient-to-b from-white to-gray-50" style={{ minWidth: 0 }}>
                    <span className={labelClass}>Tiempo sesión PT</span>
                    <input type="text" value={fields.tiempoSesion} onChange={e => updateField('tiempoSesion', e.target.value)} className={inputClass} readOnly={showPreview} />
                  </div>
                </div>

                {/* Porteros */}
                <div className="flex border-l-2 border-red-600" style={{ width: '25%', minWidth: '180px' }}>
                  <div className="px-1.5 py-1 flex items-center justify-center border-r border-red-600 bg-gradient-to-b from-gray-100 to-gray-200">
                    <span className="text-[9px] font-bold text-gray-500" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '0.1em' }}>PORTEROS</span>
                  </div>
                  <div className="flex flex-1">
                    {/* Porteros grid - fills all available space */}
                    <div className="flex-1 grid gap-0 divide-x divide-red-600" style={{ gridTemplateColumns: `repeat(${Math.max(row1.length, row2.length) || 1}, 1fr)`, gridTemplateRows: row2.length > 0 ? '1fr 1fr' : '1fr' }}>
                      {row1.map((p, i) => (
                        <div key={`r1-${i}`} className="flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
                          <div className={`text-[10px] px-2 py-1 rounded-sm shadow-sm ${porteroClass(p.active)}`}>{p.name}</div>
                        </div>
                      ))}
                      {row2.map((p, i) => (
                        <div key={`r2-${i}`} className="flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
                          <div className={`text-[10px] px-2 py-1 rounded-sm shadow-sm ${porteroClass(p.active)}`}>{p.name}</div>
                        </div>
                      ))}
                      {/* Fill empty cells if row2 has fewer items */}
                      {row2.length > 0 && row2.length < row1.length && Array.from({ length: row1.length - row2.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="bg-gradient-to-b from-white to-gray-50" />
                      ))}
                    </div>
                    {/* SESIÓN block */}
                    <div className="w-16 flex flex-col items-center justify-center border-l border-red-600 bg-gradient-to-b from-gray-100 to-gray-200">
                      <div className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-300 text-gray-700 rounded-sm shadow-sm">SESIÓN</div>
                      <input type="text" value={fields.sesionNumero} onChange={e => updateField('sesionNumero', e.target.value)} className="text-base font-extrabold text-red-600 text-center bg-transparent outline-none w-full" readOnly={showPreview} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipment Bar */}
              <div className="grid grid-cols-11 divide-x divide-red-600 border-b-2 border-red-600 bg-gradient-to-b from-gray-50 to-gray-100 shrink-0">
                {[
                  { key: 'chinosBajos', label: 'Chinos bajos' },
                  { key: 'chinos', label: 'Chinos' },
                  { key: 'picas', label: 'Picas' },
                  { key: 'picasClavar', label: 'Picas clavar' },
                  { key: 'hinchable', label: 'Hinchable' },
                  { key: 'muñeco', label: 'Muñeco' },
                  { key: 'rebounder', label: 'Rebounder' },
                  { key: 'escalera', label: 'Escalera' },
                  { key: 'aros', label: 'Aros' },
                  { key: 'fitball', label: 'Fitball' },
                  { key: 'miniPT', label: 'Mini PT' },
                ].map(item => (
                  <div key={item.key} className="px-1 py-1 flex flex-col justify-center items-center">
                    <span className="text-[8px] font-semibold text-gray-500 whitespace-nowrap leading-tight uppercase tracking-wide">{item.label}</span>
                    <input type="text" value={fields.equipo[item.key]} onChange={e => updateField(`equipo.${item.key}`, e.target.value)} className="text-xs font-bold text-red-600 text-center bg-transparent border-b border-gray-300 focus:border-red-500 outline-none w-full py-0.5" readOnly={showPreview} />
                  </div>
                ))}
              </div>

              {/* Main Content Area */}
              <div className="flex flex-1 min-h-0">
                {/* Left: Task images area */}
                <div className="flex-1 p-1 overflow-y-auto border-r border-red-600 bg-white">
                  {sessionTasks.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-300 text-sm">
                      <div className="text-center">
                        <p className="text-gray-400 mb-1">Añade tareas a la sesión</p>
                        <p className="text-xs text-gray-300">para verlas aquí</p>
                      </div>
                    </div>
                  ) : (
                    <div className={`grid gap-1 ${sessionTasks.length === 1 ? 'grid-cols-1' : sessionTasks.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {sessionTasks.map((task) => (
                        <div key={task.id} className="overflow-hidden bg-white">
                          {taskImageUrls[task.id] && (
                            <div className="flex items-center justify-center bg-white w-full h-full" style={{ minHeight: '140px' }}>
                              <img src={taskImageUrls[task.id]} alt={task.title} className="w-full h-full object-contain" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Sidebar with CONTENIDOS, OBJETIVOS, FOCOS */}
                <div className="w-52 flex flex-col divide-y divide-red-600 bg-white shrink-0">
                  {/* CONTENIDOS */}
                  <div className="p-2">
                    <div className="flex items-center justify-center gap-1.5 text-center text-[10px] font-bold text-gray-600 py-1.5 mb-1.5 rounded-sm bg-gradient-to-b from-gray-100 to-gray-50 border border-gray-200 shadow-sm uppercase tracking-wide">
                      <BookOpen size={12} className="text-gray-500 shrink-0" />
                      <span>CONTENIDOS</span>
                    </div>
                    {fields.contenidos.map((line, i) => (
                      showPreview ? (
                        <div key={i} className="w-full text-[11px] text-gray-700 border-b border-dotted border-gray-300 py-1.5 leading-tight break-words">{line}</div>
                      ) : (
                        <input key={i} type="text" value={line} onChange={e => updateArrayItem('contenidos', i, e.target.value)} className={lineInputClass} placeholder="..." />
                      )
                    ))}
                  </div>

                  {/* OBJETIVOS */}
                  <div className="p-2">
                    <div className="flex items-center justify-center gap-1.5 text-center text-[10px] font-bold text-gray-600 py-1.5 mb-1.5 rounded-sm bg-gradient-to-b from-gray-100 to-gray-50 border border-gray-200 shadow-sm uppercase tracking-wide">
                      <Target size={12} className="text-gray-500 shrink-0" />
                      <span>OBJETIVOS</span>
                    </div>
                    {fields.objetivos.map((line, i) => (
                      showPreview ? (
                        <div key={i} className="w-full text-[11px] text-gray-700 border-b border-dotted border-gray-300 py-1.5 leading-tight break-words">{line}</div>
                      ) : (
                        <input key={i} type="text" value={line} onChange={e => updateArrayItem('objetivos', i, e.target.value)} className={lineInputClass} placeholder="..." />
                      )
                    ))}
                  </div>

                  {/* FOCOS */}
                  <div className="p-2 flex-1 flex flex-col">
                    <div className="flex items-center justify-center gap-1.5 text-center text-[10px] font-bold text-gray-600 py-1.5 mb-1.5 rounded-sm bg-gradient-to-b from-gray-100 to-gray-50 border border-gray-200 shadow-sm uppercase tracking-wide">
                      <EyeIcon size={12} className="text-gray-500 shrink-0" />
                      <span>FOCOS</span>
                    </div>
                    <div className="flex-1 flex flex-col">
                      {fields.focos.map((line, i) => (
                        showPreview ? (
                          <div key={i} className="w-full text-[11px] text-gray-700 border-b border-dotted border-gray-300 py-1.5 leading-tight break-words">{line}</div>
                        ) : (
                          <input key={i} type="text" value={line} onChange={e => updateArrayItem('focos', i, e.target.value)} className={lineInputClass} placeholder="..." />
                        )
                      ))}
                    </div>
                  </div>

                  {/* Logo footer */}
                  <div className="flex justify-end items-end p-0">
                    {secondaryImage ? (
                      <img src={secondaryImage} alt="Imagen secundaria" className="w-32 h-auto object-contain" />
                    ) : (
                      <img src={`${import.meta.env.BASE_URL}images/espirito_loitador.webp`} alt="Espíritu Loitador" className="w-32 h-auto object-contain" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
