import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BarChart3 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const MD_ORDER = ['MD-5', 'MD-4', 'MD-3', 'MD-2', 'MD-1', 'MD', 'MD+1'];

const PORTERO_COLORS = [
  '#ef4444',
  '#eab308',
  '#3b82f6',
  '#c084fc',
];

function computeRPEAvg(rpePorteros) {
  const values = Object.values(rpePorteros || {}).filter(v => v > 0);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function parseMicrocicloNum(m) {
  const n = parseInt(m, 10);
  return isNaN(n) ? 0 : n;
}

function matchGoalkeeperName(goalkeeperName, shortName) {
  const normalize = s => s.toUpperCase().normalize('NFKD').replace(/[^\w\s]/g, '');
  const full = normalize(goalkeeperName);
  const short = normalize(shortName);
  return full.includes(short);
}

function getLastMicrociclo(microciclos) {
  const sorted = [...microciclos].sort((a, b) => parseMicrocicloNum(b) - parseMicrocicloNum(a));
  return sorted[0] || '';
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const validPayload = payload.filter(p => p.value !== null && p.value !== undefined);
  if (validPayload.length === 0) return null;
  return (
    <div className="bg-gk-page border border-gk-border rounded-lg px-3 py-2 shadow-lg">
      <div className="text-xs text-gk-text-tertiary mb-1 font-medium">{label}</div>
      {validPayload.map((entry, idx) => (
        <div key={idx} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(1)}
        </div>
      ))}
    </div>
  );
}

