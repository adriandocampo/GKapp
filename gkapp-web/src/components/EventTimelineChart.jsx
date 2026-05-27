import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = {
  passes: '#5a9e8f',
  cornersCrosses: '#c4a35a',
  goalKicks: '#6b9cc4',
  saves: '#5a9e7a',
  goals: '#e04a4a',
  shotsOff: '#c47a7a',
};

function groupByInterval(events, opponentEvents, periods) {
  const intervals = {
    '1T_0-15': { passes: 0, cornersCrosses: 0, goalKicks: 0, saves: 0, goals: 0, shotsOff: 0 },
    '1T_15-30': { passes: 0, cornersCrosses: 0, goalKicks: 0, saves: 0, goals: 0, shotsOff: 0 },
    '1T_30-45': { passes: 0, cornersCrosses: 0, goalKicks: 0, saves: 0, goals: 0, shotsOff: 0 },
    '2T_45-60': { passes: 0, cornersCrosses: 0, goalKicks: 0, saves: 0, goals: 0, shotsOff: 0 },
    '2T_60-75': { passes: 0, cornersCrosses: 0, goalKicks: 0, saves: 0, goals: 0, shotsOff: 0 },
    '2T_75-90': { passes: 0, cornersCrosses: 0, goalKicks: 0, saves: 0, goals: 0, shotsOff: 0 },
  };

  if (!events || !Array.isArray(events)) return intervals;

  events.forEach(ev => {
    const texts = ev.labels?.map(l => l.text) || [];
    const minute = ev.minute || (ev.start ? Math.floor(ev.start / 60) : 0);
    
    let interval;
    if (minute < 15) interval = '1T_0-15';
    else if (minute < 30) interval = '1T_15-30';
    else if (minute < 45) interval = '1T_30-45';
    else if (minute < 60) interval = '2T_45-60';
    else if (minute < 75) interval = '2T_60-75';
    else interval = '2T_75-90';

    if (texts.includes('Pass')) intervals[interval].passes++;
    if (texts.includes('Goal kick') || texts.includes('Free kick')) intervals[interval].goalKicks++;
    if (texts.includes('Shot against') && texts.includes('Save')) intervals[interval].saves++;
    if (texts.includes('Shot against') && texts.includes('Conceded goal')) intervals[interval].goals++;
  });

  if (opponentEvents && Array.isArray(opponentEvents)) {
    opponentEvents.forEach(ev => {
      const texts = ev.labels?.map(l => l.text) || [];
      const minute = ev.minute || (ev.start ? Math.floor(ev.start / 60) : 0);
      
      let interval;
      if (minute < 15) interval = '1T_0-15';
      else if (minute < 30) interval = '1T_15-30';
      else if (minute < 45) interval = '1T_30-45';
      else if (minute < 60) interval = '2T_45-60';
      else if (minute < 75) interval = '2T_60-75';
      else interval = '2T_75-90';

      if (texts.includes('Shot')) {
        intervals[interval].shotsOff++;
      }
      if (texts.includes('Corner') || texts.includes('Cross') || texts.includes('Free kick cross')) {
        intervals[interval].cornersCrosses++;
      }
    });
  }

  return intervals;
}

export default function EventTimelineChart({ events = [], opponentEvents = [], periods = [] }) {
  const eventsWithMinute = events.map(ev => ({
    ...ev,
    minute: toMatchMinute(ev.start || 0, periods)
  }));

  const opponentEventsWithMinute = opponentEvents.map(ev => ({
    ...ev,
    minute: toMatchMinute(ev.start || 0, periods)
  }));

  const grouped = groupByInterval(eventsWithMinute, opponentEventsWithMinute, periods);
  
  const data = [
    { name: '0-15', ...grouped['1T_0-15'] },
    { name: '15-30', ...grouped['1T_15-30'] },
    { name: '30-45', ...grouped['1T_30-45'] },
    { name: '45-60', ...grouped['2T_45-60'] },
    { name: '60-75', ...grouped['2T_60-75'] },
    { name: '75-90', ...grouped['2T_75-90'] },
  ];

  const totalEvents = data.reduce((sum, d) => 
    sum + d.passes + d.cornersCrosses + d.goalKicks + d.saves + d.goals + d.shotsOff, 0);

  if (totalEvents === 0) {
    return (
      <div className="h-64 flex items-center justify-center" style={{background: 'rgba(22,20,16,0.4)', borderRadius: 16, border: '1px solid rgba(185,165,135,0.08)'}}>
        <p className="text-sm" style={{color: '#997b66'}}>No hay datos de eventos</p>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 16 }}>
      <h4 className="text-xs font-semibold tracking-wider uppercase mb-0 text-center" style={{color: '#997b66'}}>Timeline de Eventos</h4>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(185,165,135,0.06)" vertical={false} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#997b66', fontSize: 10 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#997b66', fontSize: 10 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(22,20,16,0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(232,172,101,0.15)',
              borderRadius: '12px',
              fontSize: 11,
            }}
            itemStyle={{ color: '#f1ede7', fontSize: 11 }}
            labelStyle={{ color: '#baa587', fontSize: 11 }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={40}
            content={({ payload }) => (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '2px 20px', justifyContent: 'center', marginTop: 4 }}>
                {payload.map((entry, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: entry.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#baa587', whiteSpace: 'nowrap' }}>{entry.value}</span>
                  </div>
                ))}
              </div>
            )}
          />
          <Bar dataKey="passes" stackId="a" fill={COLORS.passes} name="Pases" radius={[0, 0, 0, 0]} />
          <Bar dataKey="cornersCrosses" stackId="a" fill={COLORS.cornersCrosses} name="Centros/Córners" radius={[0, 0, 0, 0]} />
          <Bar dataKey="goalKicks" stackId="a" fill={COLORS.goalKicks} name="Saques" radius={[0, 0, 0, 0]} />
          <Bar dataKey="shotsOff" stackId="a" fill={COLORS.shotsOff} name="Tiros fuera" radius={[0, 0, 0, 0]} />
          <Bar dataKey="saves" stackId="a" fill={COLORS.saves} name="Paradas" radius={[0, 0, 0, 0]} />
          <Bar dataKey="goals" stackId="a" fill={COLORS.goals} name="Gol" radius={[0, 0, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function toMatchMinute(start, periods) {
  if (!periods?.length) return Math.floor(start / 60);
  const p1 = periods.find(p => p.id === '1H') || periods[0];
  const p2 = periods.find(p => p.id === '2H');
  if (start <= p1?.end) return (start / p1.end) * 45;
  if (p2 && start >= p2.start) return 45 + ((start - p2.start) / (p2.end - p2.start)) * 45;
  return start / 60;
}