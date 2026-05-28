import { useState, useEffect, useRef } from 'react';
import { X, Search, User, Shield, Loader2 } from 'lucide-react';
import { searchPlayer, fetchPlayerProfile, fetchPlayerSeasons, fetchPlayerSeasonStats, getPlayerImageUrl } from '../utils/sofascoreClient';
import { getSetting } from '../db';

const FALLBACK_ATTRIBUTES = [
  { name: 'Reflejos', value: 70 },
  { name: 'Juego Aéreo', value: 70 },
  { name: 'Juego con Pies', value: 70 },
  { name: '1 vs 1', value: 70 },
  { name: 'Liderazgo', value: 70 },
];

async function getDefaultAttributes() {
  try {
    const attrs = await getSetting('defaultAttributes');
    return attrs && attrs.length > 0 ? attrs.map(a => ({ ...a })) : FALLBACK_ATTRIBUTES.map(a => ({ ...a }));
  } catch {
    return FALLBACK_ATTRIBUTES.map(a => ({ ...a }));
  }
}

export default function PorteroSelectModal({ onClose, onSave }) {
  const [mode, setMode] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState({
    name: '', team: '', height: '', preferredFoot: 'Diestro',
    nationality: '', dateOfBirth: '',
  });
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await searchPlayer(query.trim());
      setResults(res.filter(r => r.position === 'G'));
      setSearching(false);
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function handleSelectPlayer(entity) {
    setLoading(true);
    try {
      const profile = await fetchPlayerProfile(entity.id);
      const seasons = await fetchPlayerSeasons(entity.id);
      let careerStats = [];
      for (const ts of seasons.slice(0, 5)) {
        const sid = ts.seasons?.[0]?.id;
        if (sid) {
          const stats = await fetchPlayerSeasonStats(entity.id, sid);
          if (stats?.length) careerStats.push(...stats);
        }
      }
      const defaults = await getDefaultAttributes();
      const portero = {
        name: entity.name,
        slug: entity.slug,
        sofascoreId: entity.id,
        team: entity.team?.name || '',
        isManual: false,
        dateOfBirth: profile?.dateOfBirth || '',
        height: profile?.height || '',
        preferredFoot: profile?.preferredFoot || 'Diestro',
        nationality: profile?.country?.name || entity.country?.name || '',
        nationalityFlag: entity.country?.alpha2 || '',
        photo: getPlayerImageUrl(entity.id),
        personalRating: 0,
        customAttributes: defaults,
        sofascoreData: { profile, career: careerStats },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await onSave(portero);
      onClose();
    } catch (err) {
      console.error('Error fetching player data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveManual() {
    if (!manual.name.trim()) return;
    const defaults = await getDefaultAttributes();
    const portero = {
      name: manual.name.trim(),
      slug: manual.name.trim().toLowerCase().replace(/\s+/g, '-'),
      sofascoreId: null,
      team: manual.team.trim(),
      isManual: true,
      dateOfBirth: manual.dateOfBirth,
      height: manual.height,
      preferredFoot: manual.preferredFoot,
      nationality: manual.nationality,
      nationalityFlag: '',
      photo: '',
      personalRating: 0,
      customAttributes: defaults,
      sofascoreData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await onSave(portero);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.7)'}}>
      <div className="glass-card-static w-full max-w-lg" style={{borderRadius: 20, maxHeight: '85vh', overflow: 'hidden'}}>
        <div className="p-5 flex items-center justify-between" style={{borderBottom: '1px solid rgba(185,165,135,0.08)'}}>
          <h3 className="text-lg font-bold" style={{color: '#f1ede7'}}>
            {mode === 'search' ? 'Añadir Portero' : 'Introducir Manualmente'}
          </h3>
          <button onClick={onClose} className="v2-btn-ghost p-1 rounded-lg"><X size={20} /></button>
        </div>

        <div className="p-5 overflow-y-auto" style={{maxHeight: '70vh'}}>
          {mode === 'search' ? (
            <>
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color: '#997b66'}} />
                <input
                  type="text"
                  className="v2-input w-full" style={{paddingLeft: 36}}
                  placeholder="Buscar portero en SofaScore..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {searching && (
                <div className="flex items-center justify-center py-8 gap-2" style={{color: '#baa587'}}>
                  <Loader2 size={18} className="animate-spin" />
                  Buscando...
                </div>
              )}

              {!searching && results.length === 0 && query.trim() && (
                <div className="text-center py-6" style={{color: '#997b66'}}>
                  <User size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No se encontraron porteros</p>
                </div>
              )}

              {!searching && results.length > 0 && (
                <div className="space-y-2 mb-4">
                  {results.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleSelectPlayer(player)}
                      disabled={loading}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                      style={{background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)'}}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(232,172,101,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(185,165,135,0.08)'}
                    >
                      <img
                        src={getPlayerImageUrl(player.id)}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                        style={{background: 'rgba(185,165,135,0.1)'}}
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{color: '#f1ede7'}}>{player.name}</p>
                        <p className="text-xs truncate" style={{color: '#baa587'}}>
                          {player.team?.name || 'Sin equipo'}
                          {player.country?.name ? ` · ${player.country.name}` : ''}
                        </p>
                      </div>
                      {loading && <Loader2 size={16} className="animate-spin" style={{color: '#e8ac65'}} />}
                    </button>
                  ))}
                </div>
              )}

              {!query.trim() && (
                <div className="text-center py-6" style={{color: '#997b66'}}>
                  <p className="text-sm mb-4">Escribe el nombre del portero para buscarlo en SofaScore</p>
                </div>
              )}

              <div className="pt-3" style={{borderTop: '1px solid rgba(185,165,135,0.08)'}}>
                <button onClick={() => setMode('manual')} className="v2-btn-ghost w-full justify-center py-2.5">
                  <Shield size={16} />
                  Introducir manualmente
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{color: '#baa587'}}>Nombre *</label>
                  <input type="text" className="v2-input w-full" placeholder="Nombre del portero"
                    value={manual.name} onChange={e => setManual(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{color: '#baa587'}}>Equipo</label>
                  <input type="text" className="v2-input w-full" placeholder="CD Lugo"
                    value={manual.team} onChange={e => setManual(p => ({ ...p, team: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{color: '#baa587'}}>Altura (cm)</label>
                    <input type="text" className="v2-input w-full" placeholder="185"
                      value={manual.height} onChange={e => setManual(p => ({ ...p, height: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{color: '#baa587'}}>Lateralidad</label>
                    <select className="v2-select w-full" value={manual.preferredFoot}
                      onChange={e => setManual(p => ({ ...p, preferredFoot: e.target.value }))}>
                      <option value="Diestro">Diestro</option>
                      <option value="Zurdo">Zurdo</option>
                      <option value="Ambos">Ambos</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{color: '#baa587'}}>Nacionalidad</label>
                    <input type="text" className="v2-input w-full" placeholder="España"
                      value={manual.nationality} onChange={e => setManual(p => ({ ...p, nationality: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{color: '#baa587'}}>Fecha de nacimiento</label>
                    <input type="date" className="v2-input w-full"
                      value={manual.dateOfBirth} onChange={e => setManual(p => ({ ...p, dateOfBirth: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-5 pt-4" style={{borderTop: '1px solid rgba(185,165,135,0.08)'}}>
                <button onClick={() => setMode('search')} className="v2-btn-ghost flex-1 justify-center py-2.5">
                  Volver
                </button>
                <button onClick={handleSaveManual}
                  disabled={!manual.name.trim()}
                  className="flex-1 justify-center py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer disabled:opacity-40"
                  style={{
                    background: 'rgba(232,172,101,0.12)',
                    border: '1px solid rgba(232,172,101,0.15)',
                    color: '#e8ac65',
                  }}>
                  <Shield size={16} className="inline mr-1.5" />
                  Guardar Portero
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}