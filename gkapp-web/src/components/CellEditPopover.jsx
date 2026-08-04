import { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { MICROCICLO_DIMENSIONS, FISICO_TIPOS } from '../data/microcicloItems';

function DimensionContent({ value, onChange, onClose }) {
  const selected = Array.isArray(value) ? value : (value ? [value] : []);

  function toggle(dimension) {
    onChange(selected.includes(dimension)
      ? selected.filter(item => item !== dimension)
      : [...selected, dimension]);
  }

  return (
    <div className="p-2 space-y-1 w-56">
      {MICROCICLO_DIMENSIONS.map(d => (
        <button key={d.id} onClick={() => toggle(d.name)} className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm font-medium transition-all" style={{ background: selected.includes(d.name) ? 'rgba(34,197,94,0.20)' : 'rgba(34,197,94,0.06)', border: selected.includes(d.name) ? '2px solid #22c55e' : '2px solid transparent', color: '#22c55e' }}>
          <span className="w-4 h-4 rounded border flex items-center justify-center text-[9px]" style={{ borderColor: '#22c55e', background: selected.includes(d.name) ? '#22c55e' : 'transparent', color: '#fff' }}>{selected.includes(d.name) ? '✓' : ''}</span>
          {d.name}
        </button>
      ))}
      {selected.length > 0 && <button onClick={() => { onChange([]); onClose(); }} className="w-full text-left px-3 py-1.5 text-xs" style={{ color: '#997b66' }}>Quitar todas</button>}
      {selected.length > 0 && <button onClick={onClose} className="w-full text-left px-3 py-1.5 text-xs" style={{ color: '#997b66' }}>Aceptar</button>}
    </div>
  );
}

function MultiSelectContent({ items, selected, onChange, placeholder, color = '#22c55e' }) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  function toggle(item) {
    if (selected.includes(item)) {
      onChange(selected.filter(s => s !== item));
    } else {
      onChange([...selected, item]);
    }
  }

  function addCustom() {
    const val = custom.trim();
    if (val && !selected.includes(val)) {
      onChange([...selected, val]);
    }
    setCustom('');
    setShowCustom(false);
  }

  return (
    <div className="p-2 w-64">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.map(s => (
          <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${color}20`, color }}>{s}<button onClick={() => toggle(s)} className="hover:opacity-70"><X size={10} /></button></span>
        ))}
      </div>
      {items.length === 0 && !showCustom && <div className="text-xs py-1" style={{ color: '#997b66' }}>{placeholder ? `No hay ${placeholder.toLowerCase()}` : 'Sin opciones'}</div>}
      <div className="max-h-40 overflow-y-auto space-y-0.5">
        {items.map(item => (
          <button key={item} onClick={() => toggle(item)} className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-xs hover:opacity-80" style={{ color }}>
            <span className={`w-4 h-4 rounded border flex items-center justify-center text-[9px] font-bold ${selected.includes(item) ? 'text-white' : 'text-transparent'}`} style={{ borderColor: color, background: selected.includes(item) ? color : 'transparent' }}>✓</span>
            {item}
          </button>
        ))}
      </div>
      {!showCustom ? (
        <button onClick={() => setShowCustom(true)} className="flex items-center gap-1 w-full text-left px-2 py-1.5 rounded text-xs mt-1 border-t" style={{ color: '#baa587', borderColor: 'rgba(185,165,135,0.15)' }}><Plus size={10} /> Personalizado</button>
      ) : (
        <div className="flex gap-1 mt-1">
          <input autoFocus value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCustom(); }} placeholder="Nombre..." className="flex-1 px-2 py-1 rounded text-xs" style={{ background: 'rgba(22,20,16,0.06)', border: '1px solid rgba(0,0,0,0.10)', color: '#333' }} />
          <button onClick={addCustom} className="px-2 py-1 rounded text-xs font-medium" style={{ background: `${color}15`, color }}>+</button>
        </div>
      )}
    </div>
  );
}

function FisicoTipoContent({ value, onChange, onClose }) {
  return (
    <div className="p-2 space-y-1 w-56">
      {FISICO_TIPOS.map(t => (
        <button key={t} onClick={() => { onChange(t); onClose(); }} className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all" style={{ background: value === t ? 'rgba(239,68,68,0.20)' : 'rgba(239,68,68,0.06)', border: value === t ? '2px solid #ef4444' : '2px solid transparent', color: '#ef4444' }}>
          {t}
        </button>
      ))}
      {value && <button onClick={() => { onChange(''); onClose(); }} className="w-full text-left px-3 py-1.5 text-xs" style={{ color: '#997b66' }}>Quitar</button>}
    </div>
  );
}

function MatchContent({ match, onUpdateMatch }) {
  return (
    <div className="p-3 w-72 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={match.hasMatch} onChange={e => onUpdateMatch({ hasMatch: e.target.checked })} className="w-4 h-4 rounded" style={{ accentColor: '#3b82f6' }} />
          <span className="text-sm font-medium" style={{ color: '#333' }}>Partido</span>
        </label>
      </div>
      {match.hasMatch && (
        <>
          <input value={match.jornada} onChange={e => onUpdateMatch({ jornada: e.target.value })} placeholder="Jornada (ej: 12)" className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.10)', color: '#333' }} />
          <input value={match.rival} onChange={e => onUpdateMatch({ rival: e.target.value })} placeholder="Rival" className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.10)', color: '#333' }} />
          <div className="flex items-center gap-2">
            {['home', 'away'].map(loc => (
              <button key={loc} onClick={() => onUpdateMatch({ location: loc })} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${match.location === loc ? '' : 'opacity-40'}`} style={{ background: match.location === loc ? 'rgba(59,130,246,0.10)' : 'transparent', border: match.location === loc ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(0,0,0,0.08)', color: '#3b82f6' }}>
                {loc === 'home' ? '🏠 Casa' : '✈️ Fuera'}
              </button>
            ))}
          </div>
          <input type="time" value={match.hora} onChange={e => onUpdateMatch({ hora: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.10)', color: '#333' }} />
        </>
      )}
    </div>
  );
}

