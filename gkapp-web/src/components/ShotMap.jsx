import React, { useState, useRef, useCallback, useMemo } from 'react';

// ── FIFA pitch geometry (meters) ────────────────────────────
const W = 68;              // pitch width
const HALF_L = 52.5;       // half-pitch length (goal → halfway)

const GOAL_W = 7.32;       // goal width (8 yds)
const GA_W = 18.32;        // 6-yard box width  (7.32 + 2×5.5)
const GA_H = 5.5;          // 6-yard box depth  (6 yds)
const PA_W = 40.32;        // penalty area width (7.32 + 2×16.5)
const PA_H = 16.5;         // penalty area depth (18 yds)
const SPOT = 11;           // penalty spot
const ARC_R = 9.15;        // penalty arc radius
const CX = W / 2;          // field center (horizontal)
// Correct penalty arc intersection with penalty area line
// (distance from penalty spot horizontally where arc meets PA line)
const ARC_DX = Math.sqrt(ARC_R * ARC_R - (PA_H - SPOT) * (PA_H - SPOT)); // ≈ 7.313m

// ── GoalMouth coordinate boundaries (inferred from real SofaScore data) ──
// goalMouthCoordinates.y: percentage across pitch width 0-100 (same as playerCoordinates.y)
// goalMouthCoordinates.z: height percentage 0-100 (ground=0, crossbar≈41.4)
// Goal posts at y=44.6 (GK right) and y=55.4 (GK left), crossbar at z≈41.4
const GM_LEFT_POST  = 55.4;  // GK left post (y in data)
const GM_RIGHT_POST = 44.6;  // GK right post (y in data)
const GM_CROSSBAR   = 41.4;  // crossbar (z in data)
const GM_GROUND     = 0;     // ground (z in data)
// Viewport zoom: show y=[40,60], z=[-5,50] so the goal fills the view nicely
const GM_Y_MIN = 40, GM_Y_MAX = 60;
const GM_Z_MIN = -5, GM_Z_MAX = 60;

// ── SofaScore coordinate conventions ───────────────────────
// playerCoordinates.x: distance from goal line (meters, or 0-100%)
// playerCoordinates.y: lateral position (0-100% of pitch width)
//
// Normalized (0,0)-(1,1): (lateral, longitudinal)
//   nx = pc.y / 100            (0 = left touchline, 1 = right)
//   ny = pc.x_meters / 105     (0 = goal line, 1 = opposite goal line)

