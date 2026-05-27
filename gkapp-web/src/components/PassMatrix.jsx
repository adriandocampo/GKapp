function PassBar({ value, max, barColor = '#e8ac65' }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold tabular-nums w-6 text-right" style={{color: '#f1ede7', fontFamily: "'JetBrains Mono', monospace"}}>{value}</span>
      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{background: 'rgba(185,165,135,0.06)'}}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor, opacity: pct > 0 ? 1 : 0 }}
        />
      </div>
    </div>
  );
}

function HeatCell({ children, intensity }) {
  const bgOpacity = Math.min(0.15, intensity * 0.15);
  return (
    <td
      className="px-3 py-2 transition-colors"
      style={{ backgroundColor: `rgba(232, 172, 101, ${bgOpacity})` }}
    >
      {children}
    </td>
  );
}

export default function PassMatrix({ passFlow = [], goalkeeperCode = '' }) {
  const gkToPlayerTotal = passFlow.reduce((s, p) => s + (p.gkToPlayer || 0), 0);
  const playerToGkTotal = passFlow.reduce((s, p) => s + (p.playerToGk || 0), 0);
  const allTotal = gkToPlayerTotal + playerToGkTotal;

  const maxGkToPlayer = Math.max(...passFlow.map(p => p.gkToPlayer || 0), 1);
  const maxPlayerToGk = Math.max(...passFlow.map(p => p.playerToGk || 0), 1);
  const maxTotal = Math.max(...passFlow.map(p => (p.gkToPlayer || 0) + (p.playerToGk || 0)), 1);

  if (passFlow.length === 0) {
    return (
      <div className="w-full">
        <h3 className="text-sm font-semibold mb-3 text-center" style={{color: '#f1ede7'}}>Matriz de Pases</h3>
        <div className="text-sm py-8 text-center" style={{color: '#997b66'}}>No hay datos de pases</div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <h3 className="text-sm font-semibold text-center" style={{color: '#f1ede7'}}>Matriz de Pases</h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-4 rounded-xl text-center" style={{background: 'rgba(232,172,101,0.06)', border: '1px solid rgba(232,172,101,0.12)'}}>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{color: '#e8ac65'}}>GK → Jugadores</div>
          <div className="text-2xl font-bold" style={{color: '#e8ac65', fontFamily: "'JetBrains Mono', monospace"}}>{gkToPlayerTotal}</div>
          <div className="mt-2 h-2 rounded-full overflow-hidden" style={{background: 'rgba(185,165,135,0.06)'}}>
            <div className="h-full rounded-full" style={{width: '100%', background: '#e8ac65'}} />
          </div>
        </div>
        <div className="p-4 rounded-xl text-center" style={{background: 'rgba(124,141,255,0.06)', border: '1px solid rgba(124,141,255,0.12)'}}>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{color: '#7c8dff'}}>Jugadores → GK</div>
          <div className="text-2xl font-bold" style={{color: '#7c8dff', fontFamily: "'JetBrains Mono', monospace"}}>{playerToGkTotal}</div>
          <div className="mt-2 h-2 rounded-full overflow-hidden" style={{background: 'rgba(185,165,135,0.06)'}}>
            <div className="h-full rounded-full" style={{width: '100%', background: '#7c8dff'}} />
          </div>
        </div>
        <div className="p-4 rounded-xl text-center" style={{background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)'}}>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{color: '#baa587'}}>Total Pases</div>
          <div className="text-2xl font-bold" style={{color: '#f1ede7', fontFamily: "'JetBrains Mono', monospace"}}>{allTotal}</div>
          <div className="mt-2 h-2 rounded-full overflow-hidden flex" style={{background: 'rgba(185,165,135,0.06)'}}>
            <div className="h-full rounded-full transition-all" style={{width: allTotal > 0 ? `${(gkToPlayerTotal / allTotal) * 100}%` : 0, background: '#e8ac65'}} />
            <div className="h-full rounded-full transition-all" style={{width: allTotal > 0 ? `${(playerToGkTotal / allTotal) * 100}%` : 0, background: '#7c8dff'}} />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{border: '1px solid rgba(185,165,135,0.08)', background: 'rgba(22,20,16,0.4)'}}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{borderBottom: '1px solid rgba(185,165,135,0.06)', background: 'rgba(22,20,16,0.4)'}}>
              <th className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider w-[25%]" style={{color: '#baa587'}}>Jugador</th>
              <th className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider w-[25%]" style={{color: '#e8ac65'}}>GK →</th>
              <th className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider w-[25%]" style={{color: '#7c8dff'}}>→ GK</th>
              <th className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider w-[25%]" style={{color: '#f1ede7'}}>Total</th>
            </tr>
          </thead>
          <tbody>
            {passFlow.map((p) => {
              const rowTotal = (p.gkToPlayer || 0) + (p.playerToGk || 0);
              const rowIntensity = rowTotal / maxTotal;
              return (
                <tr
                  key={p.code}
                  style={{
                    borderBottom: '1px solid rgba(185,165,135,0.04)',
                    background: `rgba(232, 172, 101, ${rowIntensity * 0.06})`,
                  }}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-6" style={{color: '#997b66', fontFamily: "'JetBrains Mono', monospace"}}>{p.code.match(/^(\d+)/)?.[1] || ''}</span>
                      <span className="text-sm font-medium" style={{color: '#f1ede7'}}>{p.name || p.code}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <PassBar value={p.gkToPlayer || 0} max={maxGkToPlayer} barColor="#e8ac65" />
                  </td>
                  <td className="px-3 py-2.5">
                    <PassBar value={p.playerToGk || 0} max={maxPlayerToGk} barColor="#7c8dff" />
                  </td>
                  <td className="px-3 py-2.5">
                    <PassBar value={rowTotal} max={maxTotal} barColor="#baa587" />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{borderTop: '1px solid rgba(185,165,135,0.08)', background: 'rgba(22,20,16,0.4)'}}>
              <td className="px-3 py-3 text-sm font-semibold" style={{color: '#f1ede7'}}>Totales</td>
              <td className="px-3 py-3">
                <PassBar value={gkToPlayerTotal} max={maxGkToPlayer} barColor="#e8ac65" />
              </td>
              <td className="px-3 py-3">
                <PassBar value={playerToGkTotal} max={maxPlayerToGk} barColor="#7c8dff" />
              </td>
              <td className="px-3 py-3">
                <PassBar value={allTotal} max={maxTotal} barColor="#baa587" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}