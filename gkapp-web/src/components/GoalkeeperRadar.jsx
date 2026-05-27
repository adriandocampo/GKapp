import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function GoalkeeperRadar({ gkStats = {} }) {
  const p = gkStats.passes || {};
  const s = gkStats.shotsAgainst || {};
  const e = gkStats.exits || {};
  const gk = gkStats.goalKicks || {};

  // Calculate normalized values (0-100 scale)
  const passesScore = Math.min(100, (p.total || 0) / 0.5); // 50 passes = 100
  const savesScore = Math.min(100, ((s.saves || 0) / 0.1) * 100); // 10 saves = 100
  const exitsScore = Math.min(100, ((e.interceptions || 0) + (e.goalkeeperExit || 0) + (e.aerialDuels || 0) / 0.15) * 100); // 15 = 100
  const distributionScore = p.total > 0 
    ? Math.min(100, ((p.total - (p.loss || 0)) / p.total * 100))
    : 50;
  const pressureScore = p.total > 0
    ? Math.min(100, ((p.total - (p.underPressure || 0)) / p.total * 100))
    : 50;
  const defensiveScore = (s.saves || 0) + (s.conceded || 0) > 0
    ? Math.min(100, (s.saves || 0) / ((s.saves || 0) + (s.conceded || 0)) * 100)
    : 50;

  const data = [
    { metric: 'Pases', value: Math.round(passesScore), raw: p.total || 0 },
    { metric: 'Paradas', value: Math.round(savesScore), raw: s.saves || 0 },
    { metric: 'Salidas', value: Math.round(exitsScore), raw: (e.interceptions || 0) + (e.goalkeeperExit || 0) },
    { metric: 'Distribución', value: Math.round(distributionScore), raw: Math.round(distributionScore) + '%' },
    { metric: 'Presión', value: Math.round(pressureScore), raw: p.underPressure || 0 },
    { metric: 'Defensa', value: Math.round(defensiveScore), raw: Math.round(defensiveScore) + '%' },
  ];

  const total = (p.total || 0) + (s.saves || 0) + (gk.total || 0);

  if (total === 0) {
    return (
      <div className="bg-gk-card rounded-xl border border-gk-border p-4 h-64 flex items-center justify-center">
        <p className="text-gk-text-tertiary text-sm">No hay datos del portero</p>
      </div>
    );
  }

  return (
    <div className="bg-gk-card rounded-xl border border-gk-border p-4">
      <h4 className="text-sm font-semibold text-gk-text-primary mb-3">Radar de Métricas</h4>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fill: '#94a3b8', fontSize: 10 }} 
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={{ fill: '#64748b', fontSize: 8 }}
            axisLine={false}
          />
          <Radar
            name="Portero"
            dataKey="value"
            stroke="#d4a574"
            strokeWidth={2}
            fill="#d4a574"
            fillOpacity={0.25}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
            formatter={(value, name, props) => [`${value}/100 (${props.payload.raw})`, 'Score']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}