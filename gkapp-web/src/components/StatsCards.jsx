import { ArrowUpRight, Target, Shield, Footprints, Crosshair, Goal, XCircle, ArrowLeft } from 'lucide-react';

const accentColors = {
  teal: { text: '#3dd68c', border: 'rgba(61,214,140,0.15)', bg: 'rgba(61,214,140,0.08)' },
  sky: { text: '#5eb8ff', border: 'rgba(94,184,255,0.15)', bg: 'rgba(94,184,255,0.08)' },
  amber: { text: '#f0b429', border: 'rgba(240,180,41,0.15)', bg: 'rgba(240,180,41,0.08)' },
  indigo: { text: '#7c8dff', border: 'rgba(124,141,255,0.15)', bg: 'rgba(124,141,255,0.08)' },
  emerald: { text: '#3dd68c', border: 'rgba(61,214,140,0.15)', bg: 'rgba(61,214,140,0.08)' },
  rose: { text: '#ff6b6b', border: 'rgba(255,107,107,0.15)', bg: 'rgba(255,107,107,0.08)' },
};

function Card({ title, icon: Icon, children, accent = 'teal' }) {
  const ac = accentColors[accent] || accentColors.teal;
  return (
    <div
      className="glass-card-static p-5 animate-v2-kpi"
      style={{ borderColor: ac.border }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div style={{ background: ac.bg, borderRadius: 8, padding: 6, display: 'flex' }}>
          {Icon && <Icon size={14} style={{ color: ac.text }} />}
        </div>
        <h4 className="text-xs font-semibold tracking-wider uppercase" style={{ color: ac.text }}>{title}</h4>
      </div>
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function StatRow({ label, value, sub, highlight }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span
        className="text-xs"
        style={{ color: highlight ? '#f1ede7' : '#997b66', fontWeight: highlight ? 500 : 400 }}
      >
        {label}
      </span>
      <div className="text-right flex items-center gap-1.5">
        <span
          className="text-sm font-bold"
          style={{
            color: '#f1ede7',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {value}
        </span>
        {sub && (
          <span className="text-[10px]" style={{ color: '#997b66' }}>{sub}</span>
        )}
      </div>
    </div>
  );
}

function SectionDivider() {
  return <div className="my-2 pt-2" style={{ borderTop: '1px solid rgba(185,165,135,0.08)' }} />;
}

export default function StatsCards({ gkStats, opponentStats, passFlow = [] }) {
  const gk = gkStats || {};
  const opp = opponentStats || {};
  const p = gk.passes || {};
  const s = gk.shotsAgainst || {};
  const o = opp.shots || {};
  const c = opp.crosses || {};

  const passTotal = p.total || 0;
  const passSuccess = passTotal - (p.loss || 0);
  const passPct = passTotal > 0 ? Math.round((passSuccess / passTotal) * 100) : 0;

  const saves = s.saves || 0;
  const conceded = s.conceded || 0;
  const shotsTotal = o.total > 0 ? o.total : (saves + conceded);
  const shotsOn = saves + conceded;
  const shotsOff = Math.max(0, shotsTotal - shotsOn);

  const received = passFlow.reduce((acc, p) => acc + (p.playerToGk || 0), 0);
  const receivedSuccess = passFlow.reduce((acc, p) => {
    if (p.playerToGk && p.playerTotal) {
      return acc + Math.round(p.playerToGk * p.playerSuccessRate);
    }
    return acc;
  }, 0);
  const receivedPct = received > 0 ? Math.round((receivedSuccess / received) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <Card title="Pases" icon={Footprints} accent="teal">
        <StatRow label="Total" value={passTotal} highlight />
        <StatRow label="Forward" value={p.forward || 0} />
        <StatRow label="Lateral" value={p.lateral || 0} />
        <StatRow label="Cortos/medios" value={p.short || 0} />
        <StatRow label="Largos" value={p.long || 0} />
        <StatRow label="Progresivos" value={p.progressive || 0} />
        <SectionDivider />
        <StatRow label="Éxito" value={`${passPct}%`} sub={`${passSuccess}/${passTotal}`} />
        <StatRow label="Pérdidas" value={p.loss || 0} />
        <StatRow label="Bajo presión" value={p.underPressure || 0} />
        <SectionDivider />
        <StatRow label="Recibidos" value={received} highlight />
        <StatRow label="Éxito recibidos" value={`${receivedPct}%`} sub={`${receivedSuccess}/${received}`} />
      </Card>

      <Card title="Reinicios" icon={ArrowUpRight} accent="indigo">
        <StatRow label="Total" value={(gk.restarts?.total || (gk.goalKicks?.total || 0) + (gk.freeKicks?.total || 0))} highlight />
        <StatRow label="Saques de puerta" value={gk.goalKicks?.total || 0} />
        <StatRow label="Pérdida saques" value={gk.goalKicks?.loss || 0} />
        <StatRow label="Tiros libres" value={gk.freeKicks?.total || 0} />
      </Card>

      <Card title="Tiros del rival" icon={Crosshair} accent="amber">
        <StatRow label="Total" value={shotsTotal} highlight />
        <StatRow label="A puerta" value={shotsOn} />
        <StatRow label="Fuera" value={shotsOff} />
        <StatRow label="De cabeza" value={o.head || 0} />
        <StatRow label="Tras córner" value={o.afterCorner || 0} />
        <StatRow label="Tras t.libre" value={o.afterFreeKick || 0} />
      </Card>

      <Card title="Paradas" icon={Target} accent="sky">
        <StatRow label="Total" value={saves} highlight />
        <StatRow label="Con reflejos" value={s.saveWithReflex || 0} />
        <StatRow label="Sin reflejos" value={saves - (s.saveWithReflex || 0)} />
        <SectionDivider />
        <StatRow label="Goles en contra" value={conceded} />
        <StatRow label="De penalti" value={s.penalty || 0} />
      </Card>

      <Card title="Salidas" icon={Shield} accent="emerald">
        <StatRow label="Total" value={gk.exits?.interceptions + gk.exits?.goalkeeperExit + gk.exits?.aerialDuels || 0} highlight />
        <StatRow label="Intercepciones" value={gk.exits?.interceptions || 0} />
        <StatRow label="Salidas del arquero" value={gk.exits?.goalkeeperExit || 0} />
        <StatRow label="Duelos aéreos" value={gk.exits?.aerialDuels || 0} />
        <StatRow label="Recuperaciones" value={gk.exits?.recoveries || 0} />
      </Card>

      <Card title="Centros / Córners" icon={XCircle} accent="rose">
        <StatRow label="Centros recibidos" value={c.total || 0} highlight />
        <StatRow label="Completados" value={c.completed || 0} />
        <StatRow label="Bloqueados" value={c.blocked || 0} />
        <StatRow label="Pérdida" value={c.loss || 0} />
        <SectionDivider />
        <StatRow label="Córners en contra" value={opp.corners?.total || 0} />
      </Card>
    </div>
  );
}