// ── Shot type styling ───────────────────────────────────────
const STYLES = {
  goal:  { fill: '#ef4444', border: '#ef4444', darkBorder: '#7f1d1d', label: 'Gol' },
  save:  { fill: '#10b981', border: '#10b981', darkBorder: '#065f46', label: 'Parada' },
  block: { fill: '#3b82f6', border: '#3b82f6', darkBorder: '#1e40af', label: 'Bloqueado' },
  miss:  { fill: null,      border: '#64748b', darkBorder: '#64748b', label: 'Fuera' },
  post:  { fill: '#eab308', border: '#eab308', darkBorder: '#854d0e', label: 'Palo' },
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

export default function ShotMap({ shots = [] }) {
  const [hovered, setHovered] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const box = useRef(null);

  const has = shots && shots.length > 0;

  const onMove = useCallback((e) => {
    if (!box.current) return;
    const r = box.current.getBoundingClientRect();
    setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
  }, []);

  const tip = useMemo(() => {
    if (!box.current) return { left: 0, top: 0 };
    const rw = box.current.clientWidth || 400;
    const tw = 180, th = 120;
    let left = mouse.x + 12, top = mouse.y - th - 10;
    if (left + tw > rw) left = mouse.x - tw - 12;
    if (top < 0) top = mouse.y + 12;
    return { left, top };
  }, [mouse]);

  const stats = useMemo(() => {
    const n = shots.length;
    const g = shots.filter((s) => s.shotType === 'goal').length;
    const xg = shots.reduce((a, s) => a + (s.xg || 0), 0);
    const xgot = shots.reduce((a, s) => a + (s.xgot || 0), 0);
    return { n, g, xg, xgot, avg: n ? xg / n : 0 };
  }, [shots]);

  // ── Coordinate mapping ─────────────────────────────────────
  const coordMeta = useMemo(() => {
    const xs = shots
      .map((s) => s.playerCoordinates?.x)
      .filter((x) => typeof x === 'number' && !isNaN(x));
    if (!xs.length) return { factor: 1, maxX: 0 };
    const maxX = Math.max(...xs);
    const isPct = maxX > 55;
    return { factor: isPct ? HALF_L / 100 : 1, maxX, isPct };
  }, [shots]);

  const toSvg = useCallback(
    (shot) => {
      const pc = shot.playerCoordinates;
      if (!pc || typeof pc.x !== 'number' || typeof pc.y !== 'number') return null;
      const sx = (pc.y / 100) * W;
      const sy = pc.x * coordMeta.factor;
      if (sx < -5 || sx > W + 5 || sy < -3 || sy > HALF_L + 5) return null;
      return { x: sx, y: sy };
    },
    [coordMeta.factor]
  );

  const mapped = useMemo(
    () => shots.map((s) => ({ s, p: toSvg(s) })).filter((i) => i.p),
    [shots, toSvg]
  );

  const gmShots = useMemo(
    () => shots.filter((s) => s.shotType !== 'block' && s.goalMouthCoordinates && s.goalMouthCoordinates.y != null && s.goalMouthCoordinates.z != null),
    [shots]
  );

  // ── Dynamic view height (auto-crop) ────────────────────────
  const { viewH, maxDist } = useMemo(() => {
    const ys = mapped.map((m) => m.p.y);
    const maxDist = ys.length ? Math.max(...ys) : 0;
    const margin = 3;
    const minH = 18;
    const viewH = Math.min(HALF_L, Math.max(minH, maxDist + margin));
    return { viewH, maxDist };
  }, [mapped]);

  // ── Empty state ────────────────────────────────────────────
  if (!has) {
    return (
      <div className="w-full rounded-2xl p-6" style={{ backgroundColor: '#0a0907' }}>
        <div className="w-full rounded-xl flex items-center justify-center" style={{ aspectRatio: `${W}/${HALF_L}`, backgroundColor: '#0a0907' }}>
          <p className="text-sm" style={{ color: '#475569' }}>No hay datos disponibles</p>
        </div>
      </div>
    );
  }

  // ── Size legend ────────────────────────────────────────────
  const qSizes = [0.35, 0.65, 0.95, 1.25, 1.55];
  const inView = (y) => y <= viewH + 2;

  return (
    <div className="w-full rounded-2xl p-5" style={{ backgroundColor: '#0a0907' }}>
      {/* Legend */}
      <div className="mb-3 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-medium tracking-wider uppercase" style={{ color: '#475569' }}>xG Bajo</span>
          {qSizes.map((sz, i) => (
            <div key={i} className="flex items-center justify-center" style={{ width: '14px', height: '14px' }}>
              <div className="rounded-full" style={{ width: sz * 3, height: sz * 3, border: '0.25px solid #64748b', opacity: 0.5 }} />
            </div>
          ))}
          <span className="text-[9px] font-medium tracking-wider uppercase" style={{ color: '#475569' }}>xG Alto</span>
        </div>
        <div className="flex items-center gap-3">
          {Object.values(STYLES).map((s) => (
            <div key={s.label} className="flex items-center gap-1">
              <div
                className="rounded-full"
                style={{
                  width: '7px', height: '7px',
                  backgroundColor: s.fill || 'transparent',
                  border: s.fill ? '0.25px solid ' + s.border : '0.25px solid ' + s.border,
                  opacity: 0.8,
                }}
              />
              <span className="text-[9px] font-medium tracking-wide" style={{ color: '#64748b' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Goalmouth view — correctly scaled from inferred SofaScore post/crossbar coords */}
      <div className="mb-4 flex justify-center">
        <div className="rounded-md overflow-hidden" style={{ width: '260px', height: '78px', backgroundColor: '#0a0907' }}>
          <svg viewBox="0 0 130 39" className="w-full h-full">
            <rect x="0" y="0" width="130" height="39" fill="#0a0907" />
            {(() => {
              // Flipped mapping: y=55.4 (GK left) → x=0, y=44.6 (GK right) → x=130
              const xR = ((GM_Y_MAX - GM_RIGHT_POST) / (GM_Y_MAX - GM_Y_MIN)) * 130;  // GK right post → right side of SVG
              const xL = ((GM_Y_MAX - GM_LEFT_POST) / (GM_Y_MAX - GM_Y_MIN)) * 130;   // GK left post → left side of SVG
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
                  {/* Goal area background */}
                  <rect x={xL} y={yT} width={xR - xL} height={yB - yT} fill="#0a0907" />
                  {/* Zone grid lines (inside goal only) */}
                  <g stroke="#334155" strokeWidth="0.25" opacity="0.35">
                    <line x1={x1} y1={yT} x2={x1} y2={yB} />
                    <line x1={x2} y1={yT} x2={x2} y2={yB} />
                    <line x1={xL} y1={yM} x2={xR} y2={yM} />
                  </g>
                  {/* Goal frame — only posts and crossbar, no bottom line */}
                  <line x1={xL} y1={yT} x2={xL} y2={yB} stroke="#cbd5e1" strokeWidth="2" opacity="0.85" />
                  <line x1={xR} y1={yT} x2={xR} y2={yB} stroke="#cbd5e1" strokeWidth="2" opacity="0.85" />
                  <line x1={xL} y1={yT} x2={xR} y2={yT} stroke="#cbd5e1" strokeWidth="2" opacity="0.85" />
                </>
              );
            })()}
            {gmShots.map((shot, i) => {
              const gm = shot.goalMouthCoordinates;
              // Flipped X mapping so GK left is on left side of SVG
              const dotX = ((GM_Y_MAX - gm.y) / (GM_Y_MAX - GM_Y_MIN)) * 130;
              const dotY = 39 - ((gm.z - GM_Z_MIN) / (GM_Z_MAX - GM_Z_MIN)) * 39;
              const st = STYLES[shot.shotType] || STYLES.miss;
              const r = shot.shotType === 'goal' ? 3 : 2.2;
              return (
                <g key={i}>
                  <circle cx={dotX} cy={dotY} r={r} fill={st.fill || 'none'} stroke={'#ffffff'} strokeWidth={0.35} opacity={0.92} style={{ pointerEvents: 'none' }} />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── Pitch (half-field, top-down) ────────────────────── */}
      <div
        ref={box}
        className="relative w-full overflow-hidden rounded-lg"
        style={{ aspectRatio: `${W} / ${viewH}` }}
        onMouseMove={onMove}
      >
        <svg viewBox={`0 0 ${W} ${viewH}`} className="w-full h-full">
          {/* Background */}
          <rect x="0" y="0" width={W} height={viewH} fill="#0a0907" />

          {/* ── Pitch markings ───────────────────────────── */}     
          <g stroke="#cbd5e1" fill="none" opacity="0.2" strokeWidth="0.2">
            {/* Goal line (top edge) */}
            <line x1="0" y1="0" x2={W} y2="0" strokeWidth="0.5" opacity="0.3" />

            {/* Touch lines */}
            <line x1="0" y1="0" x2="0" y2={viewH} />
            <line x1={W} y1="0" x2={W} y2={viewH} />

            {/* ── Goal ─────────────────────────────────────── */}
            {/* Drawn as a proper rectangle on the goal line, centered at CX */}
            <rect x={CX - GOAL_W / 2} y="-0.8" width={GOAL_W} height="0.8" fill="none" stroke="#cbd5e1" strokeWidth="0.35" opacity="0.35" />

            {/* Goal posts (vertical lines protruding above the goal line) */}
            <line x1={CX - GOAL_W / 2} y1="0" x2={CX - GOAL_W / 2} y2="-0.8" stroke="#cbd5e1" strokeWidth="1.2" opacity="0.6" />
            <line x1={CX + GOAL_W / 2} y1="0" x2={CX + GOAL_W / 2} y2="-0.8" stroke="#cbd5e1" strokeWidth="1.2" opacity="0.6" />
            {/* Crossbar */}
            <line x1={CX - GOAL_W / 2} y1="-0.8" x2={CX + GOAL_W / 2} y2="-0.8" stroke="#cbd5e1" strokeWidth="1.2" opacity="0.6" />

            {/* ── 6-yard box (goal area) ──────────────────── */}
            {/* Centered at CX, width=18.32m, depth=5.5m */}
            {inView(GA_H) && (
              <rect x={CX - GA_W / 2} y={0} width={GA_W} height={GA_H} strokeWidth="0.25" />
            )}

            {/* ── Penalty area ─────────────────────────────── */}
            {/* Centered at CX, width=40.32m, depth=16.5m */}
            {inView(PA_H) && (
              <rect x={CX - PA_W / 2} y={0} width={PA_W} height={PA_H} strokeWidth="0.25" />
            )}

            {/* ── Penalty spot ─────────────────────────────── */}
            {inView(SPOT) && (
              <circle cx={CX} cy={SPOT} r="0.25" fill="#cbd5e1" stroke="none" opacity="0.4" />
            )}

            {/* ── Penalty arc ──────────────────────────────── */}
            {/* Intersects PA line at CX ± ARC_DX = ±7.313m, sweep=0 (counter-clockwise) curves outward away from goal */}
            {inView(PA_H) && (
              <path d={`M ${CX - ARC_DX} ${PA_H} A ${ARC_R} ${ARC_R} 0 0 0 ${CX + ARC_DX} ${PA_H}`} strokeWidth="0.2" />
            )}

            {/* ── Halfway line / centre circle ────────────── */}
            {inView(HALF_L) && (
              <>
                <path d={`M ${CX - ARC_R} ${HALF_L} A ${ARC_R} ${ARC_R} 0 0 1 ${CX + ARC_R} ${HALF_L}`} strokeWidth="0.2" />
                <circle cx={CX} cy={HALF_L} r="0.2" fill="#cbd5e1" stroke="none" opacity="0.3" />
              </>
            )}
          </g>

          {/* ── Distance reference grid (every 5m) ─────────── */}
          <g stroke="#334155" strokeWidth="0.15" opacity="0.12">
            {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((d) =>
              inView(d) ? <line key={d} x1="0" y1={d} x2={W} y2={d} /> : null
            )}
          </g>

          {/* ── Distance semicircles (dashed) ──────────────── */}
          <g stroke="#94a3b8" strokeWidth="0.25" fill="none" opacity="0.35" strokeDasharray="0.5,0.5">
            {[10, 15, 20].map((d) =>
              inView(d) ? (
                <g key={d}>
                  <path d={`M ${CX - d} 0 A ${d} ${d} 0 0 0 ${CX + d} 0`} />
                </g>
              ) : null
            )}
          </g>

          {/* ── Shot dots ──────────────────────────────────── */}
          {mapped.map(({ s, p }, i) => {
            const st = STYLES[s.shotType] || STYLES.miss;
            const r = shotRadius(s.xg);
            const isFilled = !!st.fill;

            return (
              <g key={i}>
                {/* Outer glow for goals */}
                {s.shotType === 'goal' && (
                  <circle cx={p.x} cy={p.y} r={r + 0.5} fill="none" stroke="white" strokeWidth="0.12" opacity={0.12} style={{ pointerEvents: 'none' }} />
                )}
                {/* Main circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={st.fill || 'none'}
                  stroke={'#ffffff'}
                  strokeWidth={0.18}
                  opacity={0.92}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(null)}
                />
                {/* X mark for blocked */}
                {s.shotType === 'block' && (
                  <g stroke="#ffffff" strokeWidth="0.18" opacity={0.35}>
                    <line x1={p.x - r * 0.5} y1={p.y - r * 0.5} x2={p.x + r * 0.5} y2={p.y + r * 0.5} />
                    <line x1={p.x + r * 0.5} y1={p.y - r * 0.5} x2={p.x - r * 0.5} y2={p.y + r * 0.5} />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* ── Tooltip ──────────────────────────────────────── */}
        {hovered && (
          <div
            className="absolute z-20 pointer-events-none rounded-lg px-3 py-2"
            style={{
              left: tip.left, top: tip.top,
              minWidth: '160px',
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
                <div className="text-[11px] font-semibold leading-tight" style={{ color: '#f1f5f9' }}>{hovered.player?.name || hovered.player?.shortName || 'Jugador'}</div>
                <div className="text-[9px]" style={{ color: '#64748b' }}>Min {hovered.time}'</div>
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>xG</span><span className="font-medium" style={{ color: '#e2e8f0' }}>{hovered.xg?.toFixed(2) ?? '-'}</span></div>
              {hovered.xgot !== undefined && <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>xGOT</span><span className="font-medium" style={{ color: '#e2e8f0' }}>{hovered.xgot.toFixed(2)}</span></div>}
              <div className="flex justify-between text-[10px]">
                <span style={{ color: '#64748b' }}>Resultado</span>
                <span className="font-semibold" style={{ color: (STYLES[hovered.shotType] || STYLES.miss).fill || '#64748b' }}>
                  {(STYLES[hovered.shotType] || STYLES.miss).label}
                </span>
              </div>
              <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Situación</span><span style={{ color: '#e2e8f0' }}>{fmtSit(hovered.situation)}</span></div>
              <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Tipo</span><span style={{ color: '#e2e8f0' }}>{fmtPart(hovered.bodyPart)}</span></div>
              <div className="flex justify-between text-[10px]"><span style={{ color: '#64748b' }}>Zona</span><span style={{ color: '#e2e8f0' }}>{fmtZone(hovered.goalMouthLocation)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats ──────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        {[
          { label: 'Tiros', value: stats.n, color: STYLES.goal.fill },
          { label: 'Goles', value: stats.g, color: STYLES.goal.fill },
          { label: 'xG', value: stats.xg.toFixed(2), color: STYLES.goal.fill },
          { label: 'xGOT', value: stats.xgot > 0 ? stats.xgot.toFixed(2) : '—', color: STYLES.goal.fill },
          { label: 'xG/Tiro', value: stats.avg.toFixed(2), color: STYLES.goal.fill },
        ].map((s) => (
          <div key={s.label} className="text-center rounded-lg py-2" style={{ backgroundColor: '#0a0907' }}>
            <div className="text-[10px] font-semibold tracking-[0.1em] uppercase" style={{ color: '#64748b' }}>{s.label}</div>
            <div className="text-2xl font-bold tracking-tight mt-0.5" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
