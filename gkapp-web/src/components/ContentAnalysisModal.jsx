import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, PieChart as PieChartIcon } from 'lucide-react';
import { db } from '../db';

const CATEGORY_COLORS = {
  'Agarres': '#4c85ed',
  'Desvíos': '#e25252',
  '1c1': '#33b960',
  'Coberturas': '#e1ae1f',
  'Juego ofensivo': '#c08df8',
  'Velocidad de reacción': '#ef7928',
};

const SITUATION_COLORS = {
  'Centro lateral': '#4c85ed',
  'Centro lateral cercano': '#e25252',
  'Tiro cercano': '#33b960',
  'Tiro lejano': '#e1ae1f',
};

const DIMENSION_COLORS = {
  'Defensa de portería': '#4c85ed',
  'Defensa de espacio': '#33b960',
  'Juego ofensivo': '#c08df8',
};

const OTHER_COLOR = '#6b7280';
const EMPTY_CELL = 'rgba(185,165,135,0.06)';

function WaffleChart({ data, total }) {
  const cells = [];
  let idx = 0;

  for (const item of data) {
    const count = Math.round((item.value / total) * 100);
    for (let i = 0; i < count && idx < 100; i++) {
      cells.push({ color: item.color, label: item.name, idx: idx++ });
    }
  }
  while (idx < 100) {
    cells.push({ color: EMPTY_CELL, label: '', idx: idx++ });
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(10, 1fr)',
        gap: 2,
      }}
    >
      {cells.map(cell => (
        <div
          key={cell.idx}
          title={cell.label}
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: 2,
            backgroundColor: cell.color,
          }}
        />
      ))}
    </div>
  );
}

