export default function DefensiveGauge({ gkStats = {} }) {
  const s = gkStats.shotsAgainst || {};
  
  const saves = s.saves || 0;
  const conceded = s.conceded || 0;
  const total = saves + conceded;
  const efficiency = total > 0 ? (saves / total) * 100 : 0;
  
  // SVG arc parameters
  const cx = 50;
  const cy = 50;
  const r = 40;
  const startAngle = -180;
  const endAngle = 0;
  const angleRange = endAngle - startAngle;
  
  // Calculate path for arc
  function polarToCartesian(cx, cy, r, angle) {
    const rad = (angle) * Math.PI / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  }
  
  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? '0' : '1';
    return [
      'M', start.x, start.y,
      'A', r, r, 0, largeArcFlag, 0, end.x, end.y
    ].join(' ');
  }

  // Get color based on efficiency
  function getGaugeColor(eff) {
    if (eff >= 80) return '#22c55e'; // green-500
    if (eff >= 50) return '#eab308'; // yellow-500
    return '#ef4444'; // red-500
  }
  
  const gaugeColor = getGaugeColor(efficiency);
  const efficiencyAngle = startAngle + (angleRange * efficiency / 100);
  
  if (total === 0) {
    return (
      <div className="bg-gk-card rounded-xl border border-gk-border p-4">
        <h4 className="text-sm font-semibold text-gk-text-primary mb-3">Eficiencia Defensiva</h4>
        <div className="h-32 flex items-center justify-center">
          <p className="text-gk-text-tertiary text-sm">No hay datos de shoots</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gk-card rounded-xl border border-gk-border p-4">
      <h4 className="text-sm font-semibold text-gk-text-primary mb-3">Eficiencia Defensiva</h4>
      
      <div className="relative h-32">
        <svg viewBox="0 0 100 60" className="w-full h-full">
          {/* Background arc */}
          <path
            d={describeArc(cx, cy, r, startAngle, endAngle)}
            fill="none"
            stroke="#334155"
            strokeWidth="8"
            strokeLinecap="round"
          />
          
          {/* Efficiency arc with gradient */}
          {efficiency > 0 && (
            <path
              d={describeArc(cx, cy, r, startAngle, efficiencyAngle)}
              fill="none"
              stroke={gaugeColor}
              strokeWidth="8"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${gaugeColor}40)` }}
            >
              <animate 
                attributeName="stroke-dasharray" 
                from="0, 126" 
                to={`${(efficiency / 100) * 126}, 126`} 
                dur="0.8s" 
                fill="freeze" 
              />
            </path>
          )}
          
          {/* Center text */}
          <text 
            x={cx} 
            y={cy + 8} 
            textAnchor="middle" 
            dominantBaseline="middle"
            className="text-2xl font-bold"
            fill={gaugeColor}
          >
            {Math.round(efficiency)}%
          </text>
          <text 
            x={cx} 
            y={cy + 20} 
            textAnchor="middle" 
            dominantBaseline="middle"
            className="text-[8px] font-medium"
            fill="#94a3b8"
          >
            Paradas/Goles
          </text>
        </svg>
      </div>
      
      {/* Stats below */}
      <div className="flex justify-center gap-6 mt-2 text-xs text-gk-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gk-accent"></span>
          {saves} paradas
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          {conceded} goles
        </span>
      </div>
    </div>
  );
}