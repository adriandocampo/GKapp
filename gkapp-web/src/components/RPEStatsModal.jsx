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

const MD_ORDER = ['MD-5', 'MD-4', 'MD-3', 'MD-2', 'MD-1', 'MD+1'];

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

function getLastMicrociclo(microciclos) {
  const sorted = [...microciclos].sort((a, b) => parseMicrocicloNum(b) - parseMicrocicloNum(a));
  return sorted[0] || '';
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const validPayload = payload.filter(p => p.value !== null && p.value !== undefined);
  if (validPayload.length === 0) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <div className="text-xs text-slate-400 mb-1 font-medium">{label}</div>
      {validPayload.map((entry, idx) => (
        <div key={idx} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(1)}
        </div>
      ))}
    </div>
  );
}

function buildAggregatedChartData(sessionsList, allPorteros) {
  return MD_ORDER.map(md => {
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

export default function RPEStatsModal({ sessions, seasonName, onClose }) {
  const [viewMode, setViewMode] = useState('unico');
  const [tramoView, setTramoView] = useState('media');
  const [hiddenLines, setHiddenLines] = useState(new Set());

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
    setHiddenLines(new Set());
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

  const chartData = useMemo(() => {
    if (viewMode === 'unico') {
      const selectedMc = String(selectedMicrociclo).trim();
      const sessionsInMicro = sessions.filter(
        s => String(s.templateFields?.microciclo || '').trim() === selectedMc && !s.deletedAt
      );
      return buildAggregatedChartData(sessionsInMicro, allPorteros);
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

    return buildAggregatedChartData(filtered, allPorteros);
  }, [sessions, viewMode, selectedMicrociclo, rangeStart, rangeEnd, tramoView, allPorteros]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-teal-400" />
            <h2 className="text-lg font-bold text-slate-100">Estadísticas RPE</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-300">Vista</label>
            <div className="flex bg-slate-900/50 rounded-lg p-1 border border-slate-700/50">
              {[
                { key: 'unico', label: 'Único' },
                { key: 'tramo', label: 'Tramo' },
                { key: 'temporada', label: 'Temporada' },
              ].map(mode => (
                <button
                  key={mode.key}
                  onClick={() => setViewMode(mode.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === mode.key
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {viewMode === 'unico' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-300">Microciclo</label>
              <select
                value={selectedMicrociclo}
                onChange={e => setSelectedMicrociclo(e.target.value)}
                className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-teal-500/50 transition-colors cursor-pointer"
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
                <label className="text-sm font-medium text-slate-300">Tramo</label>
                <select
                  value={rangeStart}
                  onChange={e => setRangeStart(e.target.value)}
                  className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-teal-500/50 transition-colors cursor-pointer"
                >
                  {microciclosDesc.map(mc => (
                    <option key={`start-${mc}`} value={mc}>Microciclo {mc}</option>
                  ))}
                </select>
                <span className="text-slate-500">→</span>
                <select
                  value={rangeEnd}
                  onChange={e => setRangeEnd(e.target.value)}
                  className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-teal-500/50 transition-colors cursor-pointer"
                >
                  {microciclosDesc.map(mc => (
                    <option key={`end-${mc}`} value={mc}>Microciclo {mc}</option>
                  ))}
                </select>
              </div>
              <div className="flex bg-slate-900/50 rounded-lg p-1 border border-slate-700/50">
                {[
                  { key: 'media', label: 'Media por día' },
                  { key: 'evolucion', label: 'Evolución completa' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setTramoView(opt.key)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      tramoView === opt.key
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stats && (
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Media</div>
                <div className="text-xl font-bold text-teal-400 mt-1">{stats.avg}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Mín</div>
                <div className="text-xl font-bold text-green-400 mt-1">{stats.min}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Máx</div>
                <div className="text-xl font-bold text-red-400 mt-1">{stats.max}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Sesiones</div>
                <div className="text-xl font-bold text-slate-200 mt-1">{stats.count}</div>
              </div>
            </div>
          )}

          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
            <div className="text-center text-base font-semibold text-slate-100 mb-4">
              {chartTitle}
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart key={chartData.length} data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="dia"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#475569' }}
                    interval={0}
                  />
                  <YAxis
                    domain={[1, 10]}
                    ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#475569' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={5} stroke="#64748b" strokeDasharray="3 3" />
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
                      connectNulls={false}
                      hide={hiddenLines.has(`portero_${p}`)}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="rpe"
                    name="Media"
                    stroke="#2dd4bf"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#0f172a', stroke: '#2dd4bf', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#2dd4bf', stroke: '#0f172a', strokeWidth: 2 }}
                    connectNulls={false}
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
                <span className="w-4 h-1 rounded-full bg-teal-400" />
                <span className="text-xs text-slate-300 font-medium">Media</span>
              </div>
              {allPorteros.map(p => (
                <div
                  key={p}
                  className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${hiddenLines.has(`portero_${p}`) ? 'opacity-30' : ''}`}
                  onClick={() => toggleLine(`portero_${p}`)}
                >
                  <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: porteroColorMap[p] }} />
                  <span className="text-xs text-slate-300">{p}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {!isAggregated && (
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha</th>
                  )}
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Día</th>
                  {showSesionCol && (
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sesión</th>
                  )}
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">RPE Medio</th>
                  {allPorteros.map(p => (
                    <th key={p} className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => {
                  const avg = row.rpe !== null ? row.rpe.toFixed(1) : '—';
                  const avgColor =
                    row.rpe === null
                      ? 'text-slate-500'
                      : row.rpe <= 3
                        ? 'text-green-400'
                        : row.rpe <= 6
                          ? 'text-yellow-400'
                          : 'text-red-400';

                  const session = !isAggregated
                    ? sessions.find(s => s.id === row.id && !s.deletedAt)
                    : (row.sessionId ? sessions.find(s => s.id === row.sessionId && !s.deletedAt) : null);

                  return (
                    <tr key={isAggregated ? row.dia : row.id} className="border-b border-slate-700/30 last:border-0">
                      {!isAggregated && (
                        <td className="px-4 py-2.5 text-slate-400">
                          {session ? new Date(session.date).toLocaleDateString('es-ES') : '—'}
                        </td>
                      )}
                      <td className="px-4 py-2.5 font-medium text-slate-200">{row.dia}</td>
                      {showSesionCol && (
                        <td className="px-4 py-2.5 text-slate-400">
                          {session ? session.name : '—'}
                        </td>
                      )}
                      <td className={`px-4 py-2.5 text-right font-bold ${avgColor}`}>{avg}</td>
                      {allPorteros.map(p => {
                        const val = row[`portero_${p}`];
                        const display = val !== null && val !== undefined ? val.toFixed(1) : '—';
                        const color =
                          val === null || val === undefined
                            ? 'text-slate-500'
                            : val <= 3
                              ? 'text-green-400'
                              : val <= 6
                                ? 'text-yellow-400'
                                : 'text-red-400';
                        return (
                          <td key={p} className={`px-4 py-2.5 text-right font-medium ${color}`}>
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
            <div className="text-center py-8 text-slate-500">
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
