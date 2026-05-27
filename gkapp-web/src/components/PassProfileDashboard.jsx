/**
 * PassProfileDashboard — Visual pass analysis
 * A) Direction Rose: Forward vs Lateral vs Back
 * B) Distance Split: Short/Medium vs Long
 */

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function sectorPath(cx, cy, innerR, outerR, startAngle, endAngle) {
  const startOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const startInner = polarToCartesian(cx, cy, innerR, endAngle);
  const endInner = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return [
    'M', startInner.x, startInner.y,
    'L', startOuter.x, startOuter.y,
    'A', outerR, outerR, 0, largeArc, 0, endOuter.x, endOuter.y,
    'L', endInner.x, endInner.y,
    'A', innerR, innerR, 0, largeArc, 1, startInner.x, startInner.y,
    'Z',
  ].join(' ');
}

function DirectionRose({ passes }) {
  const directions = [
    { key: 'forward', label: 'Forward', color: '#d4a574', angle: -60, span: 120 },   // top
    { key: 'lateral', label: 'Lateral', color: '#6366f1', angle: 60, span: 120 },    // sides (will split into two)
    { key: 'back', label: 'Back', color: '#64748b', angle: 180, span: 120 },         // bottom
  ];

  // Lateral shown on both sides (total count) since left/right distinction isn't meaningful
  const lateralTotal = passes.lateral || 0;
  const data = [
    { label: 'Forward', value: passes.forward || 0, color: '#d4a574', startAngle: -60, endAngle: 60 },
    { label: 'Lateral R', value: lateralTotal, color: '#6366f1', startAngle: 60, endAngle: 120 },
    { label: 'Back', value: passes.back || 0, color: '#64748b', startAngle: 120, endAngle: 240 },
    { label: 'Lateral L', value: lateralTotal, color: '#818cf8', startAngle: 240, endAngle: 300 },
  ];

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const total = (passes.forward || 0) + (passes.lateral || 0) + (passes.back || 0);

  if (total === 0) return null;

  const cx = 100;
  const cy = 100;
  const innerR = 30;
  const maxOuterR = 75;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-full max-w-[200px]">
        {/* Background grid circles */}
        {[25, 50, 75].map(r => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.4" />
        ))}

        {/* Direction petals */}
        {data.map((d, i) => {
          const outerR = innerR + (d.value / maxValue) * (maxOuterR - innerR);
          const path = sectorPath(cx, cy, innerR, outerR, d.startAngle, d.endAngle);
          return (
            <g key={i}>
              <path d={path} fill={d.color} fillOpacity="0.7" stroke={d.color} strokeWidth="1" />
              {/* Value label */}
              {d.value > 0 && (
                <text
                  x={polarToCartesian(cx, cy, (innerR + outerR) / 2, (d.startAngle + d.endAngle) / 2).x}
                  y={polarToCartesian(cx, cy, (innerR + outerR) / 2, (d.startAngle + d.endAngle) / 2).y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {Math.round(d.value)}
                </text>
              )}
            </g>
          );
        })}

        {/* Center circle with total */}
        <circle cx={cx} cy={cy} r={innerR - 2} fill="#0f172a" stroke="#475569" strokeWidth="1" />
        <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="16" fontWeight="bold">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontSize="7">
          pases
        </text>

        {/* Direction labels */}
        <text x={cx} y={15} textAnchor="middle" fill="#94a3b8" fontSize="8">FORWARD</text>
        <text x={cx} y={195} textAnchor="middle" fill="#94a3b8" fontSize="8">BACK</text>
        <text x={15} y={cy + 3} textAnchor="middle" fill="#94a3b8" fontSize="8" transform="rotate(-90 15 100)">LAT</text>
        <text x={185} y={cy + 3} textAnchor="middle" fill="#94a3b8" fontSize="8" transform="rotate(90 185 100)">LAT</text>
      </svg>

      {/* Legend */}
      <div className="flex gap-3 mt-2">
        {[
          { label: 'Forward', color: '#d4a574', value: passes.forward || 0 },
          { label: 'Lateral', color: '#6366f1', value: passes.lateral || 0 },
          { label: 'Back', color: '#64748b', value: passes.back || 0 },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-gk-text-tertiary">{item.label}</span>
            <span className="text-[10px] font-bold text-gk-text-primary">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistanceSplit({ passes }) {
  const short = passes.short || 0;
  const long = passes.long || 0;
  const total = short + long;

  if (total === 0) return null;

  const shortPct = Math.round((short / total) * 100);
  const longPct = Math.round((long / total) * 100);
  const maxVal = Math.max(short, long);

  return (
    <div className="space-y-4">
      {/* Short/Medium */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gk-text-tertiary">Corto / Medio</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-gk-accent">{short}</span>
            <span className="text-xs text-gk-text-tertiary">{shortPct}%</span>
          </div>
        </div>
        <div className="relative h-6 rounded-lg overflow-hidden" style={{background: 'rgba(185,165,135,0.06)'}}>
          <div
            className="absolute top-0 left-0 bottom-0 rounded-lg transition-all duration-700"
            style={{
              width: `${(short / maxVal) * 100}%`,
              background: 'linear-gradient(135deg, #e8ac65, #ecbd83)',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-end pr-2">
              {short > 0 && (
                <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Long */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gk-text-tertiary">Largo</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-stat-indigo">{long}</span>
            <span className="text-xs text-gk-text-tertiary">{longPct}%</span>
          </div>
        </div>
        <div className="relative h-6 rounded-lg overflow-hidden" style={{background: 'rgba(185,165,135,0.06)'}}>
          <div
            className="absolute top-0 left-0 bottom-0 rounded-lg transition-all duration-700"
            style={{
              width: `${(long / maxVal) * 100}%`,
              background: 'linear-gradient(135deg, #7c8dff, #9ba8ff)',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-end pr-2">
              {long > 0 && (
                <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ratio badge */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <div className="px-3 py-1 rounded-full bg-gk-accent/10 border border-gk-accent/20 text-[10px] text-gk-accent font-medium">
          {short} cortos
        </div>
        <span className="text-xs text-gk-text-tertiary">vs</span>
        <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-stat-indigo font-medium">
          {long} largos
        </div>
      </div>
    </div>
  );
}

export default function PassProfileDashboard({ passes = {} }) {
  const hasDirection = (passes.forward || 0) + (passes.lateral || 0) + (passes.back || 0) > 0;
  const hasDistance = (passes.short || 0) + (passes.long || 0) > 0;

  if (!hasDirection && !hasDistance) {
    return (
      <div className="bg-gk-card rounded-xl border border-gk-border p-6 flex items-center justify-center">
        <p className="text-gk-text-tertiary text-sm">No hay datos de pases</p>
      </div>
    );
  }

  return (
    <div className="bg-gk-card rounded-xl border border-gk-border p-5">
      <div className="text-center mb-4">
        <h4 className="text-sm font-semibold text-gk-text-primary inline">Perfil de Pases</h4>
        <span className="text-xs text-gk-text-tertiary ml-1.5">— análisis de distribución</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Direction Rose */}
        {hasDirection && (
          <div className="flex flex-col items-center justify-center p-3 bg-gk-page/30 rounded-lg border border-gk-border/50">
            <span className="text-[10px] text-gk-text-tertiary uppercase tracking-wider mb-2">Dirección</span>
            <DirectionRose passes={passes} />
          </div>
        )}

        {/* Distance Split */}
        {hasDistance && (
          <div className="flex flex-col justify-center p-4 bg-gk-page/30 rounded-lg border border-gk-border/50">
            <span className="text-[10px] text-gk-text-tertiary uppercase tracking-wider mb-3">Distancia</span>
            <DistanceSplit passes={passes} />
          </div>
        )}
      </div>
    </div>
  );
}
