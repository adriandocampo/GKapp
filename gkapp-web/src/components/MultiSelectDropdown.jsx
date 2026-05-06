import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function MultiSelectDropdown({ options, selected, onChange, placeholder, onAddNew }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle(option) {
    const next = selected.includes(option)
      ? selected.filter(s => s !== option)
      : [...selected, option];
    onChange(next);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-left focus:outline-none focus:border-teal-500 transition-colors"
      >
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selected.map(s => (
              <span key={s} className="px-1.5 py-0.5 bg-teal-600/20 text-teal-400 rounded text-xs font-medium">
                {s}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-slate-500 text-sm">{placeholder}</span>
        )}
        <ChevronDown size={14} className="text-slate-500 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-500">Sin opciones</p>
          )}
          {options.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 cursor-pointer"
              onClick={() => toggle(opt)}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                selected.includes(opt)
                  ? 'bg-teal-600 border-teal-600'
                  : 'border-slate-600 bg-slate-700'
              }`}>
                {selected.includes(opt) && <Check size={12} className="text-white" />}
              </div>
              <span className="text-sm text-slate-300">{opt}</span>
            </label>
          ))}
          {onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="w-full text-left px-3 py-1.5 text-xs text-teal-400 hover:bg-slate-700 border-t border-slate-700"
            >
              + Añadir situación
            </button>
          )}
        </div>
      )}
    </div>
  );
}
