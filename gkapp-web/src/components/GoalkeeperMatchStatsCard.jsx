import { Shield } from 'lucide-react';

const FIELDS = [
  { key: 'saves', label: 'Paradas totales', section: 'Paradas' },
  { key: 'savedShotsFromInsideTheBox', label: 'Desde dentro del área', section: 'Paradas' },
  { key: 'goodHighClaim', label: 'Despejes por alto', section: 'Aéreos' },
  { key: 'accurateKeeperSweeper', label: 'Salidas completadas', section: 'Aéreos' },
  { key: 'errorLeadToAShot', label: 'Errores que llevan a disparo', section: 'Errores' },
];

const SECTIONS = [
  { id: 'Paradas', label: 'Paradas', accent: '#5eb8ff' },
  { id: 'Aéreos', label: 'Aéreos', accent: '#3dd68c' },
  { id: 'Errores', label: 'Errores', accent: '#ff6b6b' },
  { id: 'Pases', label: 'Pases', accent: '#7c8dff' },
];

function StatRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs" style={{ color: '#997b66', fontWeight: 400 }}>
        {label}
      </span>
      <span
        className="text-sm font-bold tabular-nums"
        style={{
          color: highlight ? '#f1ede7' : '#f1ede7',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

function SectionDivider({ color }) {
  return <div className="my-2 pt-2" style={{ borderTop: `1px solid ${color}22` }} />;
}

export default function GoalkeeperMatchStatsCard({ stats }) {
  const hasData = stats && (
    FIELDS.some((f) => stats[f.key] !== null && stats[f.key] !== undefined) ||
    stats.totalPass != null ||
    stats.accuratePass != null ||
    stats.totalLongBalls != null ||
    stats.accurateLongBalls != null
  );

  const grouped = FIELDS.reduce((acc, f) => {
    if (!acc[f.section]) acc[f.section] = [];
    acc[f.section].push(f);
    return acc;
  }, {});
  grouped.Pases = [];

  return (
    <div
      className="glass-card-static p-5 animate-v2-kpi"
      style={{ borderColor: 'rgba(232,172,101,0.15)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          style={{
            background: 'rgba(232,172,101,0.08)',
            borderRadius: 8,
            padding: 6,
            display: 'flex',
          }}
        >
          <Shield size={14} style={{ color: '#e8ac65' }} />
        </div>
        <h3
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: '#e8ac65' }}
        >
          Datos del partido
        </h3>
      </div>

      {!hasData ? (
        <div
          className="flex flex-col items-center justify-center py-6"
          style={{ color: '#997b66' }}
        >
          <Shield size={24} className="mb-2" style={{ opacity: 0.4 }} />
          <p className="text-xs">Sin datos del portero para este partido</p>
        </div>
      ) : (
        <div className="space-y-0">
          {Object.entries(grouped).map(([sectionId, fields], si) => {
            const section = SECTIONS.find((s) => s.id === sectionId) || SECTIONS[0];

            if (sectionId === 'Pases') {
              const totalPass = stats?.totalPass;
              const accuratePass = stats?.accuratePass;
              const totalLongBalls = stats?.totalLongBalls;
              const accurateLongBalls = stats?.accurateLongBalls;
              const passDisplay = totalPass != null
                ? `${totalPass}${accuratePass != null ? ` (${accuratePass})` : ''}`
                : '—';
              const longDisplay = totalLongBalls != null
                ? `${totalLongBalls}${accurateLongBalls != null ? ` (${accurateLongBalls})` : ''}`
                : '—';

              return (
                <div key={sectionId}>
                  {si > 0 && <SectionDivider color={section.accent} />}
                  <div className="mb-1">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: section.accent }}
                    >
                      {section.label}
                    </span>
                  </div>
                  <StatRow label="Pases totales" value={passDisplay} />
                  <StatRow label="Pases largos totales" value={longDisplay} />
                </div>
              );
            }

            return (
              <div key={sectionId}>
                {si > 0 && <SectionDivider color={section.accent} />}
                <div className="mb-1">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: section.accent }}
                  >
                    {section.label}
                  </span>
                </div>
                {fields.map((f) => {
                  const value = stats?.[f.key];
                  const isNull = value === null || value === undefined;
                  const isHighlight = f.key === 'saves';
                  return (
                    <StatRow
                      key={f.key}
                      label={f.label}
                      value={isNull ? null : value}
                      highlight={isHighlight}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
