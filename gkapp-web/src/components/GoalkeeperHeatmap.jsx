import React from 'react';

const PITCH_W = 105;
const PITCH_H = 55;

export default function GoalkeeperHeatmap({ heatmap = [] }) {
  const hasData = heatmap && heatmap.length > 0;

  if (!hasData) {
    return (
      <div className="w-full rounded-2xl p-6" style={{ backgroundColor: '#0a0907' }}>
        <div
          className="w-full rounded-xl flex items-center justify-center"
          style={{ aspectRatio: `${PITCH_W}/${PITCH_H}`, backgroundColor: '#0a0907' }}
        >
          <p className="text-sm" style={{ color: '#475569' }}>
            No hay datos disponibles
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl p-6" style={{ backgroundColor: '#0a0907' }}>
      {/* Attack direction arrow */}
      <div className="flex justify-center mb-4">
        <div className="flex items-center gap-2">
          <svg width="40" height="12" viewBox="0 0 40 12" className="opacity-60">
            <line x1="0" y1="6" x2="32" y2="6" stroke="#94a3b8" strokeWidth="0.8" />
            <polygon points="36,6 28,2.5 28,9.5" fill="#94a3b8" />
          </svg>
          <span
            className="text-[10px] font-medium tracking-widest uppercase"
            style={{ color: '#64748b' }}
          >
            Dirección de ataque
          </span>
        </div>
      </div>

      {/* Pitch container */}
      <div
        className="w-full rounded-xl overflow-hidden"
        style={{ aspectRatio: `${PITCH_W}/${PITCH_H}` }}
      >
        <svg
          viewBox={`0 0 ${PITCH_W} ${PITCH_H}`}
          className="w-full h-full"
          style={{ backgroundColor: '#0a0907' }}
        >
          <defs>
            {/* Gaussian blur filters for atmospheric heatmap effect */}
            <filter id="blurLarge" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            </filter>
            <filter id="blurMedium" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
            <filter id="blurSmall" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
            </filter>

            {/* Radial gradients for each heat layer */}
            <radialGradient id="heatBlue" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="heatCyan" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#facc15" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="heatYellow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#facc15" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#fb923c" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="heatOrange" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fb923c" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#ef4444" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Pitch outline - ultra-thin, ultra-subtle */}
          <g stroke="#475569" fill="none" opacity="0.3" strokeWidth="0.35">
            <rect x="0.2" y="0.2" width={PITCH_W - 0.4} height={PITCH_H - 0.4} />
            <line x1={PITCH_W / 2} y1="0" x2={PITCH_W / 2} y2={PITCH_H} />
            <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r="9.15" />
            <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r="0.3" fill="#475569" stroke="none" />

            <rect x="0" y={PITCH_H / 2 - 20.12} width="16.5" height="40.24" />
            <rect x="0" y={PITCH_H / 2 - 9.32} width="5.5" height="18.64" />
            <circle cx="11" cy={PITCH_H / 2} r="0.3" fill="#475569" stroke="none" />
            <path d={`M 16.5 ${PITCH_H / 2 - 9.15} A 9.15 9.15 0 0 1 16.5 ${PITCH_H / 2 + 9.15}`} />

            <rect x={PITCH_W - 16.5} y={PITCH_H / 2 - 20.12} width="16.5" height="40.24" />
            <rect x={PITCH_W - 5.5} y={PITCH_H / 2 - 9.32} width="5.5" height="18.64" />
            <circle cx={PITCH_W - 11} cy={PITCH_H / 2} r="0.3" fill="#475569" stroke="none" />
            <path d={`M ${PITCH_W - 16.5} ${PITCH_H / 2 + 9.15} A 9.15 9.15 0 0 1 ${PITCH_W - 16.5} ${PITCH_H / 2 - 9.15}`} />

            <path d={`M 0 2 A 2 2 0 0 1 2 0`} />
            <path d={`M ${PITCH_W - 2} 0 A 2 2 0 0 1 ${PITCH_W} 2`} />
            <path d={`M ${PITCH_W} ${PITCH_H - 2} A 2 2 0 0 1 ${PITCH_W - 2} ${PITCH_H}`} />
            <path d={`M 2 ${PITCH_H} A 2 2 0 0 1 0 ${PITCH_H - 2}`} />
          </g>

          {/* Goals */}
          <g stroke="#475569" strokeWidth="0.35" fill="none" opacity="0.35">
            <rect x="-1.5" y={PITCH_H / 2 - 3.66} width="1.5" height="7.32" />
            <rect x={PITCH_W} y={PITCH_H / 2 - 3.66} width="1.5" height="7.32" />
          </g>

          {/* Heatmap layers - atmospheric, soft diffusion */}
          {/* Layer 1: Large blue/cyan blob (r=8, opacity=0.25, blur=3) */}
          <g filter="url(#blurLarge)">
            {heatmap.map((point, i) => (
              <circle
                key={`l1-${i}`}
                cx={(point.x / 100) * PITCH_W}
                cy={(point.y / 100) * PITCH_H}
                r={8}
                fill="url(#heatBlue)"
                opacity={0.25}
              />
            ))}
          </g>

          {/* Layer 2: Medium yellow blob (r=5, opacity=0.35, blur=2) */}
          <g filter="url(#blurMedium)">
            {heatmap.map((point, i) => (
              <circle
                key={`l2-${i}`}
                cx={(point.x / 100) * PITCH_W}
                cy={(point.y / 100) * PITCH_H}
                r={5}
                fill="url(#heatYellow)"
                opacity={0.35}
              />
            ))}
          </g>

          {/* Layer 3: Small red/orange blob (r=3, opacity=0.3, blur=1.5) */}
          <g filter="url(#blurSmall)">
            {heatmap.map((point, i) => (
              <circle
                key={`l3-${i}`}
                cx={(point.x / 100) * PITCH_W}
                cy={(point.y / 100) * PITCH_H}
                r={3}
                fill="url(#heatOrange)"
                opacity={0.3}
              />
            ))}
          </g>

          {/* Layer 4: Tiny core dot (r=1, opacity=0.5, no blur, red) */}
          <g>
            {heatmap.map((point, i) => (
              <circle
                key={`l4-${i}`}
                cx={(point.x / 100) * PITCH_W}
                cy={(point.y / 100) * PITCH_H}
                r={1}
                fill="#ef4444"
                opacity={0.5}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center justify-center gap-3">
        <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: '#64748b' }}>
          Baja actividad
        </span>
        <div
          className="h-2 rounded-full"
          style={{
            width: '160px',
            background: 'linear-gradient(90deg, #3b82f6, #06b6d4, #facc15, #fb923c, #ef4444)',
            opacity: 0.85,
          }}
        />
        <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: '#64748b' }}>
          Alta actividad
        </span>
      </div>
    </div>
  );
}
