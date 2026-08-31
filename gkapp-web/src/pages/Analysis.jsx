import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Upload, User, Video, BarChart3, X, Star, Trash2,
  FileText, Shield, AlertCircle, Link, Download, CheckCircle, Activity, Target,
  ChevronDown, ChevronRight, Printer
} from 'lucide-react';
import { db, getSetting } from '../db';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Modal';
import { parseMatchXml, computeBidirectionalFlow, mergeTouchEvents, toMatchMinute } from '../utils/xmlParser';
import StarRating from '../components/StarRating';
import RPESlider from '../components/RPESlider';
import PassMatrix from '../components/PassMatrix';
import StatsCards from '../components/StatsCards';
import MatchTimeline, { DEFAULT_CLIP_CATEGORIES } from '../components/MatchTimeline';
import PassDirectionChart from '../components/PassDirectionChart';
import EventTimelineChart from '../components/EventTimelineChart';
import GoalkeeperHeatmap from '../components/GoalkeeperHeatmap';
import ShotMap from '../components/ShotMap';
import GoalkeeperMatchStatsCard from '../components/GoalkeeperMatchStatsCard';
import { fetchMatchData, fetchPlayerMatchStats, extractEventId, getPlayerImageUrl } from '../utils/sofascoreClient';
import { createAnalysisPersistence } from '../utils/analysisPersistence';
// import GoalkeeperRadar from '../components/GoalkeeperRadar';
import DefensiveGauge from '../components/DefensiveGauge';
import PassProfileDashboard from '../components/PassProfileDashboard';

const TABS = [
  { id: 'stats', label: 'Informe', icon: BarChart3 },
  { id: 'video', label: 'Video', icon: Video },
];

function getDefaultVideoSync(periods = []) {
  const p1 = periods.find((p) => p.id === '1H') || periods[0];
  const p2 = periods.find((p) => p.id === '2H') || periods[1];
  return {
    xmlPart1: Math.round(p1?.start || 0),
    xmlPart2: Math.round(p2?.start || 2700),
    videoPart1: 0,
    videoPart2: 2700,
  };
}

function formatOffsetTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseOffsetTime(value) {
  const str = String(value || '').trim();
  if (!str) return 0;
  if (str.includes(':')) {
    const [m, s] = str.split(':').map(Number);
    return (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
  }
  const n = Number(str);
  return Number.isFinite(n) ? n : 0;
}

const PORTERO_PHOTOS = [
  'Jorge Candal.png',
  'Iker Piedra.png',
  'Marc Martínez.png',
];

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findGoalkeeperPhoto(name) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const file = PORTERO_PHOTOS.find((photo) => {
    const base = normalizeName(photo.replace(/\.[^.]+$/, ''));
    return base.includes(normalized) || normalized.includes(base) || normalized.split(' ').some((part) => part.length >= 4 && base.includes(part));
  });
  return file ? `/images/porteros/${encodeURIComponent(file)}` : null;
}

function findSettingsPhoto(name, defaultPorteros) {
  if (!name || !defaultPorteros) return null;
  const normalized = normalizeName(name);
  const match = defaultPorteros.find(p => {
    const pNorm = normalizeName(p.name);
    return pNorm.includes(normalized) || normalized.includes(pNorm);
  });
  return match?.photo || null;
}

function parseMatchFileName(fileName) {
  const base = String(fileName || '').replace(/\.xml$/i, '').replace(/\s*\((Player|Team)-based\)$/i, '').trim();
  const m = base.match(/^(.*?)\s*-\s*(.*?)\s+\d+\s*-\s*\d+$/);
  if (!m) return { matchName: base, opponent: '' };
  const home = m[1].trim();
  const away = m[2].trim();
  return { matchName: base, opponent: /^lugo$/i.test(home) ? away : home };
}

function parseAnalysisRouteId(value) {
  if (!value) return null;
  return /^\d+$/.test(value) ? Number(value) : value;
}