function buildAggregatedChartData(sessionsList, allPorteros, analyses = [], seasonId = null, microciclo = null) {
  return MD_ORDER.map(md => {
    if (md === 'MD') {
      const row = { dia: md, rpe: null, sessionId: null };
      allPorteros.forEach(p => {
        row[`portero_${p}`] = null;
      });

      if (microciclo && seasonId) {
        const match = analyses.find(
          a => String(a.microciclo || '').trim() === String(microciclo).trim()
            && a.seasonId === seasonId
            && !a.deletedAt
        );
        if (match && match.rpe > 0) {
            row.rpe = match.rpe;
            row.matchName = match.matchName || null;
            row.opponent = match.opponent || null;
            const gkName = String(match.goalkeeperName || '').trim();
            if (gkName) {
              const matchedP = allPorteros.find(p => matchGoalkeeperName(gkName, p));
              if (matchedP) {
                row[`portero_${matchedP}`] = match.rpe;
              }
            }
          }
      } else if (seasonId) {
        const seasonMatches = analyses.filter(
          a => a.seasonId === seasonId && !a.deletedAt && a.rpe > 0
        );
        if (seasonMatches.length > 0) {
          row.rpe = seasonMatches.reduce((sum, a) => sum + a.rpe, 0) / seasonMatches.length;
        }
      }

      return row;
    }

    const sessionsForMd = sessionsList.filter(
      s => String(s.templateFields?.tipoMD || '').trim() === md
    );

    const row = { dia: md, rpe: null, sessionId: null };
    allPorteros.forEach(p => {
      row[`portero_${p}`] = null;
    });

    if (sessionsForMd.length === 0) return row;

    row.sessionId = sessionsForMd[0].id;

    const allRPEValues = [];
    sessionsForMd.forEach(s => {
      Object.values(s.rpePorteros || {}).forEach(v => {
        if (v > 0) allRPEValues.push(v);
      });
    });
    if (allRPEValues.length > 0) {
      row.rpe = allRPEValues.reduce((a, b) => a + b, 0) / allRPEValues.length;
    }

    allPorteros.forEach(p => {
      const values = sessionsForMd
        .map(s => s.rpePorteros?.[p])
        .filter(v => v > 0);
      if (values.length > 0) {
        row[`portero_${p}`] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    });

    return row;
  });
}

function buildTimelineChartData(sessionsList, allPorteros) {
  const sorted = [...sessionsList]
    .filter(s => s.date && !s.deletedAt)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return sorted.map((session, idx) => {
    const tipo = session.templateFields?.tipoMD || '';
    const row = {
      id: session.id,
      idx,
      dia: tipo,
      rpe: null,
    };
    allPorteros.forEach(p => {
      row[`portero_${p}`] = null;
    });

    row.rpe = computeRPEAvg(session.rpePorteros);
    allPorteros.forEach(p => {
      const val = session.rpePorteros?.[p];
      row[`portero_${p}`] = val > 0 ? val : null;
    });

    return row;
  });
}

export default function RPEStatsModal({ sessions, analyses = [], seasonName, onClose }) {
  const [viewMode, setViewMode] = useState('unico');
  const [tramoView, setTramoView] = useState('media');
  const [hiddenLines, setHiddenLines] = useState(new Set(['rpe']));

  const microciclos = useMemo(() => {
    const set = new Set();
    sessions.forEach(s => {
      const mc = String(s.templateFields?.microciclo || '').trim();
      if (mc) set.add(mc);
    });
    return Array.from(set);
  }, [sessions]);

  const microciclosDesc = useMemo(() => {
    return [...microciclos].sort((a, b) => parseMicrocicloNum(b) - parseMicrocicloNum(a));
  }, [microciclos]);

  const [selectedMicrociclo, setSelectedMicrociclo] = useState(() => getLastMicrociclo(microciclos));
  const [rangeStart, setRangeStart] = useState(() => {
    const sorted = [...microciclos].sort((a, b) => parseMicrocicloNum(a) - parseMicrocicloNum(b));
    return sorted[0] || '';
  });
  const [rangeEnd, setRangeEnd] = useState(() => getLastMicrociclo(microciclos));

  const allPorteros = useMemo(() => {
    const set = new Set();
    sessions.forEach(s => {
      Object.keys(s.rpePorteros || {}).forEach(name => set.add(name));
    });
    return Array.from(set);
  }, [sessions]);

  useEffect(() => {
    setHiddenLines(new Set(['rpe']));
  }, [allPorteros]);

  const porteroColorMap = useMemo(() => {
    const map = {};
    allPorteros.forEach((p, i) => {
      map[p] = PORTERO_COLORS[i % PORTERO_COLORS.length];
    });
    return map;
  }, [allPorteros]);

  const isAggregated = viewMode === 'unico' || viewMode === 'temporada' || (viewMode === 'tramo' && tramoView === 'media');
  const showSesionCol = viewMode !== 'temporada';

  function toggleLine(key) {
    setHiddenLines(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      if (next.size >= allPorteros.length + 1) {
        return new Set();
      }
      return next;
    });
  }

  const seasonId = useMemo(() => {
    for (const s of sessions) {
      if (s.seasonId) return s.seasonId;
    }
    return null;
  }, [sessions]);

  const chartData = useMemo(() => {
    if (viewMode === 'unico') {
      const selectedMc = String(selectedMicrociclo).trim();
      const sessionsInMicro = sessions.filter(
        s => String(s.templateFields?.microciclo || '').trim() === selectedMc && !s.deletedAt
      );
      return buildAggregatedChartData(sessionsInMicro, allPorteros, analyses, seasonId, selectedMc);
    }

    let filtered = sessions.filter(s => !s.deletedAt);

    if (viewMode === 'tramo') {
      const start = parseMicrocicloNum(rangeStart);
      const end = parseMicrocicloNum(rangeEnd);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      filtered = filtered.filter(s => {
        const mc = parseMicrocicloNum(s.templateFields?.microciclo);
        return mc >= min && mc <= max;
      });
      if (tramoView === 'evolucion') {
        return buildTimelineChartData(filtered, allPorteros);
      }
    }

    // For tramo/temporada views without a single microciclo, pass microciclo=null
    // so buildAggregatedChartData averages all match RPEs for the season
    return buildAggregatedChartData(filtered, allPorteros, analyses, seasonId, null);
  }, [sessions, analyses, seasonId, viewMode, selectedMicrociclo, rangeStart, rangeEnd, tramoView, allPorteros]);

  const stats = useMemo(() => {
    const values = chartData.map(d => d.rpe).filter(v => v !== null);
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { avg: avg.toFixed(1), min: min.toFixed(1), max: max.toFixed(1), count: values.length };
  }, [chartData]);

  const chartTitle = useMemo(() => {
    if (viewMode === 'unico') {
      return `Evolución de RPE. Microciclo ${selectedMicrociclo}.`;
    }
    if (viewMode === 'tramo') {
      const s = parseMicrocicloNum(rangeStart);
      const e = parseMicrocicloNum(rangeEnd);
      const from = Math.min(s, e);
      const to = Math.max(s, e);
      if (tramoView === 'evolucion') {
        return `Evolución de microciclo ${from} a ${to}.`;
      }
      return `Evolución por tramo. De microciclo ${from} a ${to}.`;
    }
    return `Evolución durante la temporada ${seasonName || ''}.`;
  }, [viewMode, selectedMicrociclo, rangeStart, rangeEnd, seasonName, tramoView]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.8)'}}>
      <div className="glass-card-static w-full max-w-5xl max-h-[90vh] flex flex-col" style={{borderRadius: 24}}>
        <div className="p-5 flex items-center justify-between shrink-0" style={{borderBottom: '1px solid rgba(185,165,135,0.08)'}}>
          <div className="flex items-center gap-2">
            <BarChart3 size={20} style={{color: '#e8ac65'}} />
            <h2 className="text-lg font-bold" style={{color: '#f1ede7'}}>Estadísticas RPE</h2>
          </div>
          <button onClick={onClose} className="v2-btn-ghost p-1.5 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 v2-scrollbar">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium" style={{color: '#baa587'}}>Vista</label>
            <div className="flex p-1 rounded-xl" style={{background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)'}}>
              {[
                { key: 'unico', label: 'Único' },
                { key: 'tramo', label: 'Tramo' },
                { key: 'temporada', label: 'Temporada' },
              ].map(mode => (
                <button
                  key={mode.key}
                  onClick={() => setViewMode(mode.key)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 10,
                    fontSize: '0.875rem',
                    fontWeight: viewMode === mode.key ? 600 : 400,
                    border: 'none',
                    cursor: 'pointer',
                    background: viewMode === mode.key ? 'rgba(232,172,101,0.10)' : 'transparent',
                    color: viewMode === mode.key ? '#e8ac65' : '#997b66',
                    transition: 'all 0.2s',
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {viewMode === 'unico' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium" style={{color: '#baa587'}}>Microciclo</label>
              <select
                value={selectedMicrociclo}
                onChange={e => setSelectedMicrociclo(e.target.value)}
                className="v2-select"
              >
                {microciclos.length === 0 && <option value="">Sin microciclos</option>}
                {microciclosDesc.map(mc => (
                  <option key={mc} value={mc}>Microciclo {mc}</option>
                ))}
              </select>
            </div>
          )}

          {viewMode === 'tramo' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium" style={{color: '#baa587'}}>Tramo</label>
                <select
                  value={rangeStart}
                  onChange={e => setRangeStart(e.target.value)}
                  className="v2-select"
                >
                  {microciclosDesc.map(mc => (
                    <option key={`start-${mc}`} value={mc}>Microciclo {mc}</option>
                  ))}
                </select>
                <span style={{color: '#997b66'}}>→</span>
                <select
                  value={rangeEnd}
                  onChange={e => setRangeEnd(e.target.value)}
                  className="v2-select"
                >
                  {microciclosDesc.map(mc => (
                    <option key={`end-${mc}`} value={mc}>Microciclo {mc}</option>
                  ))}
                </select>
              </div>
              <div className="flex p-1 rounded-xl" style={{background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)'}}>
                {[
                  { key: 'media', label: 'Media por día' },
                  { key: 'evolucion', label: 'Evolución completa' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setTramoView(opt.key)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 10,
                      fontSize: '0.875rem',
                      fontWeight: tramoView === opt.key ? 600 : 400,
                      border: 'none',
                      cursor: 'pointer',
                      background: tramoView === opt.key ? 'rgba(232,172,101,0.10)' : 'transparent',
                      color: tramoView === opt.key ? '#e8ac65' : '#997b66',
                      transition: 'all 0.2s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stats && (
            <div className="grid grid-cols-4 gap-3">
              <div className="p-4 rounded-xl text-center" style={{background: 'rgba(232,172,101,0.06)', border: '1px solid rgba(232,172,101,0.12)'}}>
                <div className="text-xs uppercase tracking-wider" style={{color: '#e8ac65'}}>Media</div>
                <div className="text-2xl font-bold mt-1" style={{color: '#e8ac65', fontFamily: "'JetBrains Mono', monospace"}}>{stats.avg}</div>
              </div>
              <div className="p-4 rounded-xl text-center" style={{background: 'rgba(61,214,140,0.06)', border: '1px solid rgba(61,214,140,0.12)'}}>
                <div className="text-xs uppercase tracking-wider" style={{color: '#3dd68c'}}>Mín</div>
                <div className="text-2xl font-bold mt-1" style={{color: '#3dd68c', fontFamily: "'JetBrains Mono', monospace"}}>{stats.min}</div>
              </div>
              <div className="p-4 rounded-xl text-center" style={{background: 'rgba(224,74,74,0.06)', border: '1px solid rgba(224,74,74,0.12)'}}>
                <div className="text-xs uppercase tracking-wider" style={{color: '#e04a4a'}}>Máx</div>
                <div className="text-2xl font-bold mt-1" style={{color: '#e04a4a', fontFamily: "'JetBrains Mono', monospace"}}>{stats.max}</div>
              </div>
              <div className="p-4 rounded-xl text-center" style={{background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)'}}>
                <div className="text-xs uppercase tracking-wider" style={{color: '#baa587'}}>Sesiones</div>
                <div className="text-2xl font-bold mt-1" style={{color: '#f1ede7', fontFamily: "'JetBrains Mono', monospace"}}>{stats.count}</div>
              </div>
            </div>
          )}

          <div className="p-5 rounded-xl" style={{background: 'rgba(22,20,16,0.4)', border: '1px solid rgba(185,165,135,0.08)'}}>
            <div className="text-center text-base font-semibold mb-4" style={{color: '#f1ede7'}}>
              {chartTitle}
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart key={chartData.length} data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(185,165,135,0.06)" />
                  <XAxis
                    dataKey="dia"
                    stroke="#997b66"
                    tick={{ fill: '#997b66', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(185,165,135,0.10)' }}
                    interval={0}
                  />
                  <YAxis
                    domain={[1, 10]}
                    ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                    stroke="#997b66"
                    tick={{ fill: '#997b66', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(185,165,135,0.10)' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={5} stroke="rgba(185,165,135,0.15)" strokeDasharray="3 3" />
                  {allPorteros.map(p => (
                    <Line
                      key={p}
                      type="monotone"
                      dataKey={`portero_${p}`}
                      name={p}
                      stroke={porteroColorMap[p]}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={false}
                      connectNulls={true}
                      hide={hiddenLines.has(`portero_${p}`)}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="rpe"
                    name="Media"
                    stroke="#e8ac65"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#0c0b09', stroke: '#e8ac65', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#e8ac65', stroke: '#0c0b09', strokeWidth: 2 }}
                    connectNulls={true}
                    hide={hiddenLines.has('rpe')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <div
                className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${hiddenLines.has('rpe') ? 'opacity-30' : ''}`}
                onClick={() => toggleLine('rpe')}
              >
                <span className="w-4 h-1 rounded-full" style={{background: '#e8ac65'}} />
                <span className="text-xs font-medium" style={{color: '#baa587'}}>Media</span>
              </div>
              {allPorteros.map(p => (
                <div
                  key={p}
                  className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${hiddenLines.has(`portero_${p}`) ? 'opacity-30' : ''}`}
                  onClick={() => toggleLine(`portero_${p}`)}
                >
                  <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: porteroColorMap[p] }} />
                  <span className="text-xs" style={{color: '#baa587'}}>{p}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl overflow-hidden" style={{border: '1px solid rgba(185,165,135,0.08)', background: 'rgba(22,20,16,0.4)'}}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{borderBottom: '1px solid rgba(185,165,135,0.06)'}}>
                  {!isAggregated && (
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#997b66'}}>Fecha</th>
                  )}
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#997b66'}}>Día</th>
                  {showSesionCol && (
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#997b66'}}>Sesión</th>
                  )}
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider" style={{color: '#997b66'}}>RPE Medio</th>
                  {allPorteros.map(p => (
                    <th key={p} className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider" style={{color: '#997b66'}}>{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => {
                  const avg = row.rpe !== null ? row.rpe.toFixed(1) : '—';
                  const avgColor = row.rpe === null ? '#997b66' : row.rpe <= 3 ? '#3dd68c' : row.rpe <= 6 ? '#e8ac65' : '#e04a4a';

                  const session = !isAggregated
                    ? sessions.find(s => s.id === row.id && !s.deletedAt)
                    : (row.sessionId ? sessions.find(s => s.id === row.sessionId && !s.deletedAt) : null);

                  const isMdRow = row.dia === 'MD';

                  return (
                    <tr key={isAggregated ? row.dia : row.id} style={{borderBottom: '1px solid rgba(185,165,135,0.04)', background: isMdRow ? 'rgba(232,172,101,0.04)' : 'transparent'}}>
                      {!isAggregated && (
                        <td className="px-4 py-2.5" style={{color: '#997b66'}}>
                          {session ? new Date(session.date).toLocaleDateString('es-ES') : '—'}
                        </td>
                      )}
                      <td className="px-4 py-2.5 font-medium" style={{color: '#f1ede7'}}>{row.dia}</td>
                      {showSesionCol && (
                        <td className="px-4 py-2.5" style={{color: '#997b66'}}>
                          {session ? session.name : isMdRow ? (row.matchName ? `${row.matchName}` : 'Partido') : '—'}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right font-bold" style={{color: avgColor}}>{avg}</td>
                      {allPorteros.map(p => {
                        const val = row[`portero_${p}`];
                        const display = val !== null && val !== undefined ? val.toFixed(1) : '—';
                        const color = val === null || val === undefined ? '#997b66' : val <= 3 ? '#3dd68c' : val <= 6 ? '#e8ac65' : '#e04a4a';
                        return (
                          <td key={p} className="px-4 py-2.5 text-right font-medium" style={{color}}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {stats === null && (
            <div className="text-center py-8" style={{color: '#997b66'}}>
              <p className="text-lg mb-1">No hay datos de RPE</p>
              <p className="text-sm">No se encontraron sesiones con RPE registrado para esta selección</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
