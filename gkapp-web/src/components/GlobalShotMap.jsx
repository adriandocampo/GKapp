import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { X, Target, Crosshair } from 'lucide-react';

const W = 68;
const HALF_L = 52.5;
const GOAL_W = 7.32;
const GA_W = 18.32;
const GA_H = 5.5;
const PA_W = 40.32;
const PA_H = 16.5;
const SPOT = 11;
const ARC_R = 9.15;
const CX = W / 2;
const ARC_DX = Math.sqrt(ARC_R * ARC_R - (PA_H - SPOT) * (PA_H - SPOT));

const GM_LEFT_POST = 55.4;
const GM_RIGHT_POST = 44.6;
const GM_CROSSBAR = 41.4;
const GM_GROUND = 0;
const GM_Y_MIN = 40; const GM_Y_MAX = 60;
const GM_Z_MIN = -5; const GM_Z_MAX = 60;

const STYLES = {
  goal:  { fill: '#ef4444', border: '#ef4444', label: 'Gol', dot: true },
  save:  { fill: '#10b981', border: '#10b981', label: 'Parada', dot: true },
  block: { fill: '#3b82f6', border: '#3b82f6', label: 'Bloqueado', dot: true },
  miss:  { fill: null,      border: '#64748b', label: 'Fuera', dot: false },
  post:  { fill: '#eab308', border: '#eab308', label: 'Palo', dot: true },
};

function shotRadius(xg) {
  return Math.max(0.35, Math.min(1.5, 0.3 + (xg || 0) * 1.25));
}

function fmtPart(bp) {
  const m = { 'right-foot': 'Diestro', 'left-foot': 'Zurdo', head: 'Cabeza', other: 'Otro' };
  return m[bp] || bp || '—';
}
function fmtSit(s) {
  const m = { regular: 'Jugada', corner: 'Córner', 'free-kick': 'Falta', penalty: 'Penalti', 'set-piece': 'BP', 'fast-break': 'CT' };
  return m[s] || s || '—';
}
function fmtZone(loc) {
  if (!loc) return '—';
  return loc.replace('low-', 'Bajo ').replace('high-', 'Alto ').replace('centre', 'centro').replace('left', 'izq.').replace('right', 'der.');
}

