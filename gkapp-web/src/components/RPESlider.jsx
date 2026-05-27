import { Zap } from 'lucide-react';

export default function RPESlider({ value = 5, onChange, readOnly = false }) {
  const getRpeColor = (v) => {
    if (v <= 3) return '#3dd68c';
    if (v <= 5) return '#e8ac65';
    if (v <= 7) return '#e87550';
    return '#e04a4a';
  };

  const pct = value <= 1 ? 0 : ((value - 1) / 9) * 100;
  const color = getRpeColor(value);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Zap size={14} style={{ color }} />
          <span className="text-xs font-medium" style={{ color: '#baa587' }}>RPE</span>
        </div>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {value}/10
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        disabled={readOnly}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="v2-rpe"
        style={{ background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(185,165,135,0.12) ${pct}%, rgba(185,165,135,0.12) 100%)` }}
      />
      <style>{`
        .v2-rpe::-webkit-slider-thumb {
          background: ${color} !important;
          box-shadow: 0 0 12px ${color}40 !important;
        }
        .v2-rpe::-webkit-slider-thumb:hover {
          box-shadow: 0 0 20px ${color}60 !important;
        }
        .v2-rpe::-moz-range-thumb {
          background: ${color} !important;
        }
      `}</style>
    </div>
  );
}