function DatesContent({ dateStart, dateEnd, onDatesChange }) {
  const [draftStart, setDraftStart] = useState(dateStart);
  const [draftEnd, setDraftEnd] = useState(dateEnd);

  useEffect(() => {
    setDraftStart(dateStart);
    setDraftEnd(dateEnd);
  }, [dateStart, dateEnd]);

  return (
    <div className="p-3 w-64 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: '#666' }}>Desde:</span>
        <input type="date" value={draftStart} onChange={e => setDraftStart(e.target.value)} className="flex-1 px-2 py-1.5 rounded text-sm" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.10)', color: '#333' }} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: '#666' }}>Hasta:</span>
        <input type="date" value={draftEnd} onChange={e => setDraftEnd(e.target.value)} className="flex-1 px-2 py-1.5 rounded text-sm" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.10)', color: '#333' }} />
      </div>
      <button type="button" onClick={() => onDatesChange(draftStart, draftEnd)} className="w-full px-2 py-1.5 rounded text-xs font-medium" style={{ background: 'rgba(46,125,50,0.12)', color: '#2e7d32', border: '1px solid rgba(46,125,50,0.25)' }}>Aplicar fechas</button>
    </div>
  );
}

export default function CellEditPopover({ position, type, value, options = [], selected = [], onChange, onChangeMulti, onAddCustom, onClose, dimensionId, match, onUpdateMatch, dateStart, dateEnd, onDatesChange }) {
  const ref = useRef(null);
  const [adjustedPos, setAdjustedPos] = useState(position);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x = position.x;
      let y = position.y;
      if (x + rect.width > vw - 16) x = Math.max(8, vw - rect.width - 16);
      if (y + rect.height > vh - 16) y = position.y - rect.height - 8;
      setAdjustedPos({ x, y });
    }
  }, [position]);

  function renderContent() {
    switch (type) {
      case 'dimension':
        return <DimensionContent value={value} onChange={onChange} onClose={onClose} />;
      case 'situacion':
        return <MultiSelectContent items={options} selected={selected} onChange={onChangeMulti} placeholder="situaciones" />;
      case 'categoria':
        return <MultiSelectContent items={options} selected={selected} onChange={onChangeMulti} placeholder="categorías" color="#16a34a" />;
      case 'fisicoTipo':
        return <FisicoTipoContent value={value} onChange={onChange} onClose={onClose} />;
      case 'match':
        return <MatchContent match={match} onUpdateMatch={onUpdateMatch} />;
      case 'dates':
        return <DatesContent dateStart={dateStart} dateEnd={dateEnd} onDatesChange={onDatesChange} />;
      default:
        return null;
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div ref={ref} className="fixed z-[91] rounded-xl shadow-2xl" style={{ left: adjustedPos.x, top: adjustedPos.y, background: 'white', border: '1px solid rgba(0,0,0,0.12)', minWidth: 180 }}>
        {renderContent()}
      </div>
    </>
  );
}