export default function GlobalShotMap({ analyses = [], onClose }) {
  const [selectedGoalkeepers, setSelectedGoalkeepers] = useState(() => new Set());
  const [selectedShotTypes, setSelectedShotTypes] = useState(() => new Set(Object.keys(STYLES)));
  const [hovered, setHovered] = useState(null);
  const [selectedShot, setSelectedShot] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const box = useRef(null);
  const initialized = useRef(false);

  const goalkeepers = useMemo(() =>
    [...new Set(analyses.map(a => a.goalkeeperName).filter(Boolean))].sort(),
    [analyses]
  );

  if (!initialized.current && goalkeepers.length > 0) {
    setSelectedGoalkeepers(new Set(goalkeepers));
    initialized.current = true;
  }

  const allShots = useMemo(() => {
    return analyses.flatMap(a =>
      (a.sofascoreData?.rivalShots || []).map(shot => ({
        ...shot,
        _goalkeeper: a.goalkeeperName,
        _opponent: a.opponent,
        _matchName: a.matchName,
        _date: a.date,
        _analysisId: a.id,
      }))
    );
  }, [analyses]);

  const filteredShots = useMemo(() => {
    return allShots.filter(s =>
      selectedGoalkeepers.has(s._goalkeeper) && selectedShotTypes.has(s.shotType)
    );
  }, [allShots, selectedGoalkeepers, selectedShotTypes]);

  const toggleGoalkeeper = useCallback((name) => {
    setSelectedGoalkeepers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleShotType = useCallback((type) => {
    setSelectedShotTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleShotClick = useCallback((shot) => {
    setSelectedShot(prev => prev === shot ? null : shot);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedShot(null);
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') clearSelection();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [clearSelection]);

  const onMove = useCallback((e) => {
    if (!box.current) return;
    const r = box.current.getBoundingClientRect();
    setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
  }, []);

  const tip = useMemo(() => {
    if (!box.current) return { left: 0, top: 0 };
    const rw = box.current.clientWidth || 400;
    const tw = 200; const th = 170;
    let left = mouse.x + 12, top = mouse.y - th - 10;
    if (left + tw > rw) left = mouse.x - tw - 12;
    if (top < 0) top = mouse.y + 12;
    return { left, top };
  }, [mouse]);

  const stats = useMemo(() => {
    const n = filteredShots.length;
    const g = filteredShots.filter(s => s.shotType === 'goal').length;
    const xg = filteredShots.reduce((a, s) => a + (s.xg || 0), 0);
    const xgot = filteredShots.reduce((a, s) => a + (s.xgot || 0), 0);
    return { n, g, xg, xgot, avg: n ? xg / n : 0 };
  }, [filteredShots]);

  const coordMeta = useMemo(() => {
    const xs = allShots.map(s => s.playerCoordinates?.x).filter(x => typeof x === 'number' && !isNaN(x));
    if (!xs.length) return { factor: 1, maxX: 0 };
    const maxX = Math.max(...xs);
    return { factor: maxX > 55 ? HALF_L / 100 : 1, maxX };
  }, [allShots]);

  const toSvg = useCallback((shot) => {
    const pc = shot.playerCoordinates;
    if (!pc || typeof pc.x !== 'number' || typeof pc.y !== 'number') return null;
    const sx = (pc.y / 100) * W;
    const sy = pc.x * coordMeta.factor;
    if (sx < -5 || sx > W + 5 || sy < -3 || sy > HALF_L + 5) return null;
    return { x: sx, y: sy };
  }, [coordMeta.factor]);

  const mapped = useMemo(() =>
    filteredShots.map(s => ({ s, p: toSvg(s) })).filter(i => i.p),
    [filteredShots, toSvg]
  );

  const gmShots = useMemo(() =>
    filteredShots.filter(s => s.shotType !== 'block' && s.goalMouthCoordinates?.y != null && s.goalMouthCoordinates?.z != null),
    [filteredShots]
  );

  const { viewH } = useMemo(() => {
    const ys = mapped.map(m => m.p.y);
    const maxDist = ys.length ? Math.max(...ys) : 0;
    const viewH = Math.min(HALF_L, Math.max(18, maxDist + 3));
    return { viewH, maxDist };
  }, [mapped]);

  const inView = (y) => y <= viewH + 2;

  const hasData = allShots.length > 0;

  const gkCounts = useMemo(() => {
    const counts = {};
    for (const a of analyses) {
      const key = a.goalkeeperName || '?';
      counts[key] = (counts[key] || 0) + (a.sofascoreData?.rivalShots?.length || 0);
    }
    return counts;
  }, [analyses]);

  const typeCounts = useMemo(() => {
    const counts = {};
    for (const s of allShots) {
      counts[s.shotType] = (counts[s.shotType] || 0) + 1;
    }
    return counts;
  }, [allShots]);

  const activeTooltip = hovered;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-5xl glass-card-static shadow-2xl overflow-hidden flex flex-col" style={{ borderRadius: 24, maxHeight: '95vh' }}>
        {/* Header */}
        <div className="flex items-center justify-center p-5 shrink-0 relative" style={{ borderBottom: '1px solid rgba(185,165,135,0.08)' }}>
          <div className="flex items-center gap-3">
            <Target size={18} style={{ color: '#e8ac65' }} />
            <h2 className="text-lg font-bold" style={{ color: '#f1ede7' }}>Mapa de Tiros Global</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(232,172,101,0.08)', color: '#baa587' }}>
              {allShots.length} tiros · {analyses.length} partidos
            </span>
          </div>
          <button onClick={onClose} className="v2-btn-ghost p-2 rounded-xl absolute right-5">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto v2-scrollbar p-5 space-y-4">
          {!hasData ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#997b66' }}>
              <Target size={48} className="mb-4" style={{ opacity: 0.4 }} />
              <p className="text-sm">No hay partidos con datos de SofaScore</p>
            </div>
          ) : (
            <>
              {/* Goalkeeper filters */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: '#64748b' }}>Porteros</span>
                {goalkeepers.map(gk => {
                  const active = selectedGoalkeepers.has(gk);
                  const cnt = gkCounts[gk] || 0;
                  return (
                    <button
                      key={gk}
                      onClick={() => toggleGoalkeeper(gk)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                      style={{
                        background: active ? 'rgba(232,172,101,0.12)' : 'rgba(22,20,16,0.6)',
                        borderColor: active ? 'rgba(232,172,101,0.35)' : 'rgba(185,165,135,0.08)',
                        color: active ? '#e8ac65' : '#64748b',
                      }}
                    >
                      {gk}
                      <span className="text-[10px] opacity-60">({cnt})</span>
                    </button>
                  );
                })}
              </div>

              {/* Shot type filters */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: '#64748b' }}>Tipo</span>
                {Object.entries(STYLES).map(([key, st]) => {
                  const active = selectedShotTypes.has(key);
                  const cnt = typeCounts[key] || 0;
                  return (
                    <button
                      key={key}
                      onClick={() => toggleShotType(key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                      style={{
                        background: active ? `${st.fill || 'transparent'}15` : 'rgba(22,20,16,0.6)',
                        borderColor: active ? `${st.border}55` : 'rgba(185,165,135,0.08)',
                        color: active ? st.border : '#64748b',
                      }}
                    >
                      {active && st.fill && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.fill }} />
                      )}
                      {st.label}
                      <span className="text-[10px] opacity-60">({cnt})</span>
                    </button>
                  );
                })}
              </div>

              {/* Goal mouth view */}
              <div className="flex justify-center">
                <div className="rounded-md overflow-hidden relative" style={{ width: '260px', height: '78px', backgroundColor: '#0a0907' }}>
                  <svg viewBox="0 0 130 39" className="w-full h-full">
                    <rect x="0" y="0" width="130" height="39" fill="#0a0907" />
                    {(() => {
                      const xR = ((GM_Y_MAX - GM_RIGHT_POST) / (GM_Y_MAX - GM_Y_MIN)) * 130;
                      const xL = ((GM_Y_MAX - GM_LEFT_POST) / (GM_Y_MAX - GM_Y_MIN)) * 130;
                      const yT = 39 - ((GM_CROSSBAR - GM_Z_MIN) / (GM_Z_MAX - GM_Z_MIN)) * 39;
                      const yB = 39 - ((GM_GROUND - GM_Z_MIN) / (GM_Z_MAX - GM_Z_MIN)) * 39;
                      const gw = GM_LEFT_POST - GM_RIGHT_POST;
                      const g1 = GM_RIGHT_POST + gw / 3;
                      const g2 = GM_RIGHT_POST + 2 * gw / 3;
                      const zm = GM_CROSSBAR / 2;
                      const x1 = ((GM_Y_MAX - g1) / (GM_Y_MAX - GM_Y_MIN)) * 130;
                      const x2 = ((GM_Y_MAX - g2) / (GM_Y_MAX - GM_Y_MIN)) * 130;
                      const yM = 39 - ((zm - GM_Z_MIN) / (GM_Z_MAX - GM_Z_MIN)) * 39;
                      return (
                        <>
                          <rect x={xL} y={yT} width={xR - xL} height={yB - yT} fill="#0a0907" />
                          <g stroke="#334155" strokeWidth="0.25" opacity="0.35">
                            <line x1={x1} y1={yT} x2={x1} y2={yB} />
                            <line x1={x2} y1={yT} x2={x2} y2={yB} />
                            <line x1={xL} y1={yM} x2={xR} y2={yM} />
                          </g>
                          <line x1={xL} y1={yT} x2={xL} y2={yB} stroke="#cbd5e1" strokeWidth="2" opacity="0.85" />
                          <line x1={xR} y1={yT} x2={xR} y2={yB} stroke="#cbd5e1" strokeWidth="2" opacity="0.85" />
                          <line x1={xL} y1={yT} x2={xR} y2={yT} stroke="#cbd5e1" strokeWidth="2" opacity="0.85" />
                        </>
                      );
                    })()}
                    {gmShots.map((shot, i) => {
                      const gm = shot.goalMouthCoordinates;
                      const dotX = ((GM_Y_MAX - gm.y) / (GM_Y_MAX - GM_Y_MIN)) * 130;
                      const dotY = 39 - ((gm.z - GM_Z_MIN) / (GM_Z_MAX - GM_Z_MIN)) * 39;
                      const st = STYLES[shot.shotType] || STYLES.miss;
                      const isSelected = selectedShot === shot;
                      const r = shot.shotType === 'goal' ? 3 : 2.2;
                      const baseOpacity = selectedShot ? (isSelected ? 1 : 0.08) : 0.75;
                      return (
                        <circle
                          key={i} cx={dotX} cy={dotY} r={r}
                          fill={st.fill || 'none'}
                          stroke={isSelected ? '#e8ac65' : '#ffffff'}
                          strokeWidth={isSelected ? 0.5 : 0.2}
                          opacity={baseOpacity}
                          style={{ pointerEvents: 'none' }}
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Pitch */}
              <div
                ref={box}
                className="relative w-full overflow-hidden rounded-lg"
                style={{ aspectRatio: `${W} / ${viewH}` }}
                onMouseMove={onMove}
                onClick={(e) => { if (e.target === box.current || e.target.closest('svg')) clearSelection(); }}
              >
                <svg viewBox={`0 0 ${W} ${viewH}`} className="w-full h-full">
                  <rect x="0" y="0" width={W} height={viewH} fill="#0a0907" />
                  <g stroke="#cbd5e1" fill="none" opacity="0.2" strokeWidth="0.2">
                    <line x1="0" y1="0" x2={W} y2="0" strokeWidth="0.5" opacity="0.3" />
                    <line x1="0" y1="0" x2="0" y2={viewH} />
                    <line x1={W} y1="0" x2={W} y2={viewH} />
                    <rect x={CX - GOAL_W / 2} y="-0.8" width={GOAL_W} height="0.8" fill="none" stroke="#cbd5e1" strokeWidth="0.35" opacity="0.35" />
                    <line x1={CX - GOAL_W / 2} y1="0" x2={CX - GOAL_W / 2} y2="-0.8" stroke="#cbd5e1" strokeWidth="1.2" opacity="0.6" />
                    <line x1={CX + GOAL_W / 2} y1="0" x2={CX + GOAL_W / 2} y2="-0.8" stroke="#cbd5e1" strokeWidth="1.2" opacity="0.6" />
                    <line x1={CX - GOAL_W / 2} y1="-0.8" x2={CX + GOAL_W / 2} y2="-0.8" stroke="#cbd5e1" strokeWidth="1.2" opacity="0.6" />
                    {inView(GA_H) && <rect x={CX - GA_W / 2} y={0} width={GA_W} height={GA_H} strokeWidth="0.25" />}
                    {inView(PA_H) && <rect x={CX - PA_W / 2} y={0} width={PA_W} height={PA_H} strokeWidth="0.25" />}
                    {inView(SPOT) && <circle cx={CX} cy={SPOT} r="0.25" fill="#cbd5e1" stroke="none" opacity="0.4" />}
                    {inView(PA_H) && <path d={`M ${CX - ARC_DX} ${PA_H} A ${ARC_R} ${ARC_R} 0 0 0 ${CX + ARC_DX} ${PA_H}`} strokeWidth="0.2" />}
                    {inView(HALF_L) && (
                      <>
                        <path d={`M ${CX - ARC_R} ${HALF_L} A ${ARC_R} ${ARC_R} 0 0 1 ${CX + ARC_R} ${HALF_L}`} strokeWidth="0.2" />
                        <circle cx={CX} cy={HALF_L} r="0.2" fill="#cbd5e1" stroke="none" opacity="0.3" />
                      </>
                    )}
                  </g>
                  <g stroke="#334155" strokeWidth="0.15" opacity="0.12">
                    {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(d => inView(d) ? <line key={d} x1="0" y1={d} x2={W} y2={d} /> : null)}
                  </g>
                  <g stroke="#94a3b8" strokeWidth="0.25" fill="none" opacity="0.35" strokeDasharray="0.5,0.5">
                    {[10, 15, 20].map(d => inView(d) ? <path key={d} d={`M ${CX - d} 0 A ${d} ${d} 0 0 0 ${CX + d} 0`} /> : null)}
                  </g>

                  {/* Shot dots */}
                  {mapped.map(({ s, p }, i) => {
                    const st = STYLES[s.shotType] || STYLES.miss;
                    const r = shotRadius(s.xg);
                    const isSelected = selectedShot === s;
                    const dimmed = selectedShot && !isSelected;
                    const opacity = isSelected ? 1 : (dimmed ? 0.3 : 0.92);

                    return (
                      <g key={i} style={{ cursor: 'pointer' }}>
                        {s.shotType === 'goal' && !dimmed && (
                          <circle cx={p.x} cy={p.y} r={r + 0.5} fill="none" stroke="white" strokeWidth="0.12" opacity={0.12} style={{ pointerEvents: 'none' }} />
                        )}
                        {isSelected && (
                          <circle cx={p.x} cy={p.y} r={r + 1.2} fill="none" stroke="#e8ac65" strokeWidth="0.15" opacity="0.5" />
                        )}
                        <circle
                          cx={p.x} cy={p.y} r={r}
                          fill={st.fill || 'none'}
                          stroke={isSelected ? '#e8ac65' : '#ffffff'}
                          strokeWidth={isSelected ? 0.2 : 0.08}
                          opacity={opacity}
                          onClick={(e) => { e.stopPropagation(); handleShotClick(s); }}
                          onMouseEnter={() => setHovered(s)}
                          onMouseLeave={() => setHovered(null)}
                        />
                        {s.shotType === 'block' && !dimmed && (
                          <g stroke="#ffffff" strokeWidth="0.18" opacity={0.35}>
                            <line x1={p.x - r * 0.5} y1={p.y - r * 0.5} x2={p.x + r * 0.5} y2={p.y + r * 0.5} />
                            <line x1={p.x + r * 0.5} y1={p.y - r * 0.5} x2={p.x - r * 0.5} y2={p.y + r * 0.5} />
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {activeTooltip && !selectedShot && (
                  <div
                    className="absolute z-20 pointer-events-none rounded-lg px-3 py-2"
                    style={{
                      left: tip.left, top: tip.top,
                      minWidth: '180px',
                      backgroundColor: '#0a0907',
                      border: '1px solid #1e293b',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="rounded-full flex items-center justify-center" style={{ width: '22px', height: '22px', backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold leading-tight" style={{ color: '#f1f5f9' }}>{activeTooltip.player?.name || activeTooltip.player?.shortName || 'Jugador'}</div>
                        <div className="text-[9px]" style={{ color: '#64748b' }}>Min {activeTooltip.time}'</div>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>xG</span><span className="font-medium" style={{ color: '#e2e8f0' }}>{activeTooltip.xg?.toFixed(2) ?? '-'}</span></div>
                      {activeTooltip.xgot !== undefined && <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>xGOT</span><span className="font-medium" style={{ color: '#e2e8f0' }}>{activeTooltip.xgot.toFixed(2)}</span></div>}
                      <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Resultado</span><span className="font-semibold" style={{ color: (STYLES[activeTooltip.shotType] || STYLES.miss).fill || '#64748b' }}>{(STYLES[activeTooltip.shotType] || STYLES.miss).label}</span></div>
                      <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Situación</span><span style={{ color: '#e2e8f0' }}>{fmtSit(activeTooltip.situation)}</span></div>
                      <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Tipo</span><span style={{ color: '#e2e8f0' }}>{fmtPart(activeTooltip.bodyPart)}</span></div>
                      <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Zona</span><span style={{ color: '#e2e8f0' }}>{fmtZone(activeTooltip.goalMouthLocation)}</span></div>
                      <div style={{ borderTop: '1px solid rgba(185,165,135,0.08)', marginTop: 4, paddingTop: 4 }}>
                        <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Partido</span><span style={{ color: '#e2e8f0' }}>{activeTooltip._matchName || activeTooltip._opponent || '-'}</span></div>
                        <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Portero</span><span style={{ color: '#e8ac65' }}>{activeTooltip._goalkeeper || '-'}</span></div>
                        <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Fecha</span><span style={{ color: '#e2e8f0' }}>{activeTooltip._date || '-'}</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected shot info — top right */}
                {selectedShot && (
                  <div
                    className="absolute z-20 rounded-lg px-3 py-2"
                    style={{
                      top: 8, right: 8,
                      minWidth: '180px',
                      backgroundColor: '#0a0907',
                      border: '1px solid rgba(232,172,101,0.2)',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: '22px', height: '22px', backgroundColor: '#1e293b', border: '1px solid rgba(232,172,101,0.3)' }}>
                          <Crosshair size={10} style={{ color: '#e8ac65' }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold leading-tight truncate" style={{ color: '#f1f5f9' }}>{selectedShot.player?.name || selectedShot.player?.shortName || 'Jugador'}</div>
                          <div className="text-[9px]" style={{ color: '#64748b' }}>Min {selectedShot.time}'</div>
                        </div>
                      </div>
                      <button onClick={clearSelection} className="v2-btn-ghost p-0.5 rounded-lg shrink-0 flex items-center justify-center" style={{ width: 18, height: 18 }}>
                        <X size={10} />
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>xG</span><span className="font-medium" style={{ color: '#e2e8f0' }}>{selectedShot.xg?.toFixed(2) ?? '-'}</span></div>
                      {selectedShot.xgot !== undefined && <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>xGOT</span><span className="font-medium" style={{ color: '#e2e8f0' }}>{selectedShot.xgot.toFixed(2)}</span></div>}
                      <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Resultado</span><span className="font-semibold" style={{ color: (STYLES[selectedShot.shotType] || STYLES.miss).fill || '#64748b' }}>{(STYLES[selectedShot.shotType] || STYLES.miss).label}</span></div>
                      <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Situación</span><span style={{ color: '#e2e8f0' }}>{fmtSit(selectedShot.situation)}</span></div>
                      <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Tipo</span><span style={{ color: '#e2e8f0' }}>{fmtPart(selectedShot.bodyPart)}</span></div>
                      <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Zona</span><span style={{ color: '#e2e8f0' }}>{fmtZone(selectedShot.goalMouthLocation)}</span></div>
                      <div style={{ borderTop: '1px solid rgba(185,165,135,0.08)', marginTop: 4, paddingTop: 4 }}>
                        <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Partido</span><span style={{ color: '#e2e8f0' }}>{selectedShot._matchName || selectedShot._opponent || '-'}</span></div>
                        <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Portero</span><span style={{ color: '#e8ac65' }}>{selectedShot._goalkeeper || '-'}</span></div>
                        <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Fecha</span><span style={{ color: '#e2e8f0' }}>{selectedShot._date || '-'}</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-5 gap-2 pt-2 mx-auto" style={{ maxWidth: 500 }}>
                {[
                  { label: 'Tiros', value: stats.n, color: STYLES.goal.fill },
                  { label: 'Goles', value: stats.g, color: STYLES.goal.fill },
                  { label: 'xG', value: stats.xg.toFixed(2), color: STYLES.goal.fill },
                  { label: 'xGOT', value: stats.xgot > 0 ? stats.xgot.toFixed(2) : '—', color: STYLES.goal.fill },
                  { label: 'xG/Tiro', value: stats.avg.toFixed(2), color: STYLES.goal.fill },
                ].map(s => (
                  <div key={s.label} className="text-center rounded-lg py-2" style={{ backgroundColor: '#0a0907' }}>
                    <div className="text-[10px] font-semibold tracking-[0.1em] uppercase" style={{ color: '#64748b' }}>{s.label}</div>
                    <div className="text-2xl font-bold tracking-tight mt-0.5" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
