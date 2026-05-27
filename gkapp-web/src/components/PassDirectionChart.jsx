import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = {
  forward: '#d4a574',   // teal-500
  lateral: '#6366f1',    // indigo-500
  back: '#10b981',       // emerald-500
  hand: '#f59e0b',      // amber-500
};

export default function PassDirectionChart({ passes = {} }) {
  const data = [
    { name: 'Forward', value: passes.forward || 0, color: COLORS.forward },
    { name: 'Lateral', value: passes.lateral || 0, color: COLORS.lateral },
    { name: 'Back', value: passes.back || 0, color: COLORS.back },
    { name: 'Hand', value: passes.hand || 0, color: COLORS.hand },
  ].filter(d => d.value > 0);

  const total = passes.total || 0;

  if (total === 0) {
    return (
      <div className="bg-gk-card rounded-xl border border-gk-border p-4 h-64 flex items-center justify-center">
        <p className="text-gk-text-tertiary text-sm">No hay datos de pases</p>
      </div>
    );
  }

  return (
    <div className="bg-gk-card rounded-xl border border-gk-border p-4">
      <h4 className="text-sm font-semibold text-gk-text-primary mb-3">Dirección de Pases</h4>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            itemStyle={{ color: '#e2e8f0' }}
            formatter={(value) => [`${value} (${Math.round(value/total*100)}%)`, '']}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-gk-text-secondary">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center mt-1">
        <span className="text-2xl font-bold text-gk-accent">{total}</span>
        <span className="text-xs text-gk-text-tertiary ml-1">pases</span>
      </div>
    </div>
  );
}