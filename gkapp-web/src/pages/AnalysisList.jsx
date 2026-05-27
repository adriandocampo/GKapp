import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Calendar, User, Star, FolderOpen, Target } from 'lucide-react';
import { db, getSetting } from '../db';
import { parseMatchXml } from '../utils/xmlParser';
import { useToast } from '../components/Toast';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import GlobalShotMap from '../components/GlobalShotMap';

function parseDateDdMmYyyy(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  return `${m[3]}-${mm}-${dd}`;
}

function parseMatchFileName(fileName) {
  const base = String(fileName || '')
    .replace(/\.xml$/i, '')
    .replace(/\s*\((Player|Team)-based\)$/i, '')
    .trim();
  const m = base.match(/^(.*?)\s*-\s*(.*?)\s+(\d+)\s*-\s*(\d+)$/);
  if (!m) return { matchName: base, opponent: '', score: '' };
  const home = m[1].trim();
  const away = m[2].trim();
  const opponent = /^lugo$/i.test(home) ? away : home;
  return { matchName: base, home, away, opponent, score: `${m[3]}-${m[4]}` };
}

function getResultInfo(matchName, opponent) {
  if (!matchName || !opponent) return null;
  const m = matchName.match(/^(.+?)\s*-\s*(.+?)\s+(\d+)\s*-\s*(\d+)$/);
  if (!m) return null;
  const home = m[1].trim();
  const away = m[2].trim();
  const homeScore = parseInt(m[3], 10);
  const awayScore = parseInt(m[4], 10);
  const isLugoHome = /^lugo$/i.test(home);
  const lugoScore = isLugoHome ? homeScore : awayScore;
  const otherScore = isLugoHome ? awayScore : homeScore;
  let type;
  if (lugoScore > otherScore) type = 'win';
  else if (lugoScore === otherScore) type = 'draw';
  else type = 'loss';
  return { text: `${homeScore}-${awayScore}`, type };
}

function seasonNameFromDate(isoDate) {
  if (!isoDate) return '';
  const [year, month] = isoDate.split('-').map(Number);
  if (!year || !month) return '';
  const start = month >= 7 ? year : year - 1;
  return `${start}/${String(start + 1).slice(-2)}`;
}

function SkeletonCard() {
  return (
    <div className="glass-card-static p-4 animate-pulse space-y-3">
      <div className="h-4 rounded w-3/4" style={{background: 'rgba(185,165,135,0.06)'}} />
      <div className="h-3 rounded w-1/2" style={{background: 'rgba(185,165,135,0.06)'}} />
    </div>
  );
}