function AnalysisPrintOverlay({
  onClose, photo, goalkeeperName, jornadaNumber, matchName, opponent, date,
  parsed, gkStats, oppStats, passFlow, gkEvents, periods, sofascoreData,
}) {
  const onCloseRef = useRef(onClose);
  const page1Ref = useRef(null);
  const page2Ref = useRef(null);
  const page3Ref = useRef(null);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const styleId = 'analysis-print-orientation';
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '@page { size: A4 landscape; margin: 0; }',
      'html, body { height: auto !important; overflow: visible !important; background: #0c0b09 !important; }',
      '.analysis-print-stats .glass-card-static { padding: 8px 10px !important; height: 100%; }',
      '.analysis-print-stats .grid { gap: 8px !important; height: 100%; align-content: stretch; }',
      '.analysis-print-stats .mb-4 { margin-bottom: 6px !important; }',
      '.analysis-print-stats .p-5 { padding: 8px 10px !important; }',
      '.analysis-print-matrix table { font-size: 0.7rem !important; }',
      '.analysis-print-matrix td, .analysis-print-matrix th { padding: 3px 8px !important; }',
      '.analysis-print-matrix .p-4 { padding: 8px !important; }',
      '.analysis-print-matrix .text-2xl { font-size: 1.1rem !important; }',
      '.analysis-print-matrix .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 8px !important; }',
      '.analysis-print-profile > div { padding: 4px !important; border: none !important; background: transparent !important; height: 100%; overflow: hidden; }',
      '.analysis-print-profile .mb-4 { margin-bottom: 2px !important; }',
      '.analysis-print-profile .gap-6 { gap: 6px !important; }',
      '.analysis-print-profile .p-3, .analysis-print-profile .p-4 { padding: 4px !important; }',
      '.analysis-print-profile svg { max-width: 130px !important; }',
      '.analysis-print-profile .mt-2 { margin-top: 2px !important; }',
      '.analysis-print-profile .space-y-4 { --tw-space-y-reverse: 0; }',
      '.analysis-print-profile .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 6px !important; }',
      '.analysis-print-profile .h-6 { height: 14px !important; }',
      '.analysis-print-profile .text-lg { font-size: 0.85rem !important; }',
      '.analysis-print-profile .mb-3 { margin-bottom: 4px !important; }',
    ].join(' ');
    document.head.appendChild(style);
    function cleanupStyle() { document.getElementById(styleId)?.remove(); }
    function finishPrint() { cleanupStyle(); onCloseRef.current?.(); }

    const timer = setTimeout(() => {
      [page1Ref.current, page2Ref.current, page3Ref.current].forEach((el) => {
        if (!el) return;
        const pageW = el.clientWidth;
        const pageH = el.clientHeight;
        const inner = el.firstElementChild;
        if (!inner) return;
        // Reset zoom before measuring
        inner.style.zoom = '1';
        const contentW = inner.scrollWidth;
        const contentH = inner.scrollHeight;
        const scale = Math.min(pageW / contentW, pageH / contentH, 1.0);
        if (scale < 1.0) {
          inner.style.zoom = String(scale);
        }
      });
      window.print();
    }, 600);
    window.addEventListener('afterprint', finishPrint);
    return () => { clearTimeout(timer); cleanupStyle(); window.removeEventListener('afterprint', finishPrint); };
  }, []);

  const PAGE_W = '297mm';
  const PAGE_H = '210mm';
  const pageBase = { width: PAGE_W, height: PAGE_H, overflow: 'hidden', position: 'relative', background: '#0c0b09', padding: '5mm', boxSizing: 'border-box' };
  const cardStyle = { background: 'rgba(22,20,16,0.85)', border: '1px solid rgba(185,165,135,0.10)', borderRadius: 12, padding: 10 };
  const accentStyle = { color: '#e8ac65' };
  const secondaryStyle = { color: '#baa587' };

  return (
    <div
      className="analysis-print-wrapper"
      style={{ position: 'fixed', inset: 0, background: '#0c0b09', zIndex: 99999, overflow: 'hidden' }}
    >
      <button
        type="button"
        className="no-print"
        onClick={() => onCloseRef.current?.()}
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 100000, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(185,165,135,0.20)', background: 'rgba(22,20,16,0.85)', color: '#f1ede7', cursor: 'pointer', backdropFilter: 'blur(12px)' }}
      >
        Cerrar impresión
      </button>

      {/* PAGE 1: Header + StatsCards */}
      <div ref={page1Ref} className="analysis-print-page" style={pageBase}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 6, borderBottom: '1px solid rgba(185,165,135,0.10)', flexShrink: 0 }}>
            {photo && (
              <img src={photo} alt={goalkeeperName} style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(185,165,135,0.15)', flexShrink: 0 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, color: '#f1ede7' }}>
              {jornadaNumber && <span style={{ fontSize: '0.65rem', fontWeight: 600, ...accentStyle }}>Jornada {jornadaNumber}</span>}
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{matchName || 'Partido'}</span>
              {date && <span style={{ fontSize: '0.6rem', ...secondaryStyle }}>{date}</span>}
            </div>
          </div>
          {parsed ? (
            <div className="analysis-print-stats" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <StatsCards gkStats={gkStats} opponentStats={oppStats} passFlow={passFlow} />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#997b66' }}>
              <p>No hay datos de XML para mostrar en el informe.</p>
            </div>
          )}
        </div>
      </div>

      {/* PAGE 2: PassMatrix + PassProfile + EventTimeline */}
      <div ref={page2Ref} className="analysis-print-page" style={pageBase}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%' }}>
          {parsed ? (
            <>
              <div className="analysis-print-matrix" style={{ ...cardStyle, flex: '1 1 55%', minHeight: 0, overflow: 'hidden' }}>
                <PassMatrix passFlow={passFlow} goalkeeperCode={parsed?.goalkeeper?.code || ''} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, flex: '1 1 48%', minHeight: 0 }}>
                <div className="analysis-print-profile" style={{ ...cardStyle, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <PassProfileDashboard passes={gkStats.passes} />
                </div>
                <div style={{ ...cardStyle, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <EventTimelineChart events={gkEvents} opponentEvents={parsed?.opponent?.events || []} periods={periods} />
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#997b66' }}>
              <p>No hay datos de XML para mostrar en el informe.</p>
            </div>
          )}
        </div>
      </div>

      {/* PAGE 3: Heatmap + ShotMap */}
      <div ref={page3Ref} className="analysis-print-page" style={pageBase}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, height: '100%' }}>
          <div style={{ ...cardStyle, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, textAlign: 'center', ...accentStyle, flexShrink: 0 }}>
              Heatmap del Portero
            </h3>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {sofascoreData?.goalkeeperHeatmap?.heatmap ? (
                <GoalkeeperHeatmap heatmap={sofascoreData.goalkeeperHeatmap.heatmap} goalkeeperName={goalkeeperName || parsed?.goalkeeper?.name} />
              ) : (
                <p style={{ fontSize: '0.75rem', textAlign: 'center', ...secondaryStyle }}>No disponible</p>
              )}
            </div>
          </div>
          <div style={{ ...cardStyle, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, textAlign: 'center', ...accentStyle, flexShrink: 0 }}>
              Mapa de Tiros del Rival
            </h3>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {sofascoreData?.rivalShots?.length > 0 ? (
                <ShotMap shots={sofascoreData.rivalShots} isHomeGoalkeeper={sofascoreData.goalkeeper?.teamId === sofascoreData.event?.homeTeam?.id} />
              ) : (
                <p style={{ fontSize: '0.75rem', textAlign: 'center', ...secondaryStyle }}>No disponible</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef();
  const photoInputRef = useRef();
  const videoInputRef = useRef();
  const pickerVideoRef = useRef();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  const [printOpen, setPrintOpen] = useState(false);
  const [analysisId, setAnalysisId] = useState(() => parseAnalysisRouteId(id));
  const [isHydrated, setIsHydrated] = useState(() => !analysisId);
  const [seasons, setSeasons] = useState([]);

  // Form state
  const [goalkeeperName, setGoalkeeperName] = useState('');
  const [matchName, setMatchName] = useState('');
  const [opponent, setOpponent] = useState('');
  const [seasonId, setSeasonId] = useState(null);
  const [jornadaNumber, setJornadaNumber] = useState('');
  const [isAmistoso, setIsAmistoso] = useState(false);
  const [microciclo, setMicrociclo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [rating, setRating] = useState(0);
  const [rpe, setRpe] = useState(5);
  const [photo, setPhoto] = useState(null);
  const [xmlData, setXmlData] = useState(null);
  const [rawXml, setRawXml] = useState('');
  const [videoSrc, setVideoSrc] = useState('');
  const [videoType, setVideoType] = useState('');
  const [videoPath, setVideoPath] = useState('');
  const [videoBlob, setVideoBlob] = useState(null);
  const [xmlFileName, setXmlFileName] = useState('');
  const [videoSync, setVideoSync] = useState(getDefaultVideoSync());
  const [offsetPicker, setOffsetPicker] = useState(null);
  const [pickerTime, setPickerTime] = useState(0);

  // TV broadcast video
  const [tvVideoType, setTvVideoType] = useState('');
  const [tvVideoPath, setTvVideoPath] = useState('');
  const [tvVideoSrc, setTvVideoSrc] = useState('');
  const [tvVideoBlob, setTvVideoBlob] = useState(null);
  const [activeVideoSource, setActiveVideoSource] = useState('tactical');
  const tvVideoInputRef = useRef();
  const [expandedVideoSections, setExpandedVideoSections] = useState(() => new Set(['tactical']));

  // Microcycle inference
  // Find sessions in the same microciclo
  const [microcicloSessions, setMicrocicloSessions] = useState([]);
  const [defaultPorteros, setDefaultPorteros] = useState([]);
  const [porteroMenuOpen, setPorteroMenuOpen] = useState(false);
  const porteroMenuRef = useRef(null);

  useEffect(() => {
    if (!microciclo) { setMicrocicloSessions([]); return; }
    db.sessions
      .filter(s => !s.deletedAt && s.templateFields?.microciclo && String(s.templateFields.microciclo).trim() === String(microciclo).trim())
      .toArray()
      .then(setMicrocicloSessions)
      .catch(() => setMicrocicloSessions([]));
  }, [microciclo]);

  // Parsed data
  const [parsed, setParsed] = useState(null);
  const [passFlow, setPassFlow] = useState([]);
  const [clipRatings, setClipRatings] = useState({});
  const [clipCustomizations, setClipCustomizations] = useState({});
  const [clipMarks, setClipMarks] = useState({});
  const [manualClips, setManualClips] = useState([]);
  const [manualClipCategories, setManualClipCategories] = useState(DEFAULT_CLIP_CATEGORIES);

  const [matchUrl, setMatchUrl] = useState('');
  const [sofascoreData, setSofascoreData] = useState(null);
  const [sofascoreLoading, setSofascoreLoading] = useState(false);
  const [sofascoreError, setSofascoreError] = useState(null);
  const [sofascoreChanging, setSofascoreChanging] = useState(false);
  const [detectedGkMenuOpen, setDetectedGkMenuOpen] = useState(false);
  const detectedGkMenuRef = useRef(null);

  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);
  const savePromiseRef = useRef(Promise.resolve());
  const analysisPersistenceRef = useRef(null);
  if (!analysisPersistenceRef.current) {
    analysisPersistenceRef.current = createAnalysisPersistence({
      get: id => db.analyses.get(id),
      add: record => db.analyses.add(record),
      put: record => db.analyses.put(record),
    });
  }
  const analysisIdRef = useRef(analysisId);
  analysisIdRef.current = analysisId;
  const createdAtRef = useRef(null);
  const skipNextHydrationRef = useRef(false);

  function queueAnalysisUpdate(changes) {
    const id = analysisIdRef.current;
    if (!id) return Promise.resolve();
    return analysisPersistenceRef.current.update(id, changes);
  }

  function updateAnalysisField(field, value, setter, persistedValue = value) {
    setter(value);
    if (isHydrated && analysisIdRef.current) {
      queueAnalysisUpdate({ [field]: persistedValue }).catch(() => {});
    }
  }

  const autoSaveRef = useRef(async () => {});
  autoSaveRef.current = async function doSave(overrides = {}) {
    if (!isHydrated) return;
    if (savingRef.current) {
      await savePromiseRef.current;
    }
    savingRef.current = true;
    savePromiseRef.current = (async () => {
      const savedVideoType = overrides.videoType ?? videoType;
      const savedVideoSrc = overrides.videoSrc ?? videoSrc;
      const savedVideoPath = overrides.videoPath ?? videoPath;
      const savedVideoBlob = overrides.videoBlob ?? videoBlob;
      const payload = {
        goalkeeperName: goalkeeperName.trim().toUpperCase(),
        matchName: matchName.trim(),
        opponent: opponent.trim(),
        seasonId: seasonId || null,
        jornadaNumber: isAmistoso ? null : (jornadaNumber ? Number(jornadaNumber) : null),
        isAmistoso: !!isAmistoso,
        date,
        rating,
        rpe,
        goalkeeperPhoto: photo,
        xmlData: parsed,
        rawXml,
        xmlFileName,
        videoSrc: savedVideoType === 'local' ? '' : savedVideoSrc,
        videoType: savedVideoType || '',
        videoSource: savedVideoType || '',
        videoPath: savedVideoType === 'local' ? savedVideoPath : '',
        videoBlob: savedVideoType === 'local' ? savedVideoBlob : null,
        youtubeUrl: savedVideoType === 'veo' ? savedVideoSrc : '',
        videoSync,
        tvVideoType: tvVideoType || '',
        tvVideoPath: tvVideoType === 'local' ? tvVideoPath : '',
        tvVideoSrc: tvVideoType === 'youtube' ? tvVideoSrc : '',
        tvVideoBlob: tvVideoType === 'local' ? tvVideoBlob : null,
        tvVideoSync: getDefaultVideoSync(),
        activeVideoSource,
        microciclo: microciclo || null,
        clipRatings,
        clipCustomizations,
        clipMarks,
        manualClips,
        manualClipCategories,
        matchUrl,
        sofascoreData,
        createdAt: createdAtRef.current || new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      if (analysisIdRef.current) {
        createdAtRef.current = payload.createdAt;
        await queueAnalysisUpdate(payload);
      } else {
        let existing = null;
        if (seasonId && xmlFileName) {
          existing = await db.analyses.where('[seasonId+xmlFileName]').equals([seasonId, xmlFileName]).first();
        }
        const newId = existing?.id
          ? (await analysisPersistenceRef.current.update(existing.id, { ...payload, createdAt: existing.createdAt || payload.createdAt }), existing.id)
          : await analysisPersistenceRef.current.create(payload);
        analysisIdRef.current = newId;
        skipNextHydrationRef.current = true;
        setAnalysisId(newId);
        navigate(`/analysis/${newId}`, { replace: true });
      }
    })();
    try {
      await savePromiseRef.current;
    } catch (err) {
      console.error('Auto-save error:', err);
    } finally {
      savingRef.current = false;
    }
  };

  function scheduleAutoSave() {
    if (!isHydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => autoSaveRef.current(), 800);
  }

  useEffect(() => {
    const isNewRoute = location.pathname === '/analysis/new';
    const nextId = isNewRoute ? null : parseAnalysisRouteId(id);
    if (nextId === analysisIdRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    analysisIdRef.current = nextId;
    setAnalysisId(nextId);
    setIsHydrated(!nextId);
  }, [id, location.pathname]);

  useEffect(() => {
    scheduleAutoSave();
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [isHydrated, goalkeeperName, matchName, opponent, seasonId, jornadaNumber, isAmistoso, microciclo, date, rating, rpe, photo, rawXml, xmlFileName, parsed, videoSrc, videoType, videoPath, videoBlob, videoSync, matchUrl, sofascoreData, clipMarks, manualClips, manualClipCategories, tvVideoType, tvVideoPath, tvVideoSrc, tvVideoBlob, activeVideoSource]);

  useEffect(() => {
    async function loadSeasons() {
      const rows = await db.seasons.toArray();
      const sorted = rows.filter((s) => !s.deletedAt).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setSeasons(sorted);
    }
    loadSeasons();
    getSetting('defaultPorteros').then(p => { if (p) setDefaultPorteros(p); });
  }, []);

  useEffect(() => {
    if (!porteroMenuOpen) return;
    function onDown(e) {
      if (porteroMenuRef.current && !porteroMenuRef.current.contains(e.target)) {
        setPorteroMenuOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setPorteroMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [porteroMenuOpen]);

  useEffect(() => {
    if (!detectedGkMenuOpen) return;
    function onDown(e) {
      if (detectedGkMenuRef.current && !detectedGkMenuRef.current.contains(e.target)) {
        setDetectedGkMenuOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setDetectedGkMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [detectedGkMenuOpen]);

  useEffect(() => {
    if (!seasonId && seasons.length > 0 && !analysisId) {
      setSeasonId(seasons[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasons, analysisId]);

  // Load existing analysis
  useEffect(() => {
    if (!analysisId) return;
    if (skipNextHydrationRef.current) {
      skipNextHydrationRef.current = false;
      setIsHydrated(true);
      return;
    }
    async function load() {
      const a = await db.analyses.get(analysisId);
      if (!a) {
        addToast('Análisis no encontrado', 'error');
        setIsHydrated(true);
        navigate('/analysis');
        return;
      }
      analysisIdRef.current = a.id;
      setAnalysisId(a.id);
      createdAtRef.current = a.createdAt || null;
      setGoalkeeperName(a.goalkeeperName || '');
      setMatchName(a.matchName || '');
      setOpponent(a.opponent || '');
      setSeasonId(a.seasonId || null);
      setJornadaNumber(a.jornadaNumber ? String(a.jornadaNumber) : '');
      setIsAmistoso(!!a.isAmistoso);
      setMicrociclo(a.microciclo || '');
      setDate(a.date || new Date().toISOString().split('T')[0]);
      setRating(a.rating || 0);
      setRpe(a.rpe || 5);
      setPhoto(a.goalkeeperPhoto || findSettingsPhoto(a.goalkeeperName, defaultPorteros) || findGoalkeeperPhoto(a.goalkeeperName) || null);
      setRawXml(a.rawXml || '');
      const inferredVideoType = a.videoType || a.videoSource || (a.videoPath || a.videoBlob ? 'local' : (a.youtubeUrl ? 'veo' : ''));
      setVideoType(inferredVideoType);
      setVideoSrc(inferredVideoType === 'local'
        ? (a.videoPath
          ? `file:///${String(a.videoPath).replace(/\\/g, '/')}`
          : (a.videoBlob ? URL.createObjectURL(a.videoBlob) : ''))
        : (a.videoSrc || a.youtubeUrl || ''));
      setVideoPath(a.videoPath || '');
      setVideoBlob(a.videoBlob || null);
      setXmlFileName(a.xmlFileName || '');
      setVideoSync(a.videoSync || getDefaultVideoSync(a.xmlData?.periods || []));
      const inferredTvVideoType = a.tvVideoType || a.tvVideoSource || (a.tvVideoPath || a.tvVideoBlob ? 'local' : (a.tvVideoSrc ? 'youtube' : ''));
      setTvVideoType(inferredTvVideoType);
      setTvVideoPath(a.tvVideoPath || '');
      setTvVideoSrc(inferredTvVideoType === 'local' && a.tvVideoBlob
        ? URL.createObjectURL(a.tvVideoBlob)
        : (a.tvVideoSrc || ''));
      setTvVideoBlob(a.tvVideoBlob || null);
      setActiveVideoSource(a.activeVideoSource || 'tactical');
      setExpandedVideoSections(new Set(['tactical', ...(a.tvVideoType ? ['tv'] : [])]));
       setClipRatings(a.clipRatings || {});
       setClipCustomizations(a.clipCustomizations || {});
       setClipMarks(a.clipMarks || {});
       setManualClips(Array.isArray(a.manualClips) ? a.manualClips : []);
       setManualClipCategories(Array.isArray(a.manualClipCategories) ? a.manualClipCategories : DEFAULT_CLIP_CATEGORIES);
      if (a.matchUrl) setMatchUrl(a.matchUrl);
      if (a.sofascoreData) setSofascoreData(a.sofascoreData);
        if (a.rawXml) {
        await parseAndSet(a.rawXml);
        } else if (a.xmlData) {
          setParsed(a.xmlData);
          if (a.xmlData.goalkeeper?.events && a.xmlData.allEvents) {
            const gkCode = a.xmlData.goalkeeper.code;
            const teams = a.xmlData.teams || { home: [], away: [] };
            const isHome = teams.home.some(p => p.code === gkCode);
            const teammateCodes = (isHome ? teams.home : teams.away).map(p => p.code);
            const pfResult = computeBidirectionalFlow(gkCode, a.xmlData.allEvents, teammateCodes);
            setPassFlow(pfResult.flow);
        }
      }
      setIsHydrated(true);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  // Si sofascoreData viene de la BD sin goalkeeperMatchStats, se fetchca ahora
  useEffect(() => {
    if (!sofascoreData || !matchUrl) return;
    if (sofascoreData.goalkeeperMatchStats !== undefined) return;
    const eventId = extractEventId(matchUrl);
    const playerId = sofascoreData.goalkeeper?.player?.id;
    if (!eventId || !playerId) return;

    let cancelled = false;
    fetchPlayerMatchStats(eventId, playerId).then((stats) => {
      if (cancelled || !stats) return;
      const updated = { ...sofascoreData, goalkeeperMatchStats: stats };
      setSofascoreData(updated);
      if (analysisId) {
        queueAnalysisUpdate({
          matchUrl,
          sofascoreData: updated,
        }).catch(() => {});
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sofascoreData, matchUrl, analysisId]);

  const parseAndSet = useCallback(async (xmlString) => {
    try {
      const defaultPorteros = (await getSetting('defaultPorteros')) || [];
      const data = parseMatchXml(xmlString, { goalkeeperNames: defaultPorteros });
      setParsed(data);
      if (data.goalkeeper?.events && data.allEvents) {
        const gkCode = data.goalkeeper.code;
        const teams = data.teams || { home: [], away: [] };
        const isHome = teams.home.some(p => p.code === gkCode);
        const teammateCodes = (isHome ? teams.home : teams.away).map(p => p.code);
        const pfResult = computeBidirectionalFlow(gkCode, data.allEvents, teammateCodes);
        setPassFlow(pfResult.flow);
      }
      if (!goalkeeperName && data.goalkeeper?.name) {
        setGoalkeeperName(data.goalkeeper.name);
      }
      if (!photo) {
        const settingsPhoto = findSettingsPhoto(data.goalkeeper?.name, defaultPorteros);
        const detectedPhoto = settingsPhoto || findGoalkeeperPhoto(data.goalkeeper?.name);
        if (detectedPhoto) setPhoto(detectedPhoto);
      }
      return data;
    } catch (err) {
      console.error('XML parse error:', err);
      addToast('Error al parsear XML: ' + err.message, 'error');
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalkeeperName]);

  async function handleXmlUpload(file) {
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      setRawXml(text);
      setXmlFileName(file.name || '');
      const inferred = parseMatchFileName(file.name);
      if (!matchName && inferred.matchName) setMatchName(inferred.matchName);
      if (!opponent && inferred.opponent) setOpponent(inferred.opponent);
      const data = await parseAndSet(text);
      if (data?.periods) setVideoSync(getDefaultVideoSync(data.periods));
      addToast('XML cargado correctamente', 'success');
    } catch (err) {
      addToast('Error leyendo XML', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setPhoto(e.target.result);
    reader.readAsDataURL(file);
  }

  const handleFetchSofaScore = async () => {
    if (!matchUrl || !goalkeeperName.trim()) return;
    setSofascoreLoading(true);
    setSofascoreError(null);
    try {
      const data = await fetchMatchData(matchUrl, goalkeeperName);
      setSofascoreData(data);
      if (analysisId) {
        await queueAnalysisUpdate({
          matchUrl,
          sofascoreData: data,
        });
      }
    } catch (err) {
      setSofascoreError(err.message);
    } finally {
      setSofascoreLoading(false);
    }
  };

  const handleChangeDetectedGoalkeeper = async (candidate) => {
    if (!matchUrl || !candidate?.playerId) return;
    setSofascoreChanging(true);
    setSofascoreError(null);
    try {
      const data = await fetchMatchData(matchUrl, goalkeeperName, candidate.playerId);
      setSofascoreData(data);
      if (analysisId) {
        await queueAnalysisUpdate({
          matchUrl,
          sofascoreData: data,
        });
      }
      setDetectedGkMenuOpen(false);
    } catch (err) {
      setSofascoreError(err.message);
    } finally {
      setSofascoreChanging(false);
    }
  };

  const handleManualClipCreate = (clip) => {
    const usedIds = new Set(manualClips.map((item) => item.id));
    let nextNumber = manualClips.reduce((max, item) => {
      const match = String(item.id || '').match(/^M-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
    let id = `M-${String(nextNumber).padStart(3, '0')}`;
    while (usedIds.has(id)) {
      nextNumber += 1;
      id = `M-${String(nextNumber).padStart(3, '0')}`;
    }
    const manualClip = { ...clip, id, createdAt: new Date().toISOString() };
    const updated = [...manualClips, manualClip];
    setManualClips(updated);
    if (analysisId) {
      queueAnalysisUpdate({ manualClips: updated }).catch(() => {});
    }
  };

  const handleManualClipDelete = (clipId) => {
    const updated = manualClips.filter((clip) => clip.id !== clipId);
    setManualClips(updated);
    if (analysisId) {
      queueAnalysisUpdate({ manualClips: updated }).catch(() => {});
    }
  };

  const handleManualClipUpdate = (clipId, changes) => {
    const updated = manualClips.map((clip) => clip.id === clipId ? { ...clip, ...changes } : clip);
    setManualClips(updated);
    if (analysisId) {
      queueAnalysisUpdate({ manualClips: updated }).catch(() => {});
    }
  };

  const handleManualClipCategoriesChange = (categories) => {
    const updated = Array.from(new Set(categories));
    setManualClipCategories(updated);
    if (analysisId) {
      queueAnalysisUpdate({ manualClipCategories: updated }).catch(() => {});
    }
  };

  const handleClipMarkChange = (clipId, mark) => {
    const updated = { ...clipMarks };
    if (mark) updated[clipId] = mark;
    else delete updated[clipId];
    setClipMarks(updated);
    if (analysisId) {
      queueAnalysisUpdate({ clipMarks: updated }).catch(() => {});
    }
  };

  function toggleVideoSection(key) {
    setExpandedVideoSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleVideoUpload(file) {
    if (window.electronAPI?.pickVideoFile) {
      const picked = await window.electronAPI.pickVideoFile();
      if (!picked) return;
      setVideoPath(picked);
      setVideoSrc(`file:///${picked.replace(/\\/g, '/')}`);
      setVideoBlob(null);
      setVideoType('local');
      return;
    }
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoBlob(file);
    setVideoType('local');
  }

  function handleVeoUrlChange(value) {
    setVideoSrc(value);
    setVideoPath('');
    setVideoBlob(null);
    setVideoType('veo');

    const id = analysisIdRef.current;
    if (id) {
      queueAnalysisUpdate({
        videoSrc: value,
        youtubeUrl: value,
        videoType: 'veo',
        videoSource: 'veo',
        videoPath: '',
        videoBlob: null,
      }).catch(() => {});
    } else {
      autoSaveRef.current({
        videoSrc: value,
        videoType: 'veo',
        videoPath: '',
        videoBlob: null,
      });
    }
  }

  function clearVideoData() {
    setVideoSrc('');
    setVideoType('');
    setVideoPath('');
    setVideoBlob(null);
    setVideoSync(getDefaultVideoSync(periods));
  }

  function clearTvVideoData() {
    setTvVideoSrc('');
    setTvVideoType('');
    setTvVideoPath('');
    setTvVideoBlob(null);
  }

  async function handleTvVideoUpload(file) {
    if (window.electronAPI?.pickVideoFile) {
      const picked = await window.electronAPI.pickVideoFile();
      if (!picked) return;
      setTvVideoPath(picked);
      setTvVideoBlob(null);
      setTvVideoType('local');
      return;
    }
    if (!file) return;
    const url = URL.createObjectURL(file);
    setTvVideoSrc(url);
    setTvVideoBlob(file);
    setTvVideoType('local');
  }

  function setVideoSyncTime(key, value) {
    setVideoSync((v) => ({ ...v, [key]: parseOffsetTime(value) }));
  }

  function openOffsetPicker(part) {
    if (!videoSrc) {
      addToast('Selecciona un vídeo primero para usar el selector de offsets', 'warning');
      return;
    }
    setOffsetPicker({ part });
    setTimeout(() => {
      const player = pickerVideoRef.current;
      if (!player) return;
      const target = part === 'part1' ? videoSync.videoPart1 : videoSync.videoPart2;
      player.currentTime = Math.max(0, Number(target) || 0);
      setPickerTime(player.currentTime || 0);
    }, 0);
  }

  function closeOffsetPicker() {
    const player = pickerVideoRef.current;
    if (player) {
      player.pause();
      player.removeAttribute('src');
      player.load();
    }
    setOffsetPicker(null);
    setPickerTime(0);
  }

  function seekOffsetPicker(delta) {
    const player = pickerVideoRef.current;
    if (!player) return;
    player.currentTime = Math.max(0, player.currentTime + delta);
    setPickerTime(player.currentTime || 0);
  }

  function confirmOffsetPicker() {
    if (!offsetPicker) return;
    const player = pickerVideoRef.current;
    const value = Math.floor(player?.currentTime || pickerTime || 0);
    setVideoSync((v) => ({
      ...v,
      videoPart1: offsetPicker.part === 'part1' ? value : v.videoPart1,
      videoPart2: offsetPicker.part === 'part1' ? value + 3900 : value,
    }));
    closeOffsetPicker();
  }

  async function handleDelete() {
    if (!analysisId) return;
    const ok = await confirm('¿Eliminar este análisis?', 'Esta acción no se puede deshacer.');
    if (!ok) return;
    await db.analyses.update(analysisId, { deletedAt: new Date(), updatedAt: new Date() });
    addToast('Análisis eliminado', 'success');
    navigate('/analysis');
  }

  const gkStats = parsed?.goalkeeper?.stats || {};
  const oppStats = parsed?.opponent?.stats || {};
  const gkEvents = parsed?.goalkeeper?.events || [];
  const activePorteros = defaultPorteros.filter(p => p.active === true || p.active === 'true');
  const videoEvents = (() => {
    const byId = new Map();
    for (const ev of gkEvents) byId.set(ev.id, ev);
    
    const gkCode = parsed?.goalkeeper?.code;
    const teams = parsed?.teams || { home: [], away: [] };
    const isHome = teams.home.some(p => p.code === gkCode);
    const myTeamCodes = isHome 
      ? teams.home.map(p => p.code) 
      : teams.away.map(p => p.code);
    for (const ev of parsed?.allEvents || []) {
      if (ev.labels?.some((l) => l.text === 'Goal kick') && myTeamCodes.includes(ev.code)) {
        byId.set(ev.id, ev);
      }
    }
    // Opponent crosses, shots (incl. off-target), and corners
    const OPPONENT_INTEREST = new Set(['Cross', 'Free kick cross', 'Shot', 'Head shot', 'Free kick shot', 'Shot after corner', 'Shot after throw in', 'Corner']);
    for (const ev of parsed?.opponent?.events || []) {
      if (ev.labels?.some(l => OPPONENT_INTEREST.has(l.text))) {
        byId.set(ev.id, ev);
      }
    }
    const sorted = Array.from(byId.values()).sort((a, b) => a.start - b.start);
    return mergeTouchEvents(sorted);
  })();
  const periods = parsed?.periods || [];
  const isTv = activeVideoSource === 'tv';
  const tvVideoUrl = tvVideoType === 'local' && tvVideoPath ? `file:///${tvVideoPath.replace(/\\/g, '/')}` : tvVideoSrc || '';
  const activeSrc = isTv ? tvVideoUrl : videoSrc;
  const activeType = isTv ? tvVideoType : videoType;
  const activePath = isTv ? tvVideoPath : videoPath;

  return (
    <>
    <div className="animate-v2-fade-in-up -mx-4 -my-6 px-4 py-6 min-h-[calc(100vh-4rem)]" style={{ backgroundColor: '#0c0b09' }}>
      {/* ── HEADER HERO ── */}
      <div className="glass-card p-4 mb-6 v2-header-gradient" style={{ borderRadius: 20 }}>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
              await autoSaveRef.current();
              navigate('/analysis');
            }}
            className="v2-btn-ghost rounded-xl p-2 shrink-0"
            style={{ borderRadius: 12, padding: 8 }}
          >
            <ArrowLeft size={18} />
          </button>
          {photo && (
            <div className="shrink-0">
              <img src={photo} alt={goalkeeperName} style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', border: '2px solid rgba(232,172,101,0.25)' }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-bold truncate" style={{ color: '#f1ede7' }}>
              <span className="v2-text-gradient">{goalkeeperName || 'Portero'}</span>
              {(matchName || opponent) && (
                <span style={{ color: '#baa587', fontWeight: 400 }}>
                  {' '}vs{' '}
                  <span style={{ color: '#f1ede7' }}>{opponent || matchName}</span>
                </span>
              )}
            </h1>
          </div>
          {analysisId && (
            <button onClick={handleDelete} className="v2-btn-danger shrink-0">
              <Trash2 size={14} />
              <span className="hidden sm:inline">Eliminar</span>
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN LAYOUT: sidebar + content ── */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── SIDEBAR ── */}
        <div className={`${activeTab === 'video' ? 'hidden' : 'w-full lg:w-72 shrink-0 space-y-4'}`}>
          {/* Photo */}
          <div className="glass-card-static p-5">
            <div className="flex justify-center mb-3">
              {photo ? (
                <div className="relative">
                  <img
                    src={photo}
                    alt={goalkeeperName}
                    style={{
                      width: 160,
                      height: 200,
                      borderRadius: 14,
                      objectFit: 'cover',
                      border: '1px solid rgba(232,172,101,0.15)',
                    }}
                  />
                  <button
                    onClick={() => setPhoto(null)}
                    className="absolute -top-2 -right-2 p-1 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(208,140,96,0.8)', color: 'white' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center cursor-pointer transition-colors"
                  style={{
                    width: 160,
                    height: 200,
                    borderRadius: 14,
                    border: '2px dashed rgba(185,165,135,0.15)',
                    color: '#997b66',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(232,172,101,0.3)'; e.currentTarget.style.color = '#baa587'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(185,165,135,0.15)'; e.currentTarget.style.color = '#997b66'; }}
                >
                  <User size={32} />
                  <span className="text-xs mt-2">Añadir foto</span>
                </div>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
            />
          </div>

          <div className="glass-card-static p-5">
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{color: '#997b66'}}>Valoración</span>
                <StarRating value={rating} onChange={value => updateAnalysisField('rating', value, setRating)} size={16} />
              </div>
              <div style={{ width: 1, height: 28, background: 'rgba(185,165,135,0.10)' }} />
              <div style={{ width: 100 }}>
                <RPESlider value={rpe} onChange={value => updateAnalysisField('rpe', value, setRpe)} />
              </div>
            </div>
          </div>

          {/* Form fields */}
          <div className="glass-card-static p-5 space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: '#997b66' }}>Partido</label>
              <input
                type="text"
                value={matchName}
                 onChange={(e) => updateAnalysisField('matchName', e.target.value, setMatchName)}
                placeholder="Lugo - Rival"
                className="v2-input w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: '#997b66' }}>Portero</label>
              <div ref={porteroMenuRef} className="relative">
                <input
                  type="text"
                  value={goalkeeperName}
                   onChange={(e) => updateAnalysisField('goalkeeperName', e.target.value, setGoalkeeperName, e.target.value.trim().toUpperCase())}
                  placeholder="Nombre del portero"
                  className="v2-input w-full"
                  style={{ paddingRight: 32 }}
                />
                <button
                  type="button"
                  onClick={() => setPorteroMenuOpen(o => !o)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                  style={{ color: porteroMenuOpen ? '#e8ac65' : '#997b66', cursor: 'pointer' }}
                  title="Elegir portero por defecto"
                >
                  <ChevronDown size={14} className={`transition-transform ${porteroMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {porteroMenuOpen && (
                  <div
                    className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg"
                    style={{ background: '#171512', border: '1px solid rgba(232,172,101,0.2)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                  >
                    {activePorteros.length === 0 && (
                      <div className="px-3 py-2 text-xs" style={{ color: '#997b66' }}>
                        No hay porteros activos en Ajustes
                      </div>
                    )}
                    {activePorteros.map((p, i) => {
                      const isSelected = normalizeName(p.name) === normalizeName(goalkeeperName);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                             const selectedName = String(p.name || '').toUpperCase();
                             updateAnalysisField('goalkeeperName', selectedName, setGoalkeeperName, selectedName);
                            if (p.photo) setPhoto(p.photo);
                            setPorteroMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                          style={{
                            background: isSelected ? 'rgba(232,172,101,0.10)' : 'transparent',
                            color: '#f1ede7',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isSelected ? 'rgba(232,172,101,0.10)' : 'rgba(232,172,101,0.08)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? 'rgba(232,172,101,0.10)' : 'transparent'; }}
                        >
                          {p.photo ? (
                            <img src={p.photo} alt={p.name} className="w-6 h-6 rounded object-cover" />
                          ) : (
                            <span className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'rgba(22,20,16,0.8)', border: '1px solid rgba(185,165,135,0.15)', color: '#997b66' }}>
                              <User size={12} />
                            </span>
                          )}
                          <span className="truncate">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: '#997b66' }}>Rival</label>
              <input
                type="text"
                value={opponent}
                 onChange={(e) => updateAnalysisField('opponent', e.target.value, setOpponent)}
                placeholder="Equipo rival"
                className="v2-input w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: '#997b66' }}>Temporada <span style={{ color: '#d08c60' }}>*</span></label>
              <select
                value={seasonId || ''}
                 onChange={(e) => updateAnalysisField('seasonId', e.target.value || null, setSeasonId)}
                className="v2-select w-full"
              >
                <option value="" disabled>Seleccionar temporada</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: '#997b66' }}>Microciclo <span style={{ color: '#d08c60' }}>*</span></label>
              <input
                type="number"
                min="1"
                value={microciclo}
                 onChange={(e) => updateAnalysisField('microciclo', e.target.value, setMicrociclo)}
                placeholder="Ej: 12"
                className="v2-input w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: '#997b66' }}>Jornada</label>
              <input
                type="number"
                min="1"
                value={jornadaNumber}
                 onChange={(e) => updateAnalysisField('jornadaNumber', e.target.value, setJornadaNumber, e.target.value ? Number(e.target.value) : null)}
                placeholder="Ej: 12"
                className="v2-input w-full"
                disabled={isAmistoso}
                style={isAmistoso ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAmistoso}
                   onChange={(e) => {
                     const checked = e.target.checked;
                     setIsAmistoso(checked);
                     if (checked) setJornadaNumber('');
                     if (isHydrated && analysisIdRef.current) {
                       queueAnalysisUpdate({ isAmistoso: checked, jornadaNumber: checked ? null : (jornadaNumber ? Number(jornadaNumber) : null) }).catch(() => {});
                     }
                   }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#e8ac65] after:bg-[#997b66]"
                  style={{ background: isAmistoso ? '#e8ac65' : 'rgba(185,165,135,0.2)' }}
                />
              </label>
              <span className="text-xs font-medium" style={{ color: isAmistoso ? '#e8ac65' : '#997b66' }}>Amistoso</span>
            </div>
            <div className="pt-2" style={{ borderTop: '1px solid rgba(185,165,135,0.08)' }}>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1" style={{ color: '#997b66' }}>
                <Link size={12} /> URL SofaScore
              </label>
              <input
                type="url"
                value={matchUrl}
                 onChange={(e) => updateAnalysisField('matchUrl', e.target.value, setMatchUrl)}
                placeholder="https://www.sofascore.com/..."
                className="v2-input w-full"
              />
              <button
                onClick={handleFetchSofaScore}
                disabled={sofascoreLoading || !matchUrl}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  background: 'rgba(232,172,101,0.12)',
                  color: '#e8ac65',
                  border: '1px solid rgba(232,172,101,0.15)',
                  opacity: (sofascoreLoading || !matchUrl) ? 0.4 : 1,
                  cursor: (sofascoreLoading || !matchUrl) ? 'not-allowed' : 'pointer',
                }}
              >
                {sofascoreLoading ? (
                  <div className="animate-spin h-3 w-3 border-b-2 rounded-full" style={{ borderColor: '#e8ac65' }} />
                ) : (
                  <Download size={12} />
                )}
                {sofascoreLoading ? 'Cargando...' : 'Cargar datos SofaScore'}
              </button>
              {sofascoreError && (
                <div className="mt-1 text-xs" style={{ color: '#d08c60' }}>{sofascoreError}</div>
              )}
              {sofascoreData && (
                <>
                  <div className="mt-1 flex items-center gap-1 text-xs" style={{ color: '#e8ac65' }}>
                    <CheckCircle size={12} />
                    <span>Datos cargados: {sofascoreData.goalkeeperHeatmap?.heatmap?.length || 0} puntos heatmap, {sofascoreData.rivalShots?.length || 0} tiros</span>
                  </div>
                  <div ref={detectedGkMenuRef} className="mt-2 relative">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(22,20,16,0.5)', border: '1px solid rgba(185,165,135,0.12)' }}>
                      {sofascoreData.goalkeeper?.player?.id && (
                        <img
                          src={getPlayerImageUrl(sofascoreData.goalkeeper.player.id)}
                          alt=""
                          className="w-5 h-5 rounded object-cover shrink-0"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <span className="text-xs truncate flex-1" style={{ color: '#997b66' }}>
                        Portero: <span style={{ color: '#e8ac65' }}>{sofascoreData.goalkeeper?.player?.name || '?'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setDetectedGkMenuOpen(o => !o)}
                        className="p-1 rounded shrink-0"
                        style={{ color: detectedGkMenuOpen ? '#e8ac65' : '#997b66', cursor: 'pointer' }}
                        title="Cambiar portero detectado"
                      >
                        {sofascoreChanging ? (
                          <div className="animate-spin h-3 w-3 border-b-2 rounded-full" style={{ borderColor: '#e8ac65' }} />
                        ) : (
                          <ChevronDown size={14} className={`transition-transform ${detectedGkMenuOpen ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                    </div>
                    {detectedGkMenuOpen && (
                      <div
                        className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg"
                        style={{ background: '#171512', border: '1px solid rgba(232,172,101,0.2)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                      >
                        {sofascoreData.goalkeeperCandidates?.length ? (
                          sofascoreData.goalkeeperCandidates.map((c) => {
                            const active = c.playerId === sofascoreData.goalkeeper?.player?.id;
                            return (
                              <button
                                key={c.playerId}
                                type="button"
                                onClick={() => handleChangeDetectedGoalkeeper(c)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                                style={{
                                  background: active ? 'rgba(232,172,101,0.10)' : 'transparent',
                                  color: '#f1ede7',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = active ? 'rgba(232,172,101,0.10)' : 'rgba(232,172,101,0.08)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'rgba(232,172,101,0.10)' : 'transparent'; }}
                              >
                                <img
                                  src={c.photoUrl}
                                  alt=""
                                  className="w-5 h-5 rounded object-cover shrink-0"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                                <span className="truncate flex-1">{c.name}</span>
                                <span className="text-[10px] truncate max-w-[90px]" style={{ color: '#997b66' }}>{c.teamName}</span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-2 text-xs" style={{ color: '#997b66' }}>No hay porteros alternativos en las alineaciones</div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            {microciclo && (
              <div className="pt-2" style={{ borderTop: '1px solid rgba(185,165,135,0.08)' }}>
                <div className="text-xs font-medium mb-1" style={{ color: '#997b66' }}>Microciclo</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: '#e8ac65', fontFamily: "'JetBrains Mono', monospace" }}>MC-{microciclo}</span>
                  <span className="text-xs" style={{ color: '#997b66' }}>({microcicloSessions.length} sesiones)</span>
                </div>
                {microcicloSessions.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {microcicloSessions.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-[11px]" style={{ color: '#997b66' }}>
                        <span className="truncate max-w-[120px]">{s.name}</span>
                        <span className="tabular-nums" style={{fontFamily: "'JetBrains Mono', monospace"}}>
                          RPE: {Object.values(s.rpePorteros || {}).filter(v => v > 0).length > 0
                            ? (Object.values(s.rpePorteros).reduce((a, b) => a + b, 0) / Object.values(s.rpePorteros).filter(v => v > 0).length).toFixed(1)
                            : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* XML upload */}
          <div className="glass-card-static p-5">
            <label className="text-xs font-medium mb-2 block flex items-center gap-1" style={{ color: '#997b66' }}>
              <FileText size={12} /> Archivo XML
            </label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{
                background: 'rgba(22,20,16,0.6)',
                border: '1px dashed rgba(185,165,135,0.15)',
                color: '#baa587',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(232,172,101,0.25)'; e.currentTarget.style.color = '#f1ede7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(185,165,135,0.15)'; e.currentTarget.style.color = '#baa587'; }}
            >
              <Upload size={14} />
              {rawXml ? 'Cambiar XML' : 'Subir XML'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={(e) => handleXmlUpload(e.target.files?.[0])}
            />
            {rawXml && (
              <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: '#e8ac65' }}>
                <Shield size={12} />
                <span>XML cargado ({parsed?.goalkeeper?.events?.length || 0} eventos)</span>
              </div>
            )}
            {loading && (
              <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: '#997b66' }}>
                <div className="animate-spin h-3 w-3 border-b-2 rounded-full" style={{ borderColor: '#e8ac65' }} />
                Parseando XML...
              </div>
            )}
          </div>

          {/* Video sources */}
          <div className="glass-card-static p-5">
            <label className="text-xs font-medium mb-3 block flex items-center gap-1" style={{ color: '#997b66' }}>
              <Video size={12} /> Videos del partido
            </label>

            {/* Tactical camera */}
            <div style={{ borderRadius: 12, border: expandedVideoSections.has('tactical') ? '1px solid rgba(232,172,101,0.15)' : '1px solid rgba(185,165,135,0.08)', overflow: 'hidden' }}>
              <button
                onClick={() => toggleVideoSection('tactical')}
                className="w-full flex items-center justify-between px-3 py-3 transition-colors"
                style={{
                  background: expandedVideoSections.has('tactical') ? 'rgba(232,172,101,0.06)' : 'rgba(22,20,16,0.4)',
                }}
              >
                <div className="flex items-center gap-2">
                  {expandedVideoSections.has('tactical') ? <ChevronDown size={14} style={{color: '#e8ac65'}} /> : <ChevronRight size={14} style={{color: '#997b66'}} />}
                  <span className="text-xs font-semibold" style={{ color: expandedVideoSections.has('tactical') ? '#e8ac65' : '#f1ede7' }}>Cámara Táctica</span>
                </div>
                {videoType && <CheckCircle size={14} style={{ color: '#22c55e', flexShrink: 0 }} />}
              </button>
              {expandedVideoSections.has('tactical') && (
                <div className="p-3 space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setVideoSrc(''); setVideoPath(''); setVideoType('local'); }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all"
                      style={{
                        background: videoType === 'local' ? 'rgba(232,172,101,0.12)' : 'rgba(22,20,16,0.6)',
                        borderColor: videoType === 'local' ? 'rgba(232,172,101,0.35)' : 'rgba(185,165,135,0.10)',
                        color: videoType === 'local' ? '#e8ac65' : '#baa587',
                      }}
                    >Local</button>
                    <button
                      onClick={() => { setVideoPath(''); setVideoBlob(null); setVideoType('veo'); }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all"
                      style={{
                        background: videoType === 'veo' ? 'rgba(232,172,101,0.12)' : 'rgba(22,20,16,0.6)',
                        borderColor: videoType === 'veo' ? 'rgba(232,172,101,0.35)' : 'rgba(185,165,135,0.10)',
                        color: videoType === 'veo' ? '#e8ac65' : '#baa587',
                      }}
                    >Veo</button>
                  </div>
                  {videoType === 'veo' && (
                    <input
                      type="url"
                      value={videoSrc}
                      onChange={(e) => handleVeoUrlChange(e.target.value)}
                      placeholder="Pega aquí el enlace directo del video (MP4)..."
                      className="v2-input w-full"
                    />
                  )}
                  {videoType === 'local' && (
                    <button
                      onClick={() => videoInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
                      style={{
                        background: 'rgba(22,20,16,0.6)',
                        border: '1px dashed rgba(185,165,135,0.15)',
                        color: '#baa587',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(232,172,101,0.25)'; e.currentTarget.style.color = '#f1ede7'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(185,165,135,0.15)'; e.currentTarget.style.color = '#baa587'; }}
                    >
                      <Upload size={14} />
                      {videoSrc ? 'Cambiar video' : 'Subir video'}
                    </button>
                  )}
                  <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleVideoUpload(e.target.files?.[0])} />
                  {videoType === 'local' && videoPath && (
                    <div className="space-y-1">
                      <div className="text-[11px] break-all" style={{ color: '#997b66' }}>{videoPath}</div>
                      <button onClick={() => handleVideoUpload(null)} className="text-[11px]" style={{ color: '#d08c60' }}>Si falla la ruta, re-vincular vídeo</button>
                    </div>
                  )}
                  {videoType === 'veo' && videoSrc && (
                    <div className="text-xs" style={{ color: '#e8ac65' }}>Enlace Veo cargado</div>
                  )}
                  {videoType && (
                    <button onClick={clearVideoData} className="text-[11px] flex items-center gap-1" style={{ color: '#d08c60' }}>
                      <X size={12} /> Desvincular vídeo
                    </button>
                  )}

                  <div className="pt-2" style={{ borderTop: '1px solid rgba(185,165,135,0.08)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium" style={{ color: '#997b66' }}>Establecer offsets</span>
                      <button onClick={() => setVideoSync(getDefaultVideoSync(periods))} className="text-[11px]" style={{ color: '#997b66' }}>Reset</button>
                    </div>
                    <div style={{ borderRadius: 10, border: '1px solid rgba(185,165,135,0.08)', overflow: 'hidden' }}>
                      <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'rgba(22,20,16,0.4)' }}>
                            <th className="text-left p-2" style={{ borderBottom: '1px solid rgba(185,165,135,0.08)', color: '#997b66', width: '50%' }}>1ª parte</th>
                            <th className="text-left p-2" style={{ borderBottom: '1px solid rgba(185,165,135,0.08)', color: '#997b66', width: '50%' }}>2ª parte</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="p-1" style={{ borderBottom: '1px solid rgba(185,165,135,0.08)' }}>
                              <div className="flex items-center gap-1">
                                <input type="text" value={formatOffsetTime(videoSync.videoPart1)} onChange={(e) => setVideoSyncTime('videoPart1', e.target.value)}
                                  className="v2-input" style={{width: 48, padding: '4px 6px', fontSize: '8px', fontFamily: "'JetBrains Mono', monospace"}} />
                                <button onClick={() => openOffsetPicker('part1')} className="v2-btn-ghost p-1 rounded-lg" title="Seleccionar offset">
                                  <Video size={14} />
                                </button>
                              </div>
                            </td>
                            <td className="p-1" style={{ borderBottom: '1px solid rgba(185,165,135,0.08)' }}>
                              <div className="flex items-center gap-1">
                                <input type="text" value={formatOffsetTime(videoSync.videoPart2)} onChange={(e) => setVideoSyncTime('videoPart2', e.target.value)}
                                  className="v2-input" style={{width: 48, padding: '4px 6px', fontSize: '8px', fontFamily: "'JetBrains Mono', monospace"}} />
                                <button onClick={() => openOffsetPicker('part2')} className="v2-btn-ghost p-1 rounded-lg" title="Seleccionar offset">
                                  <Video size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TV broadcast */}
            <div style={{ borderRadius: 12, border: expandedVideoSections.has('tv') ? '1px solid rgba(232,172,101,0.15)' : '1px solid rgba(185,165,135,0.08)', overflow: 'hidden' }}>
              <button
                onClick={() => toggleVideoSection('tv')}
                className="w-full flex items-center justify-between px-3 py-3 transition-colors"
                style={{
                  background: expandedVideoSections.has('tv') ? 'rgba(232,172,101,0.06)' : 'rgba(22,20,16,0.4)',
                }}
              >
                <div className="flex items-center gap-2">
                  {expandedVideoSections.has('tv') ? <ChevronDown size={14} style={{color: '#e8ac65'}} /> : <ChevronRight size={14} style={{color: '#997b66'}} />}
                  <span className="text-xs font-semibold" style={{ color: expandedVideoSections.has('tv') ? '#e8ac65' : '#f1ede7' }}>Retransmisión TV</span>
                </div>
                {tvVideoType && <CheckCircle size={14} style={{ color: '#22c55e', flexShrink: 0 }} />}
              </button>
              {expandedVideoSections.has('tv') && (
                <div className="p-3 space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setTvVideoSrc(''); setTvVideoPath(''); setTvVideoType('local'); }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all"
                      style={{
                        background: tvVideoType === 'local' ? 'rgba(232,172,101,0.12)' : 'rgba(22,20,16,0.6)',
                        borderColor: tvVideoType === 'local' ? 'rgba(232,172,101,0.35)' : 'rgba(185,165,135,0.10)',
                        color: tvVideoType === 'local' ? '#e8ac65' : '#baa587',
                      }}
                    >Local</button>
                    <button
                      onClick={() => { setTvVideoPath(''); setTvVideoType('youtube'); }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all"
                      style={{
                        background: tvVideoType === 'youtube' ? 'rgba(232,172,101,0.12)' : 'rgba(22,20,16,0.6)',
                        borderColor: tvVideoType === 'youtube' ? 'rgba(232,172,101,0.35)' : 'rgba(185,165,135,0.10)',
                        color: tvVideoType === 'youtube' ? '#e8ac65' : '#baa587',
                      }}
                    >YouTube</button>
                  </div>
                  {tvVideoType === 'youtube' && (
                    <input
                      type="url"
                      value={tvVideoSrc}
                      onChange={(e) => setTvVideoSrc(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="v2-input w-full"
                    />
                  )}
                  {tvVideoType === 'local' && (
                    <button
                      onClick={() => tvVideoInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
                      style={{
                        background: 'rgba(22,20,16,0.6)',
                        border: '1px dashed rgba(185,165,135,0.15)',
                        color: '#baa587',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(232,172,101,0.25)'; e.currentTarget.style.color = '#f1ede7'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(185,165,135,0.15)'; e.currentTarget.style.color = '#baa587'; }}
                    >
                      <Upload size={14} />
                      {tvVideoSrc ? 'Cambiar video' : 'Subir video'}
                    </button>
                  )}
                  <input ref={tvVideoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleTvVideoUpload(e.target.files?.[0])} />
                  {tvVideoType === 'local' && tvVideoPath && (
                    <div className="space-y-1">
                      <div className="text-[11px] break-all" style={{ color: '#997b66' }}>{tvVideoPath}</div>
                      <button onClick={() => handleTvVideoUpload(null)} className="text-[11px]" style={{ color: '#d08c60' }}>Si falla la ruta, re-vincular vídeo</button>
                    </div>
                  )}
                  {tvVideoType === 'youtube' && tvVideoSrc && (
                    <div className="text-xs" style={{ color: '#e8ac65' }}>Enlace YouTube cargado</div>
                  )}
                  {tvVideoType && (
                    <button onClick={clearTvVideoData} className="text-[11px] flex items-center gap-1" style={{ color: '#d08c60' }}>
                      <X size={12} /> Desvincular vídeo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── CONTENT AREA ── */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex items-center justify-between gap-2 p-1 mb-6 glass-card-static" style={{ borderRadius: 16 }}>
            <div className="flex items-center gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={active ? 'v2-tab v2-tab-active' : 'v2-tab'}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            {activeTab === 'stats' && (parsed || sofascoreData) && (
              <button
                onClick={() => setPrintOpen(true)}
                className="no-print v2-btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5"
                style={{ borderRadius: 12 }}
              >
                <Printer size={14} /> Imprimir
              </button>
            )}
          </div>

          {/* Tab content */}
          {activeTab === 'stats' && (
            <div className="analysis-print-target space-y-6">
              {/* Print-only header */}
              <div className="hidden print:flex print:items-center print:gap-6 print:mb-6 print:pb-4 print:border-b" style={{ borderColor: '#ccc' }}>
                {photo && (
                  <img
                    src={photo}
                    alt={goalkeeperName}
                    className="print:block"
                    style={{ width: 96, height: 120, objectFit: 'cover', borderRadius: 12, border: '2px solid #ddd' }}
                  />
                )}
                <div className="print:flex print:flex-col print:gap-1">
                  {jornadaNumber && (
                    <span className="print:block text-sm font-bold" style={{ color: '#333' }}>
                      Jornada {jornadaNumber}
                    </span>
                  )}
                  <span className="print:block text-lg font-bold" style={{ color: '#111' }}>
                    {matchName || 'Partido'}
                  </span>
                  {opponent && (
                    <span className="print:block text-sm" style={{ color: '#555' }}>
                      Rival: {opponent}
                    </span>
                  )}
                  {date && (
                    <span className="print:block text-xs" style={{ color: '#777' }}>
                      {date}
                    </span>
                  )}
                </div>
              </div>

              {parsed ? (
                <>
                  <StatsCards gkStats={gkStats} opponentStats={oppStats} passFlow={passFlow} />

                  <div className="glass-card-static p-5">
                    <PassMatrix passFlow={passFlow} goalkeeperCode={parsed?.goalkeeper?.code || ''} />
                  </div>

                  <div className="glass-card-static p-5">
                    <PassProfileDashboard passes={gkStats.passes} />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center" style={{ color: '#997b66' }}>
                  <AlertCircle size={40} className="mb-3" style={{ opacity: 0.4 }} />
                  <p className="text-sm max-w-md">
                    Sube un XML para ver estadísticas avanzadas, o añade una URL de SofaScore y un vídeo para completar el análisis.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {parsed && (
                  <div className="glass-card-static p-5">
                    <EventTimelineChart events={gkEvents} opponentEvents={parsed?.opponent?.events || []} periods={periods} />
                  </div>
                )}
                {!rawXml && sofascoreData && (
                  <GoalkeeperMatchStatsCard stats={sofascoreData.goalkeeperMatchStats} />
                )}
                <div className="glass-card-static p-5">
                  <h3 className="text-xs font-semibold tracking-wider uppercase mb-3 flex items-center justify-center gap-1.5" style={{ color: '#997b66' }}>
                    <Activity size={14} /> Heatmap del Portero
                  </h3>
                  {sofascoreData?.goalkeeperHeatmap?.heatmap ? (
                    <GoalkeeperHeatmap
                      heatmap={sofascoreData.goalkeeperHeatmap.heatmap}
                      goalkeeperName={goalkeeperName || parsed?.goalkeeper?.name}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8" style={{ color: '#997b66' }}>
                      <Activity size={24} className="mb-2" style={{ opacity: 0.4 }} />
                      <p className="text-xs">Carga una URL de SofaScore para ver el heatmap</p>
                    </div>
                  )}
                </div>
                <div className="glass-card-static p-5 md:col-span-2">
                  <h3 className="text-xs font-semibold tracking-wider uppercase mb-3 flex items-center justify-center gap-1.5" style={{ color: '#997b66' }}>
                    <Target size={14} /> Mapa de Tiros del Rival
                  </h3>
                  {sofascoreData?.rivalShots?.length > 0 ? (
                    <ShotMap
                      shots={sofascoreData.rivalShots}
                      isHomeGoalkeeper={sofascoreData.goalkeeper?.teamId === sofascoreData.event?.homeTeam?.id}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8" style={{ color: '#997b66' }}>
                      <Target size={24} className="mb-2" style={{ opacity: 0.4 }} />
                      <p className="text-xs">Carga una URL de SofaScore para ver los tiros</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <MatchTimeline
              events={videoEvents}
              periods={periods}
              videoSrc={activeSrc}
              videoPath={activePath}
              videoType={activeType}
              videoSync={isTv ? null : videoSync}
              activeVideoSource={activeVideoSource}
              onActiveVideoSourceChange={setActiveVideoSource}
              clipRatings={clipRatings}
              onClipRatingChange={(eventId, rating) => {
                const updated = { ...clipRatings, [eventId]: rating };
                setClipRatings(updated);
                if (analysisId) {
                  queueAnalysisUpdate({ clipRatings: updated }).catch(() => {});
                }
              }}
              clipMarks={clipMarks}
              onClipMarkChange={handleClipMarkChange}
              clipCustomizations={clipCustomizations}
              onClipCustomizationChange={(eventId, customizations) => {
                const updated = { ...clipCustomizations, [eventId]: customizations };
                setClipCustomizations(updated);
                if (analysisId) {
                  queueAnalysisUpdate({ clipCustomizations: updated }).catch(() => {});
                }
              }}
              manualClips={manualClips}
              onManualClipCreate={handleManualClipCreate}
              onManualClipUpdate={handleManualClipUpdate}
              onManualClipDelete={handleManualClipDelete}
              manualClipCategories={manualClipCategories}
              onManualClipCategoriesChange={handleManualClipCategoriesChange}
              onNotify={addToast}
            />

          )}
        </div>
      </div>

    </div>

      {/* Print portal — renders stats content outside #root so @media print CSS applies */}
      {printOpen && createPortal(
        <AnalysisPrintOverlay
          onClose={() => setPrintOpen(false)}
          photo={photo}
          goalkeeperName={goalkeeperName}
          jornadaNumber={jornadaNumber}
          matchName={matchName}
          opponent={opponent}
          date={date}
          parsed={parsed}
          gkStats={gkStats}
          oppStats={oppStats}
          passFlow={passFlow}
          gkEvents={gkEvents}
          periods={periods}
          sofascoreData={sofascoreData}
        />,
        document.body
      )}

      {offsetPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-5xl glass-card-static p-5 shadow-2xl" style={{ borderRadius: 24 }}>
            <h2 className="text-lg font-semibold mb-3" style={{ color: '#f1ede7' }}>
              Seleccionar offset ({offsetPicker.part === 'part1' ? '1ª' : '2ª'} parte)
            </h2>
            <div className="rounded-xl overflow-hidden" style={{ background: '#000', height: '65vh', minHeight: '20rem' }}>
              <video
                ref={pickerVideoRef}
                src={videoSrc}
                controls
                className="w-full h-full"
                onLoadedMetadata={(e) => {
                  const target = offsetPicker.part === 'part1' ? videoSync.videoPart1 : videoSync.videoPart2;
                  e.currentTarget.currentTime = Math.max(0, Number(target) || 0);
                  setPickerTime(e.currentTarget.currentTime || 0);
                }}
                onTimeUpdate={(e) => setPickerTime(e.currentTarget.currentTime || 0)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 justify-center items-center">
              {[-10, -5, -1].map((delta) => (
                <button key={delta} onClick={() => seekOffsetPicker(delta)} className="v2-btn-ghost">{delta}s</button>
              ))}
              <span className="font-bold min-w-20 text-center" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.125rem', color: '#e8ac65' }}>{formatOffsetTime(pickerTime)}</span>
              {[1, 5, 10].map((delta) => (
                <button key={delta} onClick={() => seekOffsetPicker(delta)} className="v2-btn-ghost">+{delta}s</button>
              ))}
            </div>
            <div className="mt-4 flex gap-3 justify-center">
              <button onClick={confirmOffsetPicker} className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'rgba(232,172,101,0.12)',
                  color: '#e8ac65',
                  border: '1px solid rgba(232,172,101,0.15)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(232,172,101,0.18)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(232,172,101,0.12)'; }}
              >
                Establecer como offset
              </button>
              <button onClick={closeOffsetPicker} className="v2-btn-ghost">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
