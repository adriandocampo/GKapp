import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, Plus, X } from 'lucide-react';

export default function MultiSelectDropdown({ options, selected, onChange, placeholder, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [newValue, setNewValue] = useState('');
  const ref = useRef();
  const searchRef = useRef();
  const addInputRef = useRef();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
        setShowAddInput(false);
        setNewValue('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && searchRef.current && !showAddInput) {
      searchRef.current.focus();
    }
    if (!open) {
      setSearch('');
      setShowAddInput(false);
      setNewValue('');
    }
  }, [open, showAddInput]);

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  function toggle(option) {
    const next = selected.includes(option)
      ? selected.filter(s => s !== option)
      : [...selected, option];
    onChange(next);
  }

  async function handleAddNew() {
    const trimmed = newValue.trim();
    if (!trimmed || !onAddNew) return;
    await onAddNew(trimmed);
    setNewValue('');
    setShowAddInput(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full v2-select flex items-center justify-between text-left cursor-pointer"
      >
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selected.map(s => (
              <span key={s} className="px-1.5 py-0.5 bg-gk-accent/15 text-gk-accent rounded text-xs font-medium">
                {s}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gk-text-tertiary text-sm">{placeholder}</span>
        )}
        <ChevronDown size={14} className="text-gk-text-tertiary shrink-0 ml-2" />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full overflow-hidden"
          style={{
            background: '#161410',
            border: '1px solid rgba(185,165,135,0.15)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ padding: 8, borderBottom: '1px solid rgba(185,165,135,0.10)' }}>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{color: '#997b66'}} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 32px',
                  background: 'rgba(12,11,9,0.8)',
                  border: '1px solid rgba(185,165,135,0.10)',
                  borderRadius: 8,
                  color: '#f1ede7',
                  fontSize: '0.75rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 && !showAddInput && (
              <p style={{ padding: '8px 12px', fontSize: '0.875rem', color: '#997b66' }}>Sin resultados</p>
            )}
            {filtered.map(opt => (
              <label
                key={opt}
                onClick={() => toggle(opt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  color: '#baa587',
                  fontSize: '0.875rem',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(20,27,36,0.8)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: selected.includes(opt) ? '2px solid #e8ac65' : '2px solid rgba(185,165,135,0.20)',
                    background: selected.includes(opt) ? '#e8ac65' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {selected.includes(opt) && <Check size={12} style={{color: 'white'}} />}
                </div>
                <span>{opt}</span>
              </label>
            ))}
          </div>
          {onAddNew && !showAddInput && (
            <button
              type="button"
              onClick={() => { setShowAddInput(true); setTimeout(() => addInputRef.current?.focus(), 50); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                fontSize: '0.75rem',
                color: '#e8ac65',
                background: 'transparent',
                border: 'none',
                borderTop: '1px solid rgba(185,165,135,0.10)',
                cursor: 'pointer',
              }}
            >
              <Plus size={12} /> Añadir
            </button>
          )}
          {showAddInput && (
            <div style={{ display: 'flex', gap: 4, padding: 8, borderTop: '1px solid rgba(185,165,135,0.10)' }}>
              <input
                ref={addInputRef}
                type="text"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); if (e.key === 'Escape') { setShowAddInput(false); setNewValue(''); } }}
                placeholder="Nuevo valor..."
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  background: 'rgba(12,11,9,0.8)',
                  border: '1px solid rgba(232,172,101,0.50)',
                  borderRadius: 6,
                  color: '#f1ede7',
                  fontSize: '0.75rem',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleAddNew}
                style={{
                  padding: '4px 8px',
                  background: '#e8ac65',
                  border: 'none',
                  borderRadius: 6,
                  color: 'white',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                OK
              </button>
              <button
                onClick={() => { setShowAddInput(false); setNewValue(''); }}
                style={{
                  padding: '4px 8px',
                  background: 'rgba(20,27,36,0.8)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#baa587',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