export default function ContentAnalysisModal({ sessions, seasonName, onClose }) {
  const [taskMap, setTaskMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [timelineView, setTimelineView] = useState('dimensiones');

  useEffect(() => {
    let cancelled = false;
    async function loadTasks() {
      const taskIds = new Set();
      sessions.forEach(s => (s.tasks || []).forEach(tid => taskIds.add(tid)));
      if (taskIds.size === 0) {
        if (!cancelled) setLoading(false);
        return;
      }
      const tasks = await db.tasks.where('id').anyOf([...taskIds]).toArray();
      const map = {};
      tasks.forEach(t => { map[t.id] = t; });
      if (!cancelled) {
        setTaskMap(map);
        setLoading(false);
      }
    }
    loadTasks();
    return () => { cancelled = true; };
  }, [sessions]);

  const { categoryData, dimensionData, situationData } = useMemo(() => {
    if (loading || Object.keys(taskMap).length === 0 && sessions.some(s => (s.tasks || []).length > 0)) {
      return { categoryData: [], dimensionData: [], situationData: [] };
    }

    const catCount = {};
    const dimCount = {};
    const sitCount = {};

    const sessionList = [...sessions]
      .filter(s => s.date && !s.deletedAt);

    sessionList.forEach(session => {
      const tasks = (session.tasks || [])
        .map(tid => {
          const t = taskMap[tid];
          if (!t) return null;
          const normalized = { ...t };
          if (typeof normalized.category === 'string') {
            normalized.category = normalized.category ? [normalized.category] : [];
          }
          if (!Array.isArray(normalized.dimension)) {
            normalized.dimension = normalized.dimension ? [normalized.dimension] : [];
          }
          if (typeof normalized.situation === 'string') {
            normalized.situation = normalized.situation && normalized.situation !== 'Otro' ? [normalized.situation] : [];
          }
          if (!Array.isArray(normalized.situation)) normalized.situation = [];
          return normalized;
        })
        .filter(Boolean);

      tasks.forEach(task => {
        const cats = Array.isArray(task.category) && task.category.length > 0 ? task.category : ['Otras'];
        cats.forEach(cat => {
          catCount[cat] = (catCount[cat] || 0) + 1;
        });

        const dimensions = Array.isArray(task.dimension) ? task.dimension : [];
        dimensions.forEach(dim => {
          if (dim) dimCount[dim] = (dimCount[dim] || 0) + 1;
        });

        const situations = Array.isArray(task.situation) ? task.situation : [];
        situations.forEach(sit => {
          if (sit) sitCount[sit] = (sitCount[sit] || 0) + 1;
        });
      });
    });

    const totalCat = Object.values(catCount).reduce((a, b) => a + b, 0);
    const totalDim = Object.values(dimCount).reduce((a, b) => a + b, 0);
    const totalSit = Object.values(sitCount).reduce((a, b) => a + b, 0);

    const categoryData = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        total: totalCat,
        color: CATEGORY_COLORS[name] || OTHER_COLOR,
      }));

    const dimensionData = Object.entries(dimCount)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        total: totalDim,
        color: DIMENSION_COLORS[name] || OTHER_COLOR,
      }));

    const situationData = Object.entries(sitCount)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        total: totalSit,
        color: SITUATION_COLORS[name] || OTHER_COLOR,
      }));

    return { dimensionData, categoryData, situationData };
  }, [sessions, taskMap, loading]);

  const catKeys = useMemo(() => categoryData.map(d => d.name), [categoryData]);
  const dimKeys = useMemo(() => dimensionData.map(d => d.name), [dimensionData]);
  const sitKeys = useMemo(() => situationData.map(d => d.name), [situationData]);

  const categoryColors = useMemo(() => {
    const m = {};
    categoryData.forEach(d => { m[d.name] = d.color; });
    return m;
  }, [categoryData]);

  const dimensionColors = useMemo(() => {
    const m = {};
    dimensionData.forEach(d => { m[d.name] = d.color; });
    return m;
  }, [dimensionData]);

  const situationColors = useMemo(() => {
    const m = {};
    situationData.forEach(d => { m[d.name] = d.color; });
    return m;
  }, [situationData]);

  const totalCat = useMemo(() => categoryData.reduce((s, d) => s + d.value, 0), [categoryData]);
  const totalDim = useMemo(() => dimensionData.reduce((s, d) => s + d.value, 0), [dimensionData]);
  const totalSit = useMemo(() => situationData.reduce((s, d) => s + d.value, 0), [situationData]);

  const sortedSessions = useMemo(() => {
    return [...sessions]
      .filter(s => s.date && !s.deletedAt)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [sessions]);

  const displayKeys = timelineView === 'categorias' ? catKeys : timelineView === 'dimensiones' ? dimKeys : sitKeys;
  const colorMap = timelineView === 'categorias' ? categoryColors : timelineView === 'dimensiones' ? dimensionColors : situationColors;

  const sessionAllTasks = useMemo(() => {
    const m = {};
    sortedSessions.forEach(s => {
      m[s.id] = (s.tasks || []).map(tid => {
        const t = taskMap[tid];
        if (!t) return null;
        const normalized = { ...t };
        if (typeof normalized.category === 'string') {
          normalized.category = normalized.category ? [normalized.category] : [];
        }
        if (!Array.isArray(normalized.dimension)) {
          normalized.dimension = normalized.dimension ? [normalized.dimension] : [];
        }
        if (typeof normalized.situation === 'string') {
          normalized.situation = normalized.situation && normalized.situation !== 'Otro' ? [normalized.situation] : [];
        }
        if (!Array.isArray(normalized.situation)) normalized.situation = [];
        return normalized;
      }).filter(Boolean);
    });
    return m;
  }, [sortedSessions, taskMap]);

  const cellW = 36;
  const cellH = 28;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="glass-card-static w-full max-w-6xl max-h-[90vh] flex flex-col" style={{ borderRadius: 24 }}>
        <div className="p-5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(185,165,135,0.08)' }}>
          <div className="flex items-center gap-2">
            <PieChartIcon size={20} style={{ color: '#e8ac65' }} />
            <h2 className="text-lg font-bold" style={{ color: '#f1ede7' }}>Análisis de Contenidos</h2>
            {seasonName && (
              <span className="text-sm" style={{ color: '#997b66' }}>{seasonName}</span>
            )}
          </div>
          <button onClick={onClose} className="v2-btn-ghost p-1.5 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 v2-scrollbar">
          {/* Waffle charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.4)', border: '1px solid rgba(185,165,135,0.08)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#e8ac65' }}>Waffle: Dimensiones</h3>
              {totalDim > 0 ? (
                <>
                  <WaffleChart data={dimensionData} total={totalDim} />
                  <div className="flex flex-wrap gap-3 mt-3">
                    {dimensionData.map(d => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: '#baa587' }}>
                        <span className="w-3 h-3 rounded" style={{ background: d.color }} />
                        {d.name} ({((d.value / totalDim) * 100).toFixed(0)}%)
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: '#997b66' }}>Sin datos</p>
              )}
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.4)', border: '1px solid rgba(185,165,135,0.08)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#e8ac65' }}>Waffle: Categorías</h3>
              {totalCat > 0 ? (
                <>
                  <WaffleChart data={categoryData} total={totalCat} />
                  <div className="flex flex-wrap gap-3 mt-3">
                    {categoryData.map(d => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: '#baa587' }}>
                        <span className="w-3 h-3 rounded" style={{ background: d.color }} />
                        {d.name} ({((d.value / totalCat) * 100).toFixed(0)}%)
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: '#997b66' }}>Sin datos</p>
              )}
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.4)', border: '1px solid rgba(185,165,135,0.08)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#e8ac65' }}>Waffle: Situaciones</h3>
              {totalSit > 0 ? (
                <>
                  <WaffleChart data={situationData} total={totalSit} />
                  <div className="flex flex-wrap gap-3 mt-3">
                    {situationData.map(d => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: '#baa587' }}>
                        <span className="w-3 h-3 rounded" style={{ background: d.color }} />
                        {d.name} ({((d.value / totalSit) * 100).toFixed(0)}%)
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: '#997b66' }}>Sin datos</p>
              )}
            </div>
          </div>

          {/* Timeline grid */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(22,20,16,0.4)', border: '1px solid rgba(185,165,135,0.08)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: '#e8ac65' }}>Evolución por sesión</h3>
              <div className="flex p-0.5 rounded-lg" style={{ background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)' }}>
                <button
                  onClick={() => setTimelineView('dimensiones')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    fontWeight: timelineView === 'dimensiones' ? 600 : 400,
                    border: 'none',
                    cursor: 'pointer',
                    background: timelineView === 'dimensiones' ? 'rgba(232,172,101,0.10)' : 'transparent',
                    color: timelineView === 'dimensiones' ? '#e8ac65' : '#997b66',
                  }}
                >
                  Dimensiones
                </button>
                <button
                  onClick={() => setTimelineView('categorias')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    fontWeight: timelineView === 'categorias' ? 600 : 400,
                    border: 'none',
                    cursor: 'pointer',
                    background: timelineView === 'categorias' ? 'rgba(232,172,101,0.10)' : 'transparent',
                    color: timelineView === 'categorias' ? '#e8ac65' : '#997b66',
                  }}
                >
                  Categorías
                </button>
                <button
                  onClick={() => setTimelineView('situaciones')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    fontWeight: timelineView === 'situaciones' ? 600 : 400,
                    border: 'none',
                    cursor: 'pointer',
                    background: timelineView === 'situaciones' ? 'rgba(232,172,101,0.10)' : 'transparent',
                    color: timelineView === 'situaciones' ? '#e8ac65' : '#997b66',
                  }}
                >
                  Situaciones
                </button>
              </div>
            </div>
            {sortedSessions.length > 0 && displayKeys.length > 0 ? (
              <div className="overflow-x-auto pb-2 v2-scrollbar" style={{ maxHeight: 480 }}>
                <div className="inline-flex" style={{ minWidth: sortedSessions.length * (cellW + 3) + 140 }}>
                  {/* Left column: Y-axis labels */}
                  <div style={{ width: 140, flexShrink: 0, position: 'sticky', left: 0, zIndex: 2, background: 'rgba(22,20,16,0.4)' }}>
                    <div style={{ height: 70 }} />
                    {displayKeys.map(key => (
                      <div
                        key={key}
                        style={{
                          height: cellH,
                          display: 'flex',
                          alignItems: 'center',
                          fontSize: 11,
                          color: '#baa587',
                          paddingRight: 8,
                          fontWeight: 500,
                          marginBottom: 2,
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: colorMap[key] || OTHER_COLOR }} />
                          {key}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Grid */}
                  <div>
                    {/* Header row */}
                    <div style={{ display: 'flex', gap: 4, height: 70, alignItems: 'flex-end', paddingBottom: 4, borderBottom: '1px solid rgba(185,165,135,0.06)' }}>
                      {sortedSessions.map((s, i) => {
                        const n = (sessionAllTasks[s.id] || []).length;
                        return (
                          <div
                            key={s.id}
                            title={`${i + 1}. ${s.name} (${n} tareas)`}
                            style={{
                              width: cellW,
                              fontSize: 9,
                              color: '#baa587',
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                              writingMode: 'vertical-rl',
                              transform: 'rotate(180deg)',
                              lineHeight: 1.1,
                              fontWeight: 500,
                            }}
                          >
                            {s.name}
                          </div>
                        );
                      })}
                    </div>

                    {/* Data rows */}
                    {displayKeys.map(catKey => (
                      <div key={catKey} style={{ display: 'flex', gap: 3, marginBottom: 2 }}>
                        {sortedSessions.map(s => {
                          const tasks = sessionAllTasks[s.id] || [];
                          const n = tasks.length;
                          return (
                            <div
                              key={s.id}
                              title={`${catKey} en ${s.name}`}
                              style={{
                                width: cellW,
                                height: cellH,
                                borderRadius: 3,
                                backgroundColor: EMPTY_CELL,
                                display: 'flex',
                                overflow: 'hidden',
                              }}
                            >
                              {n > 0 && tasks.map((t, i) => {
                                const isMatch = timelineView === 'categorias'
                                  ? (Array.isArray(t.category) && t.category.length > 0 ? t.category : ['Otras']).includes(catKey)
                                  : timelineView === 'dimensiones'
                                    ? (Array.isArray(t.dimension) ? t.dimension : []).includes(catKey)
                                    : (Array.isArray(t.situation) ? t.situation : []).includes(catKey);
                                return (
                                  <div
                                    key={i}
                                    title={isMatch ? `${t.title}` : ''}
                                    style={{
                                      flex: 1,
                                      backgroundColor: isMatch ? (colorMap[catKey] || OTHER_COLOR) : 'transparent',
                                      borderRight: i < n - 1 ? '1px solid rgba(0,0,0,0.25)' : 'none',
                                    }}
                                  />
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-center py-8" style={{ color: '#997b66' }}>Sin datos de sesiones</p>
            )}
          </div>

          {/* Summary tables */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(185,165,135,0.08)', background: 'rgba(22,20,16,0.4)' }}>
              <div className="px-4 py-3 text-sm font-semibold" style={{ color: '#e8ac65', borderBottom: '1px solid rgba(185,165,135,0.06)' }}>
                Resumen Dimensiones
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,165,135,0.06)' }}>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#997b66' }}>Dimensión</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#997b66' }}>Count</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#997b66' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {dimensionData.map(row => (
                    <tr key={row.name} style={{ borderBottom: '1px solid rgba(185,165,135,0.04)' }}>
                      <td className="px-4 py-2" style={{ color: '#f1ede7' }}>
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: row.color }} />
                          {row.name}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium" style={{ color: '#e8ac65' }}>{row.value}</td>
                      <td className="px-4 py-2 text-right" style={{ color: '#baa587' }}>{totalDim > 0 ? ((row.value / totalDim) * 100).toFixed(1) : '0'}%</td>
                    </tr>
                  ))}
                  {dimensionData.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-center" style={{ color: '#997b66' }}>Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(185,165,135,0.08)', background: 'rgba(22,20,16,0.4)' }}>
              <div className="px-4 py-3 text-sm font-semibold" style={{ color: '#e8ac65', borderBottom: '1px solid rgba(185,165,135,0.06)' }}>
                Resumen Categorías
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,165,135,0.06)' }}>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#997b66' }}>Categoría</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#997b66' }}>Count</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#997b66' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryData.map(row => (
                    <tr key={row.name} style={{ borderBottom: '1px solid rgba(185,165,135,0.04)' }}>
                      <td className="px-4 py-2" style={{ color: '#f1ede7' }}>
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: row.color }} />
                          {row.name}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium" style={{ color: '#e8ac65' }}>{row.value}</td>
                      <td className="px-4 py-2 text-right" style={{ color: '#baa587' }}>{totalCat > 0 ? ((row.value / totalCat) * 100).toFixed(1) : '0'}%</td>
                    </tr>
                  ))}
                  {categoryData.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-center" style={{ color: '#997b66' }}>Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(185,165,135,0.08)', background: 'rgba(22,20,16,0.4)' }}>
              <div className="px-4 py-3 text-sm font-semibold" style={{ color: '#e8ac65', borderBottom: '1px solid rgba(185,165,135,0.06)' }}>
                Resumen Situaciones
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,165,135,0.06)' }}>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#997b66' }}>Situación</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#997b66' }}>Count</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#997b66' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {situationData.map(row => (
                    <tr key={row.name} style={{ borderBottom: '1px solid rgba(185,165,135,0.04)' }}>
                      <td className="px-4 py-2" style={{ color: '#f1ede7' }}>
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: row.color }} />
                          {row.name}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium" style={{ color: '#e8ac65' }}>{row.value}</td>
                      <td className="px-4 py-2 text-right" style={{ color: '#baa587' }}>{totalSit > 0 ? ((row.value / totalSit) * 100).toFixed(1) : '0'}%</td>
                    </tr>
                  ))}
                  {situationData.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-center" style={{ color: '#997b66' }}>Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
