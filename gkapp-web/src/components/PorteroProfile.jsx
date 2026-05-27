import { useState, useEffect, useRef, Fragment, useMemo } from 'react';
import { X, User, BarChart3, Briefcase, Plus, Trash2, Star, Loader2, ChevronDown, ChevronUp, GitCompare } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import StarRating from './StarRating';
import GoalkeeperHeatmap from './GoalkeeperHeatmap';
import { fetchPlayerLastEvents, fetchHeatmap } from '../utils/sofascoreClient';
import { db } from '../db';

const TABS = [
  { key: 'profile', label: 'Perfil', icon: User },
  { key: 'stats', label: 'Estadísticas SofaScore', icon: BarChart3 },
  { key: 'career', label: 'Carrera', icon: Briefcase },
];

function calculateAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function CustomRadarChart({ data, color = '#e8ac65', height = undefined }) {
  const allZero = data.every(d => d.value === 0);
  if (allZero) {
  return (
    <div className="flex items-center justify-center" style={{ height: height || 220, color: '#997b66' }}>
      <p className="text-sm">Sin datos</p>
    </div>
  );
}
const chartHeight = height || (typeof window !== 'undefined' && window.innerWidth >= 1280 ? 280 : 220);
return (
  <ResponsiveContainer width="100%" height={chartHeight}>
    <RadarChart cx="50%" cy="50%" outerRadius="68%" data={data}>
        <PolarGrid stroke="rgba(185,165,135,0.15)" />
        <PolarAngleAxis dataKey="name" tick={{ fill: '#baa587', fontSize: 10 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="Valoración" dataKey="value" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function StatRow({ label, value, unit }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{background: 'rgba(22,20,16,0.4)'}}>
      <span className="text-sm" style={{color: '#baa587'}}>{label}</span>
      <span className="text-sm font-semibold" style={{color: '#f1ede7'}}>{value}{unit && <span className="text-xs ml-0.5" style={{color: '#997b66'}}>{unit}</span>}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, children, color, subtitle }) {
  return (
    <div className="mb-4 pb-3" style={{borderBottom: `1px solid ${color}15`}}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} style={{color}} />}
        <h4 className="text-sm font-semibold tracking-wide" style={{color: '#f1ede7'}}>{children}</h4>
      </div>
      {subtitle && <p className="text-xs mt-0.5" style={{color: '#997b66'}}>{subtitle}</p>}
    </div>
  );
}