export default function AnalysisListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState([]);
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [xmlFiles, setXmlFiles] = useState([]);
  const [selectedGoalkeepers, setSelectedGoalkeepers] = useState([]);
  const [showGlobalShotmap, setShowGlobalShotmap] = useState(false);

  async function load() {
    const [rows, seasonsRows] = await Promise.all([
      db.analyses.toArray(),
      db.seasons.toArray(),
    ]);
    setItems(rows.filter((r) => !r.deletedAt).sort((a, b) => (b.jornadaNumber || 0) - (a.jornadaNumber || 0)));
    setSeasons(seasonsRows.filter((s) => !s.deletedAt).sort((a, b) => (a.name || '').localeCompare(b.name || '')));

    if (window.electronAPI?.listPublicXml) {
      try {
        const files = await window.electronAPI.listPublicXml();
        setXmlFiles(files || []);
      } catch {
        setXmlFiles([]);
      }
    } else {
        setXmlFiles([]);
      }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function ensureSeasonByName(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const existing = seasons.find((s) => (s.name || '').toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    await db.seasons.add({ id, name: trimmed, createdAt: new Date(), updatedAt: new Date(), deletedAt: null });
    await load();
    return id;
  }

  async function handleImport(fileName) {
    try {
      const xml = window.electronAPI?.readPublicXml
        ? await window.electronAPI.readPublicXml(fileName)
        : await (await fetch(`/XML/${encodeURIComponent(fileName)}`)).text();
      const defaultPorteros = (await getSetting('defaultPorteros')) || [];
      const parsed = parseMatchXml(xml, { goalkeeperNames: defaultPorteros });
      const inferred = parseMatchFileName(fileName);

      let meta = null;
      if (window.electronAPI?.lookupBeSoccer) {
        meta = await window.electronAPI.lookupBeSoccer(inferred.matchName);
      }
      const isoDate = parseDateDdMmYyyy(meta?.date);
      const inferredSeasonName = seasonNameFromDate(isoDate);
      const latestSeason = seasons[seasons.length - 1];
      let seasonId = seasonFilter !== 'all' ? seasonFilter : null;
      if (!seasonId && inferredSeasonName) seasonId = await ensureSeasonByName(inferredSeasonName);
      if (!seasonId) seasonId = latestSeason?.id || null;

      const existing = seasonId
        ? await db.analyses.where('[seasonId+xmlFileName]').equals([seasonId, fileName]).first()
        : await db.analyses.where('xmlFileName').equals(fileName).first();

      const payload = {
        matchName: inferred.matchName,
        xmlFileName: fileName,
        xmlPath: `XML/${fileName}`,
        goalkeeperName: (parsed.goalkeeper?.name || '').toUpperCase(),
        goalkeeperCode: parsed.goalkeeper?.code || '',
        opponent: inferred.opponent || '',
        seasonId,
        jornadaNumber: meta?.jornadaNumber || null,
        date: isoDate || '',
        xmlData: parsed,
        rawXml: xml,
        rating: 0,
        rpe: 5,
        goalkeeperPhoto: null,
        videoSource: '',
        videoPath: '',
        youtubeUrl: '',
        videoSync: null,
        clipCustomizations: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      let id = existing?.id;
      if (id) {
        await db.analyses.update(id, {
          ...payload,
          goalkeeperName: existing.goalkeeperName || payload.goalkeeperName,
          goalkeeperCode: existing.goalkeeperCode || payload.goalkeeperCode,
          createdAt: existing.createdAt || payload.createdAt,
        });
      } else {
        id = await db.analyses.add(payload);
      }
      addToast('Partido importado automáticamente', 'success');
      navigate(`/analysis/${id}`);
    } catch (err) {
      addToast(`No se pudo importar XML: ${err.message}`, 'error');
    }
  }

  const allGoalkeepers = [...new Set(items.map(a => a.goalkeeperName).filter(Boolean))].sort();
  const filtered = items.filter((a) => {
    const seasonMatch = seasonFilter === 'all' || String(a.seasonId || '') === seasonFilter;
    const gkMatch = selectedGoalkeepers.length === 0 || selectedGoalkeepers.includes(a.goalkeeperName);
    return seasonMatch && gkMatch;
  });

  const analysesWithShots = useMemo(() =>
    items.filter(a => a.sofascoreData?.rivalShots?.length > 0),
    [items]
  );

  return (
    <div className="animate-v2-fade-in-up -mx-4 -my-6 px-4 py-6 min-h-[calc(100vh-4rem)]" style={{ backgroundColor: '#0c0b09' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#f1ede7' }}>Partidos</h1>
          <p className="text-xs mt-1" style={{ color: '#997b66' }}>Análisis guardados por temporada</p>
        </div>
        <div className="flex items-center gap-2">
          {analysesWithShots.length > 1 && (
            <button
              onClick={() => setShowGlobalShotmap(true)}
              style={{
                background: 'rgba(232,172,101,0.08)',
                borderRadius: 14,
                padding: '10px 18px',
                border: '1px solid rgba(232,172,101,0.12)',
                color: '#e8ac65',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
              }}
            >
              <Target size={14} /> Mapa de Tiros Global
            </button>
          )}
          <button
            onClick={() => navigate('/analysis/new')}
            style={{
              background: 'rgba(232,172,101,0.12)',
              borderRadius: 14,
              padding: '10px 18px',
              border: '1px solid rgba(232,172,101,0.15)',
              color: '#e8ac65',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <Plus size={14} /> Nuevo partido
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all`}
          style={{
            background: seasonFilter === 'all' ? 'rgba(232,172,101,0.08)' : 'rgba(22,20,16,0.6)',
            borderColor: seasonFilter === 'all' ? 'rgba(232,172,101,0.20)' : 'rgba(185,165,135,0.08)',
            color: seasonFilter === 'all' ? '#e8ac65' : '#997b66',
          }}
          onClick={() => setSeasonFilter('all')}
        >
          <FolderOpen size={16} />
          <span className="font-medium text-sm">Todas</span>
        </div>
        {seasons.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all`}
            style={{
              background: seasonFilter === String(s.id) ? 'rgba(232,172,101,0.08)' : 'rgba(22,20,16,0.6)',
              borderColor: seasonFilter === String(s.id) ? 'rgba(232,172,101,0.20)' : 'rgba(185,165,135,0.08)',
              color: seasonFilter === String(s.id) ? '#e8ac65' : '#997b66',
            }}
            onClick={() => setSeasonFilter(String(s.id))}
          >
            <FolderOpen size={16} />
            <span className="font-medium text-sm">{s.name}</span>
          </div>
        ))}
      </div>

      {allGoalkeepers.length > 0 && (
        <div className="mb-6">
          <MultiSelectDropdown
            options={allGoalkeepers}
            selected={selectedGoalkeepers}
            onChange={setSelectedGoalkeepers}
            placeholder="Filtrar por portero..."
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
      <>
      {xmlFiles.length > 0 && (
        <div className="glass-card-static p-5 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: '#f1ede7' }}>
            <Upload size={14} style={{ color: '#e8ac65' }} /> XML detectados
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-auto v2-scrollbar">
            {xmlFiles.map((file) => (
              <button
                key={file}
                onClick={() => handleImport(file)}
                className="v2-btn-ghost text-left w-full"
                style={{ fontSize: '0.75rem', padding: '8px 12px' }}
              >
                {file.replace(/\.xml$/i, '')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-sm py-8 text-center" style={{ color: '#997b66' }}>No hay partidos guardados</div>
        )}
        {filtered.map((a) => {
          const resultInfo = getResultInfo(a.matchName, a.opponent);
          return (
          <button
            key={a.id}
            onClick={() => navigate(`/analysis/${a.id}`)}
            className="w-full text-left glass-card-static p-4 transition-all cursor-pointer group"
            style={{ borderRadius: 16 }}
          >
            <div className="flex items-start gap-4">
              {a.jornadaNumber && (
                <div className="flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl shrink-0"
                  style={{ background: 'rgba(232,172,101,0.08)', border: '1px solid rgba(232,172,101,0.15)' }}>
                  <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color: '#e8ac65' }}>Jornada</span>
                  <span className="text-xl font-black leading-none mt-0.5" style={{ color: '#e8ac65' }}>{a.jornadaNumber}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate" style={{ color: '#f1ede7' }}>{a.matchName || a.opponent || 'Partido'}</div>
                  {resultInfo && (
                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-bold border`}
                      style={{
                        background: resultInfo.type === 'win' ? 'rgba(61, 214, 140, 0.12)' : resultInfo.type === 'draw' ? 'rgba(232,172,101,0.12)' : 'rgba(224, 74, 74, 0.12)',
                        borderColor: resultInfo.type === 'win' ? 'rgba(61, 214, 140, 0.30)' : resultInfo.type === 'draw' ? 'rgba(232,172,101,0.30)' : 'rgba(224, 74, 74, 0.30)',
                        color: resultInfo.type === 'win' ? '#3dd68c' : resultInfo.type === 'draw' ? '#f0b429' : '#e04a4a',
                      }}>
                      {resultInfo.text}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap" style={{ color: '#997b66' }}>
                  <span className="flex items-center gap-1"><User size={12} /> {a.goalkeeperName || '-'}</span>
                  <span className="flex items-center gap-1"><Calendar size={12} /> {a.date || '-'}</span>
                  {a.opponent && <span>{a.opponent}</span>}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {a.rating > 0 && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} size={12} style={{ color: i <= a.rating ? '#e8ac65' : 'rgba(185,165,135,0.10)' }} />
                      ))}
                    </div>
                  )}
                  {a.rpe > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)' }}>
                      <span className="text-[10px] font-medium" style={{ color: '#baa587' }}>RPE</span>
                      <span className="text-xs font-bold" style={{color: a.rpe <= 3 ? '#3dd68c' : a.rpe <= 6 ? '#e8ac65' : '#e04a4a'}}>{a.rpe}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
          );
        })}
      </div>
      </>
      )}

      {showGlobalShotmap && (
        <GlobalShotMap
          analyses={analysesWithShots}
          onClose={() => setShowGlobalShotmap(false)}
        />
      )}
    </div>
  );
}