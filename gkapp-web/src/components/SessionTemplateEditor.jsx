import { useState, useRef } from 'react';
import { X, Printer, Save, Eye } from 'lucide-react';

function extractSessionNumber(name) {
  if (!name) return '';
  const match = name.match(/(\d+)/);
  return match ? match[1] : '';
}

const defaultTemplateFields = {
  temporada: '2025-26',
  fecha: '',
  microciclo: '',
  instalacion: '',
  hora: '',
  tiempoSesion: '',
  sesionNumero: '',
  porteros: { marc: false, iker: false, candal: false },
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

export default function SessionTemplateEditor({ session, sessionTasks, taskImageUrls, onSave, onClose }) {
  const [fields, setFields] = useState(() => {
    const saved = session?.templateFields;
    if (saved) {
      return { ...defaultTemplateFields, ...saved };
    }
    const today = new Date().toISOString().split('T')[0];
    const sessionNum = extractSessionNumber(session?.name);
    return { ...defaultTemplateFields, fecha: session?.date || today, sesionNumero: sessionNum };
  });
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef(null);

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
    window.print();
  }

  const porteroClass = (active) =>
    active ? 'bg-green-500 text-white font-bold' : 'bg-gray-400 text-gray-200 font-bold';

  const inputClass = "text-sm font-bold text-red-600 text-center bg-transparent border-b-2 border-slate-300 focus:border-red-500 outline-none w-full py-0.5";
  const labelClass = "text-[10px] font-semibold text-slate-500 uppercase tracking-wide text-center block";

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
          <div className="bg-white mx-auto shadow-xl print:shadow-none print:mx-0" style={{ width: '100%', maxWidth: '1100px', aspectRatio: '841/595' }}>
            <div className="flex flex-col h-full border-4 border-red-600">
              {/* Top Header Bar */}
              <div className="flex border-b-4 border-red-600 shrink-0" style={{ minHeight: '60px' }}>
                {/* Logo area - ~25% */}
                <div className="flex items-center gap-2 px-3 border-r-4 border-red-600 bg-white" style={{ width: '25%', minWidth: '180px' }}>
                  <div className="w-12 h-12 flex items-center justify-center shrink-0">
                    <img src="/images/lugo_badge.png" alt="CD Lugo" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-red-600 font-extrabold text-base whitespace-nowrap">Club Deportivo Lugo</span>
                </div>

                {/* Info fields container - ~50% */}
                <div className="flex flex-1 border-4 border-red-600" style={{ minWidth: 0 }}>
                  {/* Temporada */}
                  <div className="flex flex-col justify-center items-center px-2 py-1.5 border-r-2 border-red-600 flex-1" style={{ minWidth: 0 }}>
                    <span className={labelClass}>Temporada</span>
                    <input
                      type="text"
                      value={fields.temporada}
                      onChange={e => updateField('temporada', e.target.value)}
                      className={inputClass}
                      readOnly={showPreview}
                    />
                  </div>
                  {/* Fecha + Microciclo */}
                  <div className="flex flex-col justify-center items-center px-2 py-1.5 border-r-2 border-red-600 flex-1" style={{ minWidth: 0 }}>
                    <span className={labelClass}>Fecha</span>
                    <input
                      type="text"
                      value={fields.fecha}
                      onChange={e => updateField('fecha', e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="text-sm font-bold text-red-600 text-center bg-transparent outline-none w-full"
                      readOnly={showPreview}
                    />
                    <span className={`${labelClass} mt-0.5`}>Microciclo</span>
                    <input
                      type="text"
                      value={fields.microciclo}
                      onChange={e => updateField('microciclo', e.target.value)}
                      className="text-sm font-bold text-red-600 text-center bg-transparent outline-none w-full"
                      readOnly={showPreview}
                    />
                  </div>
                  {/* Instalación + Hora */}
                  <div className="flex flex-col justify-center items-center px-2 py-1.5 border-r-2 border-red-600 flex-1" style={{ minWidth: 0 }}>
                    <span className={labelClass}>Instalación</span>
                    <input
                      type="text"
                      value={fields.instalacion}
                      onChange={e => updateField('instalacion', e.target.value)}
                      className={inputClass}
                      readOnly={showPreview}
                    />
                    <span className={`${labelClass} mt-0.5`}>Hora</span>
                    <input
                      type="text"
                      value={fields.hora}
                      onChange={e => updateField('hora', e.target.value)}
                      placeholder="HH:MM"
                      className="text-sm font-bold text-red-600 text-center bg-transparent outline-none w-full"
                      readOnly={showPreview}
                    />
                  </div>
                  {/* Tiempo sesión PT */}
                  <div className="flex flex-col justify-center items-center px-2 py-1.5 flex-1" style={{ minWidth: 0 }}>
                    <span className={labelClass}>Tiempo sesión PT</span>
                    <input
                      type="text"
                      value={fields.tiempoSesion}
                      onChange={e => updateField('tiempoSesion', e.target.value)}
                      className={inputClass}
                      readOnly={showPreview}
                    />
                  </div>
                </div>

                {/* Porteros - ~25% */}
                <div className="flex border-l-4 border-red-600" style={{ width: '25%', minWidth: '180px' }}>
                  <div className="px-1.5 py-1 flex items-center justify-center border-r-4 border-red-600 bg-slate-50">
                    <span className="text-[10px] font-bold text-slate-600" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>PORTEROS</span>
                  </div>
                  <div className="grid grid-cols-4 divide-x-2 divide-red-600 flex-1">
                    {[
                      { key: 'marc', label: 'MARC' },
                      { key: 'iker', label: 'IKER' },
                      { key: 'candal', label: 'CANDAL' },
                    ].map(p => (
                      <div key={p.key} className="px-1 py-1 flex flex-col items-center justify-center">
                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${porteroClass(fields.porteros[p.key])}`}>{p.label}</div>
                        {!showPreview && (
                          <input type="checkbox" checked={fields.porteros[p.key]} onChange={e => updateField(`porteros.${p.key}`, e.target.checked)} className="mt-0.5 w-3 h-3" />
                        )}
                      </div>
                    ))}
                    <div className="px-1 py-1 flex flex-col items-center justify-center bg-slate-100">
                      <div className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-300 text-slate-700 rounded">SESIÓN</div>
                      <input
                        type="text"
                        value={fields.sesionNumero}
                        onChange={e => updateField('sesionNumero', e.target.value)}
                        className="text-base font-extrabold text-red-600 text-center bg-transparent outline-none w-full"
                        readOnly={showPreview}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipment Bar */}
              <div className="grid grid-cols-11 divide-x-2 divide-red-600 border-b-4 border-red-600 bg-slate-50 shrink-0">
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
                    <span className="text-[9px] font-semibold text-slate-500 whitespace-nowrap leading-tight">{item.label}</span>
                    <input
                      type="text"
                      value={fields.equipo[item.key]}
                      onChange={e => updateField(`equipo.${item.key}`, e.target.value)}
                      className="text-xs font-bold text-red-600 text-center bg-transparent border-b border-slate-300 focus:border-red-500 outline-none w-full py-0.5"
                      readOnly={showPreview}
                    />
                  </div>
                ))}
              </div>

              {/* Main Content Area */}
              <div className="flex flex-1 min-h-0">
                {/* Left: Task images area */}
                <div className="flex-1 p-2 overflow-y-auto border-r-4 border-red-600 bg-white">
                  {sessionTasks.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      Añade tareas a la sesión para verlas aquí
                    </div>
                  ) : (
                    <div className={`grid gap-2 ${sessionTasks.length === 1 ? 'grid-cols-1' : sessionTasks.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {sessionTasks.map((task) => (
                        <div key={task.id} className="border-2 border-red-600 rounded overflow-hidden bg-white">
                          {taskImageUrls[task.id] && (
                            <div className="flex items-center justify-center bg-white" style={{ minHeight: '140px' }}>
                              <img src={taskImageUrls[task.id]} alt={task.title} className="w-full h-full object-contain" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Sidebar with CONTENIDOS, OBJETIVOS, FOCOS */}
                <div className="w-52 flex flex-col divide-y-4 divide-red-600 bg-white shrink-0">
                  {/* CONTENIDOS */}
                  <div className="p-2">
                    <div className="bg-slate-200 text-center text-xs font-bold text-slate-700 py-1.5 mb-2 rounded border border-slate-300">CONTENIDOS</div>
                    {fields.contenidos.map((line, i) => (
                      <input
                        key={i}
                        type="text"
                        value={line}
                        onChange={e => updateArrayItem('contenidos', i, e.target.value)}
                        className="w-full text-xs text-slate-700 border-b border-dotted border-slate-400 py-1 bg-transparent outline-none focus:border-red-500 placeholder-slate-300"
                        placeholder="..."
                        readOnly={showPreview}
                      />
                    ))}
                  </div>

                  {/* OBJETIVOS */}
                  <div className="p-2">
                    <div className="bg-slate-200 text-center text-xs font-bold text-slate-700 py-1.5 mb-2 rounded border border-slate-300">OBJETIVOS</div>
                    {fields.objetivos.map((line, i) => (
                      <input
                        key={i}
                        type="text"
                        value={line}
                        onChange={e => updateArrayItem('objetivos', i, e.target.value)}
                        className="w-full text-xs text-slate-700 border-b border-dotted border-slate-400 py-1 bg-transparent outline-none focus:border-red-500 placeholder-slate-300"
                        placeholder="..."
                        readOnly={showPreview}
                      />
                    ))}
                  </div>

                  {/* FOCOS */}
                  <div className="p-2 flex-1 flex flex-col">
                    <div className="bg-slate-200 text-center text-xs font-bold text-slate-700 py-1.5 mb-2 rounded border border-slate-300">FOCOS</div>
                    <div className="flex-1 flex flex-col">
                      {fields.focos.map((line, i) => (
                        <input
                          key={i}
                          type="text"
                          value={line}
                          onChange={e => updateArrayItem('focos', i, e.target.value)}
                          className="w-full text-xs text-slate-700 border-b border-dotted border-slate-400 py-1 bg-transparent outline-none focus:border-red-500 placeholder-slate-300"
                          placeholder="..."
                          readOnly={showPreview}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Logo footer */}
                  <div className="p-2 flex justify-end items-end">
                    <div className="text-[10px] text-slate-400 font-bold italic" style={{ transform: 'rotate(-5deg)' }}>
                      ESPÍRITU<br />LOITADOR
                    </div>
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
