import { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, Plus, Star, User, Ruler, CalendarDays, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from 'lucide-react';
import { db } from '../db';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Modal';
import PorteroSelectModal from '../components/PorteroSelectModal';
import PorteroProfile from '../components/PorteroProfile';

function calculateAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function translateFoot(foot) {
  if (!foot) return '-';
  const f = foot.toLowerCase();
  if (f === 'right' || f === 'diestro') return 'Diestro';
  if (f === 'left' || f === 'zurdo') return 'Zurdo';
  if (f === 'both' || f === 'ambos' || f === 'ambidextrous') return 'Ambos';
  return foot;
}

function getRatingColor(rating) {
  if (rating === 0) return '#997b66';
  if (rating === 5) return '#e8ac65';
  if (rating === 4) return '#d4a574';
  if (rating === 3) return '#c89850';
  if (rating === 2) return '#d08c60';
  return '#c05050';
}

function getRatingBg(rating) {
  if (rating === 0) return 'rgba(185,165,135,0.08)';
  if (rating >= 4) return 'rgba(232,172,101,0.12)';
  if (rating >= 3) return 'rgba(200,152,80,0.12)';
  if (rating >= 2) return 'rgba(208,140,96,0.12)';
  return 'rgba(192,80,80,0.12)';
}

function getRatingBorder(rating) {
  if (rating === 0) return 'rgba(185,165,135,0.1)';
  if (rating >= 4) return 'rgba(232,172,101,0.25)';
  if (rating >= 3) return 'rgba(200,152,80,0.2)';
  if (rating >= 2) return 'rgba(208,140,96,0.2)';
  return 'rgba(192,80,80,0.2)';
}

export default function PorterosPage() {
  const [porteros, setPorteros] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPortero, setSelectedPortero] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('rating');
  const [sortOrder, setSortOrder] = useState('desc');

  const sortFields = [
    { key: 'rating', label: 'Valoración' },
    { key: 'name', label: 'Nombre' },
    { key: 'age', label: 'Edad' },
    { key: 'height', label: 'Altura' },
  ];

  const filteredPorteros = useMemo(() => {
    if (!searchQuery.trim()) return porteros;
    const q = searchQuery.toLowerCase().trim();
    return porteros.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.team || '').toLowerCase().includes(q)
    );
  }, [porteros, searchQuery]);

  const sortedPorteros = useMemo(() => {
    const list = [...filteredPorteros];
    list.sort((a, b) => {
      let va, vb;
      switch (sortField) {
        case 'name':
          va = (a.name || '').toLowerCase();
          vb = (b.name || '').toLowerCase();
          break;
        case 'age':
          va = calculateAge(a.dateOfBirth) ?? 0;
          vb = calculateAge(b.dateOfBirth) ?? 0;
          break;
        case 'height':
          va = parseInt(a.height) || 0;
          vb = parseInt(b.height) || 0;
          break;
        default: // rating
          va = a.personalRating || 0;
          vb = b.personalRating || 0;
      }
      return sortOrder === 'asc' ? (va > vb ? 1 : va < vb ? -1 : 0) : (va < vb ? 1 : va > vb ? -1 : 0);
    });
    return list;
  }, [filteredPorteros, sortField, sortOrder]);

  const loadPorteros = useCallback(async () => {
    try {
      setLoading(true);
      const items = await db.porteros.toArray();
      setPorteros(items);
    } catch (err) {
      console.error('Error loading porteros:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPorteros(); }, [loadPorteros]);

  async function handleSave(portero) {
    try {
      const id = await db.porteros.add(portero);
      await loadPorteros();
      const saved = await db.porteros.get(id);
      if (saved) setSelectedPortero(saved);
      addToast(`Portero "${portero.name}" añadido`, 'success');
    } catch (err) {
      console.error('Error saving portero:', err);
      addToast('Error al guardar el portero', 'error');
    }
  }

  async function handleUpdate(updated) {
    try {
      await db.porteros.put(updated);
      setSelectedPortero(updated);
      await loadPorteros();
      addToast('Portero actualizado', 'success');
    } catch (err) {
      console.error('Error updating portero:', err);
      addToast('Error al actualizar', 'error');
    }
  }

  async function handleDelete(portero) {
    const confirmed = await confirm(`¿Eliminar a ${portero.name}?`, {
      title: 'Eliminar Portero',
      confirmText: 'Eliminar',
    });
    if (!confirmed) return;
    try {
      await db.porteros.delete(portero.id);
      setSelectedPortero(null);
      await loadPorteros();
      addToast(`Portero "${portero.name}" eliminado`, 'success');
    } catch (err) {
      console.error('Error deleting portero:', err);
      addToast('Error al eliminar', 'error');
    }
  }

  return (
    <div className="animate-v2-fade-in-up -mx-4 -my-6 px-4 py-6 min-h-[calc(100vh-4rem)]" style={{ backgroundColor: '#0c0b09' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color: '#f1ede7'}}>
            <Shield size={24} className="inline mr-2" style={{color: '#e8ac65'}} />
            Porteros
          </h1>
          <p className="text-sm mt-1" style={{color: '#baa587'}}>
            {filteredPorteros.length} de {porteros.length} portero{porteros.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer"
          style={{
            background: 'rgba(232,172,101,0.12)',
            border: '1px solid rgba(232,172,101,0.15)',
            color: '#e8ac65',
          }}>
          <Plus size={18} />
          Añadir Portero
        </button>
      </div>

      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl" style={{
          background: 'linear-gradient(135deg, rgba(232,172,101,0.08) 0%, rgba(185,165,135,0.02) 100%)',
          border: '1px solid rgba(232,172,101,0.12)',
        }} />
        <div className="relative flex items-center gap-2 px-4 py-3">
          <Search size={18} style={{color: '#997b66', flexShrink: 0}} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o equipo…"
            className="w-full bg-transparent text-sm outline-none"
            style={{color: '#f1ede7'}}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="cursor-pointer p-0.5">
              <X size={16} style={{color: '#997b66'}} />
            </button>
          )}
        </div>
      </div>

      {porteros.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-medium mr-1" style={{color: '#997b66'}}>Ordenar por</span>
          <select
            value={sortField}
            onChange={e => setSortField(e.target.value)}
            className="v2-select text-xs py-1.5 px-2.5"
            style={{width: 'auto', minWidth: 0}}
          >
            {sortFields.map(f => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
          <button
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            className="v2-btn-ghost text-xs py-1.5 px-2.5"
            title={sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
          >
            {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8" style={{border: '2px solid rgba(232,172,101,0.2)', borderTopColor: '#e8ac65'}} />
        </div>
      ) : porteros.length === 0 ? (
        <div className="text-center py-16">
          <Shield size={48} className="mx-auto mb-3" style={{color: 'rgba(185,165,135,0.15)'}} />
          <p className="text-lg font-medium" style={{color: '#baa587'}}>Aún no has añadido ningún portero</p>
          <p className="text-sm mt-1" style={{color: '#997b66'}}>Pulsa "Añadir Portero" para empezar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPorteros.map(p => {
            const age = calculateAge(p.dateOfBirth);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPortero(p)}
                className="glass-card p-4 text-left transition-all cursor-pointer w-full"
                style={{border: '1px solid rgba(185,165,135,0.08)'}}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(232,172,101,0.2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(185,165,135,0.08)'}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    {p.photo ? (
                      <img src={p.photo} alt="" className="w-12 h-12 rounded-full object-cover"
                        style={{background: 'rgba(185,165,135,0.1)'}}
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                        style={{background: 'rgba(232,172,101,0.1)'}}>
                        <User size={24} style={{color: '#e8ac65'}} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{color: '#f1ede7'}}>{p.name}</p>
                      <p className="text-xs truncate" style={{color: '#baa587'}}>{p.team || 'Sin equipo'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center shrink-0 w-14 h-14 rounded-full text-center"
                    style={{
                      background: getRatingBg(p.personalRating),
                      border: `1px solid ${getRatingBorder(p.personalRating)}`,
                    }}>
                    {p.personalRating > 0 ? (
                      <>
                        <span className="text-base font-bold" style={{color: getRatingColor(p.personalRating), lineHeight: 1.2}}>{p.personalRating}</span>
                        <Star size={10} style={{color: getRatingColor(p.personalRating), fill: getRatingColor(p.personalRating)}} />
                      </>
                    ) : (
                      <span className="text-[10px]" style={{color: '#997b66', lineHeight: 1.2}}>—</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 text-xs" style={{borderTop: '1px solid rgba(185,165,135,0.06)'}}>
                  <span className="flex items-center gap-1" style={{color: '#997b66'}}>
                    <CalendarDays size={11} />
                    {age ? `${age} años` : '-'}
                  </span>
                  <span style={{color: '#baa587', fontWeight: 500}}>
                    {translateFoot(p.preferredFoot)}
                  </span>
                  <span className="flex items-center gap-1" style={{color: '#997b66'}}>
                    <Ruler size={11} />
                    {p.height ? `${p.height} cm` : '--- cm'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <PorteroSelectModal
          onClose={() => setShowAddModal(false)}
          onSave={handleSave}
        />
      )}

      {selectedPortero && (
        <PorteroProfile
          portero={selectedPortero}
          onClose={() => setSelectedPortero(null)}
          onUpdate={handleUpdate}
          onDelete={() => handleDelete(selectedPortero)}
        />
      )}
    </div>
  );
}