function SofaScoreStats({ careerData, heatmapData, loadingHeatmap, compareGk, compareRadarData, onCompare, onCloseCompare, showGkList, searchGkQuery, setSearchGkQuery, gkList, selectCompareGk, dropdownRef, porteroName, compareGkName }) {
  if (!careerData || careerData.length === 0 && !compareGk) {
    return (
      <div className="flex items-center justify-center py-8" style={{ color: '#997b66' }}>
        <p className="text-sm">No hay datos de SofaScore disponibles</p>
      </div>
    );
  }

  const st = careerData[0]?.statistics || {};
  const apps = st.appearances || 0;

  const goalsPerGame = apps > 0 ? (st.goalsConceded / apps).toFixed(2) : '-';
  const savesPerGame = apps > 0 ? (st.saves / apps).toFixed(2) : '-';
  const savePct = (st.saves + st.goalsConceded) > 0
    ? Math.round((st.saves / (st.saves + st.goalsConceded)) * 100)
    : '-';
  const longPlayPct = st.totalPasses > 0
    ? Math.round((st.totalLongBalls / st.totalPasses) * 100)
    : '-';
  const aerialPct = st.aerialDuelsWon != null ? '-' : '-';

  const radarData = [
    { name: 'Paradas', value: (st.saves + st.goalsConceded) > 0 ? Math.round((st.saves / (st.saves + st.goalsConceded)) * 100) : 0 },
    { name: 'Precisión', value: Math.round(st.accuratePassesPercentage || 0) },
    { name: 'P. Largos', value: st.totalLongBalls ? Math.round((st.accurateLongBalls / st.totalLongBalls) * 100) : 0 },
    { name: 'J. Aéreo', value: st.aerialDuelsWon ? Math.min(100, st.aerialDuelsWon * 10) : 0 },
    { name: 'Penaltis', value: st.penaltyFaced ? Math.round((st.penaltySave / st.penaltyFaced) * 100) : 0 },
    { name: 'Clean Sheet', value: apps ? Math.round((st.cleanSheet / apps) * 100) : 0 },
  ];

  const stats = [
    { label: 'Partidos jugados', value: apps },
    { label: 'Goles encajados', value: st.goalsConceded || 0 },
    { label: 'Porterías a cero', value: st.cleanSheet || 0, accent: true },
    { label: 'Paradas', value: st.saves || 0 },
    { label: 'Goles encajados por partido', value: goalsPerGame },
    { label: 'Paradas por partido', value: savesPerGame },
    { label: '% Paradas', value: savePct, unit: '%' },
    { label: 'Pases totales', value: st.totalPasses || 0 },
    { label: '% Pases precisos', value: st.accuratePassesPercentage ? `${st.accuratePassesPercentage}%` : '-' },
    { label: 'Pases largos', value: st.totalLongBalls || 0 },
    { label: '% Pases largos precisos', value: st.accurateLongBallsPercentage ? `${st.accurateLongBallsPercentage}%` : '-' },
    { label: 'Juego en largo', value: longPlayPct, unit: '%' },
    { label: 'Duelos aéreos ganados', value: st.aerialDuelsWon || 0 },
    { label: 'Errores que acaban en gol', value: st.errorLeadToGoal || 0 },
    { label: 'Recuperaciones', value: st.interceptions || 0 },
    { label: 'Tarjetas', value: (st.yellowCards || 0) + (st.redCards || 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card-static p-4">
        <div className="flex items-center justify-between mb-3 pb-2" style={{borderBottom: '1px solid rgba(90,180,230,0.08)'}}>
          <div className="flex items-center gap-2">
            <BarChart3 size={16} style={{color: '#5ab4e6'}} />
            <h4 className="text-sm font-semibold tracking-wide" style={{color: '#f1ede7'}}>
              Radar SofaScore {careerData[0]?.year ? `(${careerData[0].year})` : ''}
            </h4>
          </div>
          <div className="flex items-center gap-2 shrink-0 relative">
            {compareGk && (
              <button onClick={onCloseCompare} className="v2-btn-ghost text-xs py-1 px-2" style={{color: '#d08c60'}}>
                <X size={12} /> Cerrar
              </button>
            )}
            <button onClick={onCompare} className="v2-btn-ghost text-xs py-1 px-2">
              <GitCompare size={12} /> Comparar
            </button>
            {showGkList && (
              <div ref={dropdownRef} className="absolute top-full right-0 mt-1 z-50 w-56 rounded-xl p-2 shadow-xl" style={{background: '#1a1815', border: '1px solid rgba(185,165,135,0.15)'}}>
                <input type="text" placeholder="Buscar portero..." value={searchGkQuery}
                  onChange={e => setSearchGkQuery(e.target.value)}
                  className="v2-input w-full text-xs py-1.5 px-2.5 mb-1" autoFocus />
                <div className="max-h-40 overflow-y-auto v2-scrollbar space-y-0.5">
                  {gkList.filter(g => g.name.toLowerCase().includes(searchGkQuery.toLowerCase())).map(gk => (
                    <button key={gk.id} onClick={() => { selectCompareGk(gk); setSearchGkQuery(''); }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all"
                      style={{color: '#f1ede7', background: 'rgba(22,20,16,0.4)'}}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,172,101,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(22,20,16,0.4)'}>
                      {gk.name}
                    </button>
                  ))}
                  {gkList.filter(g => g.name.toLowerCase().includes(searchGkQuery.toLowerCase())).length === 0 && (
                    <p className="text-xs text-center py-2" style={{color: '#997b66'}}>Sin resultados</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={compareGk ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
          <div>
            {compareGk && <p className="text-xs text-center mb-1 font-medium" style={{color: '#e8ac65'}}>{porteroName || ''}</p>}
            <CustomRadarChart data={radarData} color="#5ab4e6" />
          </div>
          {compareGk && (
            <div>
              <p className="text-xs text-center mb-1 font-medium" style={{color: '#5ab4e6'}}>{compareGkName || ''}</p>
              <CustomRadarChart data={compareRadarData || []} color="#5ab4e6" />
            </div>
          )}
        </div>
      </div>

      <div className="glass-card-static p-4">
        <SectionTitle icon={BarChart3} color="#d4a574" subtitle="Métricas detalladas de la temporada">
          Estadísticas {careerData[0]?.year || ''}
        </SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {stats.map(s => (
            <StatRow key={s.label} label={s.label} value={s.value} unit={s.unit} />
          ))}
        </div>
      </div>

      <div className="glass-card-static p-4">
        <SectionTitle icon={BarChart3} color="#6b8f71" subtitle="Distribución de acciones en el campo">
          Heatmap {loadingHeatmap ? <Loader2 size={14} className="animate-spin inline ml-1" /> : `(${(heatmapData || []).length} pts)`}
        </SectionTitle>
        {loadingHeatmap ? (
          <div className="flex items-center justify-center py-12" style={{color: '#997b66'}}>
            <Loader2 size={20} className="animate-spin mr-2" />
            <span className="text-sm">Cargando heatmap de los últimos 3 partidos...</span>
          </div>
        ) : (
          <GoalkeeperHeatmap heatmap={heatmapData || []} />
        )}
      </div>
    </div>
  );
}

function CareerTable({ careerData }) {
  const [expanded, setExpanded] = useState({});

  function dedupe(arr) {
    const seen = new Set();
    return arr.filter(e => {
      const st = e.statistics || {};
      const key = `${e.year || ''}|${e.team?.name || ''}|${e.uniqueTournament?.name || ''}|${st.appearances || 0}|${st.minutesPlayed || 0}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function groupCareer(data) {
    const deduped = dedupe(data);
    const groups = {};
    for (const entry of deduped) {
      const key = `${entry.year || '?'}_${entry.team?.name || '?'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    return Object.entries(groups).map(([, entries]) => {
      const aggregated = entries.reduce((acc, e) => {
        const st = e.statistics || {};
        return {
          appearances: (acc.appearances || 0) + (st.appearances || 0),
          minutesPlayed: (acc.minutesPlayed || 0) + (st.minutesPlayed || 0),
          goalsConceded: (acc.goalsConceded || 0) + (st.goalsConceded || 0),
          cleanSheet: (acc.cleanSheet || 0) + (st.cleanSheet || 0),
        };
      }, {});
      entries.sort((a, b) => (b.statistics?.appearances || 0) - (a.statistics?.appearances || 0));
      const primary = entries[0];
      return {
        year: primary.year,
        teamName: primary.team?.name,
        tournament: primary.uniqueTournament?.name,
        stats: aggregated,
        details: entries,
      };
    });
  }

  if (!careerData || careerData.length === 0) {
    return (
      <div className="flex items-center justify-center py-8" style={{ color: '#997b66' }}>
        <p className="text-sm">No hay datos de carrera disponibles</p>
      </div>
    );
  }

  const groups = groupCareer(careerData);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
        <thead>
          <tr className="text-xs" style={{ color: '#997b66' }}>
            <th className="text-left py-2 px-2 lg:px-4">Temp.</th>
            <th className="text-left py-2 px-2 lg:px-4">Equipo</th>
            <th className="text-left py-2 px-2 lg:px-4">Comp.</th>
            <th className="text-center py-2 px-2 lg:px-4">PJ</th>
            <th className="text-center py-2 px-2 lg:px-4">Min.</th>
            <th className="text-center py-2 px-2 lg:px-4">G.Enc.</th>
            <th className="text-center py-2 px-2 lg:px-4">P.0</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <Fragment key={i}>
                <tr
                  onClick={() => g.details.length > 1 && setExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
                  className="rounded-xl transition-all cursor-pointer"
                  style={{
                    background: g.details.length > 1 ? 'rgba(232,172,101,0.06)' : 'rgba(22,20,16,0.5)',
                    display: 'table-row',
                  }}
                >
                  <td className="py-2.5 px-2 lg:px-4 font-medium" style={{ color: '#f1ede7' }}>{g.year || '-'}</td>
                  <td className="py-2.5 px-2 lg:px-4" style={{ color: '#baa587' }}>{g.teamName || '-'}</td>
                  <td className="py-2.5 px-2 lg:px-4" style={{ color: '#baa587' }}>{g.tournament || '-'}</td>
                  <td className="text-center py-2.5 px-2 lg:px-4" style={{ color: '#f1ede7', fontWeight: 600 }}>{g.stats.appearances}</td>
                  <td className="text-center py-2.5 px-2 lg:px-4" style={{ color: '#f1ede7' }}>{g.stats.minutesPlayed}</td>
                  <td className="text-center py-2.5 px-2 lg:px-4" style={{ color: '#f1ede7' }}>{g.stats.goalsConceded}</td>
                  <td className="text-center py-2.5 px-2 lg:px-4 font-semibold" style={{ color: '#9b9b7a' }}>{g.stats.cleanSheet}</td>
                  <td className="py-2.5 px-1 lg:px-3">
                    {g.details.length > 1 && (
                      expanded[i] ? <ChevronUp size={14} style={{color: '#e8ac65'}} /> : <ChevronDown size={14} style={{color: '#997b66'}} />
                    )}
                  </td>
                </tr>
                {expanded[i] && g.details.map((d, j) => {
                  const st = d.statistics || {};
                  return (
                    <tr key={`${i}-${j}`} style={{ background: 'rgba(22,20,16,0.3)', display: 'table-row' }}>
                      <td className="py-1.5 px-2 lg:px-4 text-xs" style={{ color: '#997b66' }}></td>
                      <td className="py-1.5 px-2 lg:px-4 text-xs" style={{ color: '#997b66' }}></td>
                      <td className="py-1.5 px-2 lg:px-4 text-xs" style={{ color: '#baa587' }}>{d.uniqueTournament?.name || '-'}</td>
                      <td className="text-center py-1.5 px-2 lg:px-4 text-xs" style={{ color: '#baa587' }}>{st.appearances || 0}</td>
                      <td className="text-center py-1.5 px-2 lg:px-4 text-xs" style={{ color: '#baa587' }}>{st.minutesPlayed || 0}</td>
                      <td className="text-center py-1.5 px-2 lg:px-4 text-xs" style={{ color: '#baa587' }}>{st.goalsConceded || 0}</td>
                      <td className="text-center py-1.5 px-2 lg:px-4 text-xs" style={{ color: '#9b9b7a' }}>{st.cleanSheet || 0}</td>
                      <td></td>
                    </tr>
                  );
                })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PorteroProfile({ portero, onClose, onUpdate, onDelete }) {
  const [tab, setTab] = useState('profile');
  const [editing, setEditing] = useState(false);
  const [attrs, setAttrs] = useState(portero.customAttributes || []);
  const [rating, setRating] = useState(portero.personalRating || 0);
  const maxAttrWidth = useMemo(() => {
    if (!attrs.length) return 80;
    const longest = Math.max(...attrs.map(a => a.name.length));
    return Math.max(longest * 7.5 + 8, 60);
  }, [attrs]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const [compareGk, setCompareGk] = useState(null);
  const [gkList, setGkList] = useState([]);
  const [showGkList, setShowGkList] = useState(false);
  const [searchGkQuery, setSearchGkQuery] = useState('');
  const dropdownRef = useRef(null);
  const careerData = portero.sofascoreData?.career || [];
  const age = calculateAge(portero.dateOfBirth);
  const saveTimer = useRef(null);
  const heatmapFetched = useRef(false);

  function persistChanges(currentAttrs, currentRating) {
    onUpdate({
      ...portero,
      customAttributes: currentAttrs,
      personalRating: currentRating,
      updatedAt: new Date(),
    });
  }

  function scheduleSave(currentAttrs, currentRating) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistChanges(currentAttrs, currentRating), 300);
  }

  function handleEditAttr(index, value) {
    const next = attrs.map((a, i) => i === index ? { ...a, value } : a);
    setAttrs(next);
    scheduleSave(next, rating);
  }

  function handleAddAttr() {
    const name = window.prompt('Nombre del nuevo atributo:');
    if (!name || !name.trim()) return;
    const next = [...attrs, { name: name.trim(), value: 50 }];
    setAttrs(next);
    persistChanges(next, rating);
  }

  function handleDeleteAttr(index) {
    const next = attrs.filter((_, i) => i !== index);
    setAttrs(next);
    persistChanges(next, rating);
  }

  function handleRatingChange(v) {
    setRating(v);
    persistChanges(attrs, v);
  }

  useEffect(() => {
    return () => clearTimeout(saveTimer.current);
  }, []);

  useEffect(() => {
    if (!showGkList) return;
    function handleKeyDown(e) { if (e.key === 'Escape') { setShowGkList(false); setSearchGkQuery(''); } }
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowGkList(false);
        setSearchGkQuery('');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [showGkList]);

  useEffect(() => {
    heatmapFetched.current = false;
    setHeatmapData([]);
    setLoadingHeatmap(false);
  }, [portero.sofascoreId]);

  useEffect(() => {
    if (tab !== 'stats' || !portero.sofascoreId) return;
    if (heatmapFetched.current) return;
    if (portero.sofascoreData?.heatmap?.length > 0) {
      setHeatmapData(portero.sofascoreData.heatmap);
      heatmapFetched.current = true;
      return;
    }
    heatmapFetched.current = true;
    setLoadingHeatmap(true);
    fetchPlayerLastEvents(portero.sofascoreId).then(events => {
      const last3 = events.slice(0, 3);
      return Promise.all(last3.map(ev =>
        fetchHeatmap(ev.event.id, portero.sofascoreId).catch(() => null)
      ));
    }).then(results => {
      const allPoints = results.flatMap(h => h?.heatmap || []);
      setHeatmapData(allPoints);
      if (allPoints.length > 0) {
        db.porteros.update(portero.id, {
          sofascoreData: { ...portero.sofascoreData, heatmap: allPoints },
          updatedAt: new Date(),
        }).catch(() => {});
      }
    }).catch(err => {
      console.error('[Heatmap] Error fetching:', err);
    }).finally(() => {
      setLoadingHeatmap(false);
    });
  }, [tab, portero.sofascoreId]);

  async function loadCompareGk() {
    const all = await db.porteros.toArray();
    setGkList(all.filter(g => g.id !== portero.id));
    setShowGkList(true);
  }

  function selectCompareGk(gk) {
    setCompareGk(gk);
    setShowGkList(false);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 lg:p-8 pt-12 lg:pt-16" style={{background: 'rgba(0,0,0,0.7)'}}>
      <div className="glass-card-static w-full max-w-6xl flex flex-col" style={{borderRadius: 20, maxHeight: '90vh', overflow: 'hidden'}}>
        <div className="p-6 lg:p-8 flex flex-col items-center text-center" style={{borderBottom: '1px solid rgba(185,165,135,0.08)'}}>
          <div className="flex items-center gap-4 lg:gap-6 mb-1">
            {portero.photo ? (
              <img src={portero.photo} alt="" className="w-18 h-18 rounded-full object-cover lg:w-20 lg:h-20"
                style={{width: 72, height: 72, background: 'rgba(185,165,135,0.1)'}}
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="rounded-full flex items-center justify-center lg:w-20 lg:h-20" style={{width: 72, height: 72, background: 'rgba(232,172,101,0.1)'}}>
                <User size={36} style={{color: '#e8ac65'}} />
              </div>
            )}
            <div>
              <h3 className="font-bold" style={{color: '#f1ede7', fontSize: 'clamp(1.25rem, 2.5vw, 2rem)', lineHeight: 1.2}}>{portero.name}</h3>
              <p className="font-medium" style={{color: '#baa587', fontSize: 'clamp(0.9rem, 1.2vw, 1.15rem)'}}>{portero.team || 'Sin equipo'}</p>
            </div>
          </div>
          <button onClick={onClose} className="v2-btn-ghost p-1.5 rounded-lg absolute" style={{top: 'clamp(12px, 2vw, 24px)', right: 'clamp(12px, 2vw, 24px)'}}><X size={22} /></button>
        </div>

        <div className="flex justify-center px-5 gap-2 pb-3 pt-2 flex-wrap" style={{borderBottom: '1px solid rgba(185,165,135,0.08)'}}>
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            const tabColors = {
              profile: { bg: 'rgba(232,172,101,0.12)', text: '#e8ac65', border: 'rgba(232,172,101,0.2)' },
              stats: { bg: 'rgba(90,180,230,0.12)', text: '#5ab4e6', border: 'rgba(90,180,230,0.2)' },
              career: { bg: 'rgba(155,155,122,0.12)', text: '#9b9b7a', border: 'rgba(155,155,122,0.2)' },
            };
            const c = tabColors[t.key];
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  padding: 'clamp(8px, 1.2vw, 14px) clamp(14px, 2vw, 28px)',
                  borderRadius: 16,
                  fontSize: 'clamp(0.8rem, 1vw, 1rem)',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  border: 'none',
                  background: isActive ? c.bg : 'transparent',
                  color: isActive ? c.text : '#997b66',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}>
                <Icon size={20} style={{marginRight: 8, display: 'inline', verticalAlign: 'middle'}} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-5 lg:p-8 overflow-y-auto v2-scrollbar flex-1 min-h-0">
          {tab === 'profile' && (
            <div className="space-y-5">
              <div className="glass-card-static p-4">
                <SectionTitle icon={User} color="#e8ac65" subtitle="Información básica del jugador">
                  Información General
                </SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-5">
                {portero.dateOfBirth && (
                  <div className="glass-card-static p-3 lg:p-4 text-center">
                    <p className="text-xs lg:text-sm" style={{color: '#997b66'}}>Edad</p>
                    <p className="text-lg lg:text-xl font-bold" style={{color: '#f1ede7'}}>{age || '-'} años</p>
                  </div>
                )}
                {portero.height && (
                  <div className="glass-card-static p-3 lg:p-4 text-center">
                    <p className="text-xs lg:text-sm" style={{color: '#997b66'}}>Altura</p>
                    <p className="text-lg lg:text-xl font-bold" style={{color: '#f1ede7'}}>{portero.height} cm</p>
                  </div>
                )}
                {portero.preferredFoot && (
                  <div className="glass-card-static p-3 lg:p-4 text-center">
                    <p className="text-xs lg:text-sm" style={{color: '#997b66'}}>Lateralidad</p>
                    <p className="text-lg lg:text-xl font-bold" style={{color: '#f1ede7'}}>{portero.preferredFoot}</p>
                  </div>
                )}
                {portero.nationality && (
                  <div className="glass-card-static p-3 lg:p-4 text-center">
                    <p className="text-xs lg:text-sm" style={{color: '#997b66'}}>Nacionalidad</p>
                    <div className="flex items-center justify-center gap-2">
                      {portero.nationalityFlag && (
                        <img src={`https://flagcdn.com/24x18/${portero.nationalityFlag.toLowerCase()}.png`}
                          alt="" className="w-5 lg:w-6" />
                      )}
                      <p className="text-lg lg:text-xl font-bold" style={{color: '#f1ede7'}}>{portero.nationality}</p>
                    </div>
                  </div>
                )}
              </div>
              </div>

              <div className="glass-card-static p-4">
                <SectionTitle icon={Star} color="#e8ac65" subtitle="Valoración global del jugador">
                  Valoración Personal
                </SectionTitle>
                <div className="flex items-center justify-between">
                  <StarRating value={rating} onChange={handleRatingChange} size={22} />
                  <span className="text-xs" style={{color: '#997b66'}}>
                    {rating === 0 ? 'Sin valorar' : `${rating} / 5`}
                  </span>
                </div>
              </div>

              <div className="glass-card-static p-4">
                <div className="flex items-center justify-between mb-4 pb-3" style={{borderBottom: '1px solid rgba(167,139,250,0.08)'}}>
                  <div className="flex items-center gap-2">
                    <Star size={16} style={{color: '#a78bfa'}} />
                    <h4 className="text-sm font-semibold tracking-wide" style={{color: '#f1ede7'}}>Atributos Personalizados</h4>
                  </div>
                  <div className="flex items-center gap-2 relative">
                    {compareGk && (
                      <button onClick={() => setCompareGk(null)} className="v2-btn-ghost text-xs py-1 px-2" style={{color: '#d08c60'}}>
                        <X size={12} /> Cerrar
                      </button>
                    )}
                    <button onClick={loadCompareGk} className="v2-btn-ghost text-xs py-1 px-2">
                      <GitCompare size={12} /> Comparar
                    </button>
                    {showGkList && (
                      <div ref={dropdownRef} className="absolute top-full right-0 mt-1 z-50 w-56 rounded-xl p-2 shadow-xl" style={{background: '#1a1815', border: '1px solid rgba(185,165,135,0.15)'}}>
                        <input type="text" placeholder="Buscar portero..." value={searchGkQuery}
                          onChange={e => setSearchGkQuery(e.target.value)}
                          className="v2-input w-full text-xs py-1.5 px-2.5 mb-1" autoFocus />
                        <div className="max-h-40 overflow-y-auto v2-scrollbar space-y-0.5">
                          {gkList.filter(g => g.name.toLowerCase().includes(searchGkQuery.toLowerCase())).map(gk => (
                            <button key={gk.id} onClick={() => { selectCompareGk(gk); setSearchGkQuery(''); }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all"
                              style={{color: '#f1ede7', background: 'rgba(22,20,16,0.4)'}}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,172,101,0.08)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(22,20,16,0.4)'}>
                              {gk.name}
                            </button>
                          ))}
                          {gkList.filter(g => g.name.toLowerCase().includes(searchGkQuery.toLowerCase())).length === 0 && (
                            <p className="text-xs text-center py-2" style={{color: '#997b66'}}>Sin resultados</p>
                          )}
                        </div>
                      </div>
                    )}
                    <button onClick={() => setEditing(e => !e)}
                      className="v2-btn-ghost text-xs py-1 px-3">
                      {editing ? 'Hecho' : 'Editar'}
                    </button>
                  </div>
                </div>
                <div className={compareGk ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
                  <div>
                    <p className="text-xs text-center mb-1 font-medium" style={{color: '#e8ac65'}}>{portero.name}</p>
                    <CustomRadarChart data={attrs} />
                  </div>
                  {compareGk && (
                    <div>
                      <p className="text-xs text-center mb-1 font-medium" style={{color: '#5ab4e6'}}>{compareGk.name}</p>
                      <CustomRadarChart data={compareGk.customAttributes || []} color="#5ab4e6" />
                    </div>
                  )}
                </div>
                {editing && (
                  <div className="mt-3 pt-3 space-y-1" style={{borderTop: '1px solid rgba(185,165,135,0.08)'}}>
                    {attrs.map((attr, i) => (
                      <div key={i} className="flex items-center gap-2 py-0.5">
                        <button onClick={() => handleDeleteAttr(i)}
                          className="p-1 rounded-lg shrink-0 cursor-pointer transition-colors"
                          style={{color: '#d08c60'}}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(208,140,96,0.12)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <Trash2 size={14} />
                        </button>
                        <span className="text-sm whitespace-nowrap shrink-0 text-right" style={{color: '#baa587', width: maxAttrWidth}}>{attr.name}</span>
                        <input type="range" min="0" max="100" value={attr.value}
                          onChange={e => handleEditAttr(i, parseInt(e.target.value))}
                          className="v2-rpe" style={{flex: '1 1 auto', minWidth: 0}} />
                        <span className="text-sm font-bold w-8 text-right shrink-0" style={{color: '#e8ac65'}}>{attr.value}</span>
                      </div>
                    ))}
                    <button onClick={handleAddAttr}
                      className="flex items-center gap-1.5 w-full justify-center py-2 mt-2 rounded-xl text-xs font-medium transition-all cursor-pointer"
                      style={{
                        background: 'rgba(232,172,101,0.06)',
                        border: '1px dashed rgba(232,172,101,0.2)',
                        color: '#e8ac65',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,172,101,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(232,172,101,0.06)'}>
                      <Plus size={14} />
                      Añadir atributo
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'stats' && (
            <SofaScoreStats
              careerData={careerData}
              heatmapData={heatmapData}
              loadingHeatmap={loadingHeatmap}
              compareGk={compareGk}
              compareRadarData={compareGk ? (() => {
                const cd = compareGk.sofascoreData?.career;
                if (!cd?.length) return [];
                const st = cd[0]?.statistics || {};
                const apps = st.appearances || 0;
                return [
                  { name: 'Paradas', value: (st.saves + st.goalsConceded) > 0 ? Math.round((st.saves / (st.saves + st.goalsConceded)) * 100) : 0 },
                  { name: 'Precisión', value: Math.round(st.accuratePassesPercentage || 0) },
                  { name: 'P. Largos', value: st.totalLongBalls ? Math.round((st.accurateLongBalls / st.totalLongBalls) * 100) : 0 },
                  { name: 'J. Aéreo', value: st.aerialDuelsWon ? Math.min(100, st.aerialDuelsWon * 10) : 0 },
                  { name: 'Penaltis', value: st.penaltyFaced ? Math.round((st.penaltySave / st.penaltyFaced) * 100) : 0 },
                  { name: 'Clean Sheet', value: apps ? Math.round((st.cleanSheet / apps) * 100) : 0 },
                ];
              })() : null}
              onCompare={() => loadCompareGk()}
              onCloseCompare={() => setCompareGk(null)}
              dropdownRef={dropdownRef}
              porteroName={portero.name}
              compareGkName={compareGk?.name || ''}
              showGkList={showGkList}
              searchGkQuery={searchGkQuery}
              setSearchGkQuery={setSearchGkQuery}
              gkList={gkList}
              selectCompareGk={selectCompareGk}
            />
          )}

          {tab === 'career' && (
            <div className="glass-card-static p-4">
              <SectionTitle icon={Briefcase} color="#9b9b7a" subtitle="Historial por temporadas">
                Carrera Deportiva
              </SectionTitle>
              <CareerTable careerData={careerData} />
            </div>
          )}
        </div>

        <div className="p-4 lg:p-5 flex justify-between" style={{borderTop: '1px solid rgba(185,165,135,0.08)'}}>
          <button onClick={onDelete} className="v2-btn-danger text-xs lg:text-sm py-2 lg:py-2.5 px-4 lg:px-6">
            Eliminar Portero
          </button>
          <button onClick={onClose} className="v2-btn-ghost text-xs lg:text-sm py-2 lg:py-2.5 px-4 lg:px-6">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}