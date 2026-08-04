import { useRef, useEffect, useState, useMemo } from 'react';
import { Play, Pause, Rewind, FastForward, Star, Smile, Frown, Trash2, Scissors, Plus, X, Pencil, Download, Loader2 } from 'lucide-react';
import { buildClipFileName } from '../utils/clipFileName';

const SHOT_LABELS = ['Shot', 'Head shot', 'Free kick shot', 'Shot after corner', 'Shot after throw in'];

const EVENT_COLORS = {
  Pass: '#5a9e8f',
  'Goal kick': '#6b9cc4',
  'Free kick': '#6b9cc4',
  Cross: '#c4a35a',
  'Free kick cross': '#c4a35a',
  Interception: '#5a9e7a',
  'Goalkeeper exit': '#7a85c4',
  'Shot against': '#c47a7a',
  'Conceded goal': '#e04a4a',
  Duel: '#7a85c4',
  default: '#c47a7a',
};

function getEventColor(labels) {
  const texts = labels.map(l => l.text);
  for (const [key, color] of Object.entries(EVENT_COLORS)) {
    if (texts.includes(key)) return color;
  }
  return EVENT_COLORS.default;
}

function getEventType(labels) {
  const texts = labels.map(l => l.text);
  if (texts.includes('Conceded goal')) return 'Goles';
  if (texts.includes('Cross') || texts.includes('Free kick cross') || texts.includes('Corner')) return 'Centros';
  if (texts.includes('Pass')) return 'Pases';
  if (texts.some(t => SHOT_LABELS.includes(t))) return 'Tiros';
  if (texts.includes('Goal kick') || texts.includes('Free kick')) return 'Reinicios';
  if (texts.includes('Goalkeeper exit') || texts.includes('Interception') || texts.includes('Aerial duel') || texts.includes('Recovery')) return 'Centros';
  return 'Otros';
}

const DEFAULT_CLIP_CATEGORIES = ['Pases', 'Tiros', 'Goles', 'Centros', 'Reinicios'];
export { DEFAULT_CLIP_CATEGORIES };
const MARK_FILTERS = [
  { id: 'Todos', label: 'Todos', Icon: null },
  { id: 'favorite', label: 'Favoritos', Icon: Star },
  { id: 'good', label: 'Bien', Icon: Smile },
  { id: 'bad', label: 'Mal', Icon: Frown },
];

const DEFAULT_START_OFFSET = 3;
const DEFAULT_END_OFFSET = 1;
const MAX_TRIM = 30;

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function StarRating({ value = 0, onChange, size = 14 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange?.(star); }}
          className="focus:outline-none"
        >
          <Star
            size={size}
            className={star <= value ? 'text-gk-accent fill-gk-accent' : 'text-gk-text-tertiary'}
          />
        </button>
      ))}
    </div>
  );
}

const CLIP_MARKS = [null, 'favorite', 'good', 'bad'];

function ClipMarkButton({ value, onChange }) {
  const nextMark = CLIP_MARKS[(CLIP_MARKS.indexOf(value) + 1) % CLIP_MARKS.length];
  const config = {
    favorite: { Icon: Star, color: '#f0b429', label: 'Favorito' },
    good: { Icon: Smile, color: '#3dd68c', label: 'Bien' },
    bad: { Icon: Frown, color: '#ff6b6b', label: 'Mal' },
  }[value] || { Icon: Star, color: '#997b66', label: 'Sin marcar' };
  const Icon = config.Icon;

  return (
    <button
      type="button"
      onClick={() => onChange?.(nextMark)}
      className="p-0.5 rounded transition-colors hover:bg-gk-elevated focus:outline-none focus:ring-1 focus:ring-gk-accent/60 shrink-0"
      style={{ color: config.color }}
      title={`${config.label}. Clic para cambiar`}
      aria-label={`Marcar clip como ${config.label}`}
    >
      <Icon size={13} fill={value === 'favorite' ? 'currentColor' : 'none'} />
    </button>
  );
}

export default function MatchTimeline({
  events = [], periods = [], videoSrc, videoPath, videoType,
  playbackMode = 'clip', onPlaybackModeChange, videoSync,
  clipRatings = {}, onClipRatingChange,
  clipCustomizations = {}, onClipCustomizationChange,
  clipMarks = {}, onClipMarkChange,
  manualClips = [], onManualClipCreate, onManualClipUpdate, onManualClipDelete,
  manualClipCategories = DEFAULT_CLIP_CATEGORIES, onManualClipCategoriesChange,
  activeVideoSource, onActiveVideoSourceChange,
  onNotify = () => {},
}) {
  const videoRef = useRef(null);
  const outputDirRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clipStart, setClipStart] = useState(null);
  const [clipEnd, setClipEnd] = useState(null);
  const [activeManualClipId, setActiveManualClipId] = useState(null);
  const [activeAutomaticEventId, setActiveAutomaticEventId] = useState(null);
  const [eventFilter, setEventFilter] = useState('Todos');
  const [markFilter, setMarkFilter] = useState('Todos');
  const [customizingId, setCustomizingId] = useState(null);
  const [editingCategories, setEditingCategories] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [editingManualClipId, setEditingManualClipId] = useState(null);
  const [downloadState, setDownloadState] = useState({});
  const [batchState, setBatchState] = useState(null);

  const clipCategories = useMemo(() => (
    Array.from(new Set([
      ...DEFAULT_CLIP_CATEGORIES,
      ...(Array.isArray(manualClipCategories) ? manualClipCategories : []),
    ]))
  ), [manualClipCategories]);
  const filterTypes = ['Todos', ...clipCategories];

  const totalDuration = periods.length >= 2
    ? periods[1].end
    : (events.length ? events[events.length - 1].end : 0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrentTime(video.currentTime);
    const onDur = () => setDuration(video.duration || totalDuration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onDur);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onDur);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [videoSrc, totalDuration]);

  useEffect(() => {
    if (playbackMode === 'full') {
      setClipEnd(null);
      setClipStart(null);
    }
  }, [playbackMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || playbackMode !== 'clip' || clipEnd == null) return;
    if (customizingId != null || editingManualClipId != null) return;
    if (video.currentTime >= clipEnd) {
      video.pause();
      setClipEnd(null);
    }
  }, [currentTime, clipEnd, playbackMode, customizingId, editingManualClipId]);

  const toVideoTime = (xmlTime) => {
    if (!videoSync) return xmlTime;
    const xmlPart2 = Number(videoSync.xmlPart2 || 2700);
    const xmlAnchor = xmlTime >= xmlPart2 ? Number(videoSync.xmlPart2 || 2700) : Number(videoSync.xmlPart1 || 0);
    const videoAnchor = xmlTime >= xmlPart2 ? Number(videoSync.videoPart2 || 2700) : Number(videoSync.videoPart1 || 0);
    return Math.max(0, xmlTime - (xmlAnchor - videoAnchor));
  };

  const fromVideoTime = (videoTime) => {
    if (!videoSync) return videoTime;
    const xmlPart2 = Number(videoSync.xmlPart2 || 2700);
    const videoPart1 = Number(videoSync.videoPart1 || 0);
    const videoPart2 = Number(videoSync.videoPart2 || 2700);
    const xmlAnchor = videoTime >= videoPart2 ? xmlPart2 : Number(videoSync.xmlPart1 || 0);
    const videoAnchor = videoTime >= videoPart2 ? videoPart2 : videoPart1;
    return Math.max(0, videoTime + (xmlAnchor - videoAnchor));
  };

  const getCustomTimes = (ev, clipCustomizations) => {
    const cust = clipCustomizations?.[ev.id];

    // Legacy migration (v1 format) — no _v field or _v === 1
    if (cust && cust._v !== 2) {
      if (cust.duration != null) {
        const startOffset = Math.round(cust.duration * 0.7);
        const endOffset = cust.duration - startOffset;
        return {
          startOffset: Math.min(MAX_TRIM, Math.max(0, startOffset)),
          endOffset: Math.min(MAX_TRIM, Math.max(0, endOffset)),
          _v: 1,
        };
      }
      return {
        startOffset: Math.min(MAX_TRIM, Math.max(0, cust.startOffset ?? DEFAULT_START_OFFSET)),
        endOffset: Math.min(MAX_TRIM, Math.max(0, cust.endOffset ?? DEFAULT_END_OFFSET)),
        _v: 1,
      };
    }

    // New format (v2)
    if (cust?._v === 2) {
      return {
        startOffset: Math.min(MAX_TRIM, Math.max(0, cust.startOffset ?? DEFAULT_START_OFFSET)),
        endOffset: Math.min(MAX_TRIM, Math.max(0, cust.endOffset ?? DEFAULT_END_OFFSET)),
        _v: 2,
      };
    }

    // Default
    return { startOffset: DEFAULT_START_OFFSET, endOffset: DEFAULT_END_OFFSET };
  };

  const getVideoClipRange = (item) => {
    if (item.type === 'manual') {
      const clip = item.clip;
      const start = Math.max(0, Number(clip.start) || 0);
      const end = Math.max(start + 0.1, Number(clip.end) || start + 0.1);
      return { start, end };
    }
    const ev = item.event;
    const times = getCustomTimes(ev, clipCustomizations);
    const startXml = Math.max(0, (Number(ev.start) || 0) - times.startOffset);
    const endXml = (Number(ev.end) || (Number(ev.start) || 0) + 10) + times.endOffset;
    const start = toVideoTime(startXml);
    const end = Math.max(start + 0.1, toVideoTime(endXml));
    return { start, end };
  };

  const triggerDownload = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const recordClipInBrowser = (start, end) => {
    return new Promise((resolve, reject) => {
      if (!videoSrc) return reject(new Error('no-video'));
      if (typeof document === 'undefined') return reject(new Error('not-supported'));
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.src = videoSrc;

      let recorder;
      let chunks = [];
      let settled = false;

      const fail = (reason) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(reason);
      };

      const cleanup = () => {
        try {
          if (recorder && recorder.state !== 'inactive') recorder.stop();
        } catch { /* ignore */ }
        try { video.pause(); } catch { /* ignore */ }
        try { video.removeAttribute('src'); video.load(); } catch { /* ignore */ }
      };

      const onError = () => fail(new Error('no-video'));
      video.addEventListener('error', onError);

      const startRecording = () => {
        const duration = Number(video.duration) || Infinity;
        const targetEnd = Math.min(end, duration - 0.05);
        let stream;
        try {
          stream = video.captureStream ? video.captureStream() : video.mozCaptureStream?.();
        } catch {
          return fail(new Error('not-supported'));
        }
        if (!stream || stream.getVideoTracks().length === 0) {
          return fail(new Error('not-supported'));
        }
        const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
          .find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type));
        if (!mimeType) return fail(new Error('not-supported'));

        try {
          recorder = new MediaRecorder(stream, { mimeType });
        } catch {
          return fail(new Error('not-supported'));
        }

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onerror = () => fail(new Error('not-supported'));
        recorder.onstop = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(new Blob(chunks, { type: mimeType }));
        };

        recorder.start(500);
        video.play().catch(() => {});

        const onTick = () => {
          if (video.currentTime >= targetEnd) stopRecording();
        };
        video.addEventListener('timeupdate', onTick);

        const stopRecording = () => {
          video.removeEventListener('timeupdate', onTick);
          try {
            if (recorder.state !== 'inactive') recorder.stop();
          } catch { /* ignore */ }
          try { video.pause(); } catch { /* ignore */ }
        };

        const maxWait = Math.max(1000, Math.ceil((targetEnd - start) * 1000) + 2000);
        const timeout = setTimeout(stopRecording, maxWait);
        recorder.addEventListener('stop', () => clearTimeout(timeout), { once: true });
      };

      const onLoaded = () => {
        video.removeEventListener('error', onError);
        video.currentTime = Math.max(0, start);
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          startRecording();
        };
        video.addEventListener('seeked', onSeeked);
      };
      video.addEventListener('loadedmetadata', onLoaded, { once: true });
    });
  };

  const downloadClip = async (item, { silent = false } = {}) => {
    const key = item.id;
    if (downloadState[key] === 'exporting') return { ok: false, reason: 'busy' };
    const range = getVideoClipRange(item);
    if (!videoSrc) {
      if (!silent) onNotify('Carga un vídeo primero para descargar clips', 'warning');
      return { ok: false, reason: 'no-video' };
    }
    const fileBase = buildClipFileName(item.displayId, item.category).replace(/\.mp4$/i, '');

    setDownloadState((prev) => ({ ...prev, [key]: 'exporting' }));
    try {
      if (window.electronAPI?.exportClips && window.electronAPI?.selectClipFolder) {
        let outputDir = outputDirRef.current;
        if (!outputDir) {
          outputDir = await window.electronAPI.selectClipFolder();
          if (!outputDir) {
            setDownloadState((prev) => ({ ...prev, [key]: 'idle' }));
            return { ok: false, reason: 'cancelled' };
          }
          outputDirRef.current = outputDir;
        }
        const source = (videoType === 'local' && videoPath) ? videoPath : videoSrc;
        const res = await window.electronAPI.exportClips({
          videoPath: source,
          clips: [{ start: range.start, end: range.end, name: fileBase }],
          outputDir,
        });
        if (!res?.success) throw new Error(res?.error || 'Error al exportar');
        if (!silent) onNotify(`Clip ${item.displayId} exportado en ${res.results?.[0]?.path || outputDir}`, 'success');
        setDownloadState((prev) => ({ ...prev, [key]: 'done' }));
        return { ok: true };
      }

      const blob = await recordClipInBrowser(range.start, range.end);
      triggerDownload(blob, buildClipFileName(item.displayId, item.category, 'webm'));
      if (!silent) onNotify(`Clip ${item.displayId} descargado`, 'success');
      setDownloadState((prev) => ({ ...prev, [key]: 'done' }));
      return { ok: true };
    } catch (err) {
      const reason = err?.message;
      setDownloadState((prev) => ({ ...prev, [key]: 'error' }));
      if (!silent) {
        const message = reason === 'not-supported'
          ? 'Este vídeo no se puede descargar en el navegador; usa la app de escritorio'
          : reason === 'no-video'
            ? 'No se pudo cargar el vídeo para recortarlo'
            : 'No se pudo descargar el clip';
        onNotify(message, 'error');
      }
      return { ok: false, reason };
    }
  };

  const handleDownloadAll = async () => {
    const items = timelineItems.filter((item) => item.type !== 'heading');
    if (!items.length) {
      onNotify('No hay clips visibles para descargar', 'warning');
      return;
    }
    if (!videoSrc) {
      onNotify('Carga un vídeo primero para descargar clips', 'warning');
      return;
    }
    setBatchState({ total: items.length, done: 0, running: true });
    let done = 0;
    for (const item of items) {
      const res = await downloadClip(item, { silent: true });
      if (res.reason === 'cancelled') {
        setBatchState({ total: items.length, done, running: false });
        onNotify('Descarga cancelada', 'info');
        return;
      }
      if (res.ok) done += 1;
      setBatchState({ total: items.length, done, running: true });
    }
    setBatchState({ total: items.length, done, running: false });
    onNotify(
      done === items.length ? `Se descargaron ${done}/${items.length} clips` : `Descarga incompleta: ${done}/${items.length} clips`,
      done === items.length ? 'success' : 'warning'
    );
  };

  const seekTo = (ev, customStart, customEnd) => {
    if (!videoRef.current) return;
    const times = getCustomTimes(ev, clipCustomizations);
    const cs = customStart ?? times.startOffset;
    const ce = customEnd ?? times.endOffset;
    const csTime = Math.max(0, ev.start - cs);
    const clipEndTime = (ev.end || (ev.start + 10)) + ce;
    const vStart = toVideoTime(csTime);
    const vEnd = toVideoTime(clipEndTime);
    videoRef.current.currentTime = vStart;
    setClipStart(vStart);
    setClipEnd(vEnd);
    setActiveAutomaticEventId(ev.id);
    setActiveManualClipId(null);
    videoRef.current.play().catch(() => {});
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play().catch(() => {});
  };

  const maxTime = Math.max(duration, totalDuration, 1);

  const createManualClip = (category) => {
    const start = Math.max(0, currentTime - 5);
    const end = Math.min(maxTime, currentTime + 5);
    onManualClipCreate?.({ category, start, end });
  };

  const addCategory = () => {
    const category = newCategory.trim();
    if (!category || clipCategories.some((item) => item.toLowerCase() === category.toLowerCase())) return;
    onManualClipCategoriesChange?.([...clipCategories, category]);
    setNewCategory('');
  };

  const removeCategory = (category) => {
    if (DEFAULT_CLIP_CATEGORIES.includes(category)) return;
    if (manualClips.some((clip) => clip.category === category)) return;
    onManualClipCategoriesChange?.(clipCategories.filter((item) => item !== category));
    if (eventFilter === category) setEventFilter('Todos');
  };

  const openManualClipEditor = (clip) => {
    setCustomizingId(null);
    setEditingManualClipId(clip.id);
    const start = Math.max(0, Number(clip.start) || 0);
    const end = Math.max(start + 0.1, Number(clip.end) || start + 0.1);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = start;
      setCurrentTime(start);
      setPlaying(false);
      setClipStart(start);
      setClipEnd(end);
      setActiveManualClipId(clip.id);
      setActiveAutomaticEventId(null);
    }
  };

  const playManualClip = (clip) => {
    if (!videoRef.current) return;
    const start = Math.max(0, Number(clip.start) || 0);
    const end = Math.max(start + 0.1, Math.min(maxTime, Number(clip.end) || start + 10));
    videoRef.current.currentTime = start;
    setClipStart(start);
    setClipEnd(end);
    setActiveManualClipId(clip.id);
    setActiveAutomaticEventId(null);
    videoRef.current.play().catch(() => {});
  };

  const activateAutomaticClipForEditing = (ev) => {
    if (!videoRef.current) return;
    const times = getCustomTimes(ev, clipCustomizations);
    const vStart = toVideoTime(Math.max(0, ev.start - times.startOffset));
    const vEnd = toVideoTime((ev.end || (ev.start + 10)) + times.endOffset);
    videoRef.current.pause();
    videoRef.current.currentTime = vStart;
    setCurrentTime(vStart);
    setPlaying(false);
    setClipStart(vStart);
    setClipEnd(vEnd);
    setActiveAutomaticEventId(ev.id);
    setActiveManualClipId(null);
  };

  const updateActiveClipBounds = (nextStart, nextEnd, previewTime) => {
    const start = Math.max(0, Math.min(Math.max(0, maxTime - 0.1), nextStart));
    const end = Math.min(maxTime, Math.max(start + 0.1, nextEnd));
    setClipStart(start);
    setClipEnd(end);
    if (videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
      const referenceTime = Math.max(start, Math.min(end, previewTime ?? start));
      videoRef.current.currentTime = referenceTime;
      setCurrentTime(referenceTime);
    }

    if (activeManualClipId) {
      onManualClipUpdate?.(activeManualClipId, { start, end });
      return;
    }

    const event = events.find((item) => item.id === activeAutomaticEventId);
    if (!event) return;
    const xmlStart = fromVideoTime(start);
    const xmlEnd = fromVideoTime(end);
    const eventEnd = event.end || (event.start + 10);
    onClipCustomizationChange?.(event.id, {
      _v: 2,
      startOffset: Math.max(0, event.start - xmlStart),
      endOffset: Math.max(0, xmlEnd - eventEnd),
    });
  };

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'Todos') return events;
    return events.filter(ev => {
      const type = getEventType(ev.labels);
      return type === eventFilter;
    });
  }, [events, eventFilter]);

  const timelineItems = useMemo(() => {
    const categories = eventFilter === 'Todos' ? clipCategories : [eventFilter];
    return categories.flatMap((category) => {
      const automatic = filteredEvents.filter((event) => (
        getEventType(event.labels) === category &&
        (markFilter === 'Todos' || clipMarks[event.id] === markFilter)
      ));
      const manual = manualClips.filter((clip) => (
        clip.category === category &&
        (markFilter === 'Todos' || clipMarks[clip.id] === markFilter)
      ));
      if (automatic.length === 0 && manual.length === 0) return [];
      return [
        { id: `heading-${category}`, type: 'heading', category },
        ...automatic.map((event) => ({
          id: `automatic-${event.id}`,
          displayId: `A-${String(events.indexOf(event) + 1).padStart(3, '0')}`,
          type: 'automatic',
          event,
        })),
        ...manual.map((clip, index) => ({
          id: `manual-${clip.id}`,
          displayId: /^M-\d+$/.test(String(clip.id)) ? clip.id : `M-${String(index + 1).padStart(3, '0')}`,
          type: 'manual',
          clip,
        })),
      ];
    });
  }, [clipCategories, clipMarks, eventFilter, filteredEvents, manualClips, markFilter]);

  const currentClipInfo = useMemo(() => {
    if (playbackMode !== 'clip' || clipEnd == null) return null;
    return { start: currentTime, end: clipEnd };
  }, [playbackMode, clipEnd, currentTime]);

  const activeEventId = useMemo(() => {
    if (clipStart == null || clipEnd == null) return null;
    const tolerance = 0.5;
    for (const ev of events) {
      const times = getCustomTimes(ev, clipCustomizations);
      const csTime = Math.max(0, ev.start - times.startOffset);
      const clipEndTime = (ev.end || (ev.start + 10)) + times.endOffset;
      const vStart = toVideoTime(csTime);
      const vEnd = toVideoTime(clipEndTime);
      if (Math.abs(vStart - clipStart) < tolerance && Math.abs(vEnd - clipEnd) < tolerance) {
        return ev.id;
      }
    }
    return null;
  }, [clipStart, clipEnd, events, clipCustomizations]);

  const isEditingActiveClip = customizingId != null || editingManualClipId != null;

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-3">
      <div className="order-1 lg:order-2 min-w-0 space-y-4">
        {/* Video player */}
        {videoSrc && (
          <div className="relative rounded-lg overflow-hidden bg-black border border-gk-border">
            {videoType === 'youtube' ? (
              <iframe
                src={videoSrc}
                className="w-full aspect-video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video ref={videoRef} src={videoSrc} className="w-full aspect-video" controls />
            )}
          </div>
        )}

        {/* Controls bar */}
        <div className="flex items-center gap-3 rounded-xl px-4 py-2" style={{background: 'rgba(22,20,16,0.6)', border: '1px solid rgba(185,165,135,0.08)'}}>
        {/* Video source toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onActiveVideoSourceChange?.('tactical')} className="px-3 py-1.5 text-xs font-semibold border-2 rounded-lg transition-all" style={{background: activeVideoSource === 'tactical' ? 'rgba(232,172,101,0.12)' : 'rgba(22,20,16,0.6)', borderColor: activeVideoSource === 'tactical' ? 'rgba(232,172,101,0.35)' : 'rgba(185,165,135,0.10)', color: activeVideoSource === 'tactical' ? '#e8ac65' : '#baa587'}}>Cámara Táctica</button>
          <button onClick={() => onActiveVideoSourceChange?.('tv')} className="px-3 py-1.5 text-xs font-semibold border-2 rounded-lg transition-all" style={{background: activeVideoSource === 'tv' ? 'rgba(232,172,101,0.12)' : 'rgba(22,20,16,0.6)', borderColor: activeVideoSource === 'tv' ? 'rgba(232,172,101,0.35)' : 'rgba(185,165,135,0.10)', color: activeVideoSource === 'tv' ? '#e8ac65' : '#baa587'}}>Retransmisión TV</button>
        </div>

        <div className="h-4 w-px bg-gk-elevated mx-1 shrink-0" />

        {/* Playback controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 3); }} className="p-1.5 rounded text-gk-text-tertiary hover:text-white hover:bg-gk-elevated transition-colors" title="Retroceder 3s">
            <Rewind size={18} />
          </button>
          <button onClick={togglePlay} className="p-1.5 rounded text-gk-text-primary hover:text-gk-accent hover:bg-gk-elevated transition-colors">
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.min(maxTime, videoRef.current.currentTime + 3); }} className="p-1.5 rounded text-gk-text-tertiary hover:text-white hover:bg-gk-elevated transition-colors" title="Avanzar 3s">
            <FastForward size={18} />
          </button>
        </div>

        {/* Clip navigation slider */}
        <div className="flex-1 min-w-0">
          {clipStart != null && clipEnd != null ? (
            isEditingActiveClip ? (
              (() => {
              const contextStart = Math.max(0, clipStart - 5);
              const contextEnd = Math.min(maxTime, clipEnd + 5);
              const contextLength = Math.max(0.1, contextEnd - contextStart);
              const fillStart = ((clipStart - contextStart) / contextLength) * 100;
              const fillEnd = ((clipEnd - contextStart) / contextLength) * 100;
              return (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-gk-text-tertiary whitespace-nowrap">Inicio {formatTime(clipStart)}</span>
                    <span className="font-semibold whitespace-nowrap" style={{ color: '#e8ac65' }}>
                      Ahora {formatTime(currentTime)} · {formatTime(clipEnd - clipStart)}
                    </span>
                    <span className="text-gk-text-tertiary whitespace-nowrap">Fin {formatTime(clipEnd)}</span>
                  </div>
                  <div className="trim-container h-7">
                    <div className="trim-track-bg" />
                    <div className="trim-track-fill" style={{ left: `${fillStart}%`, right: `${100 - fillEnd}%` }} />
                    <input
                      type="range"
                      className="trim-input"
                      min={contextStart}
                      max={contextEnd}
                      step={0.1}
                      value={clipStart}
                      onChange={(event) => updateActiveClipBounds(Number(event.target.value), clipEnd, Number(event.target.value))}
                      aria-label="Inicio del clip activo"
                    />
                    <input
                      type="range"
                      className="trim-input"
                      min={contextStart}
                      max={contextEnd}
                      step={0.1}
                      value={clipEnd}
                      onChange={(event) => updateActiveClipBounds(clipStart, Number(event.target.value), Number(event.target.value))}
                      aria-label="Fin del clip activo"
                    />
                  </div>
                </div>
              );
              })()
            ) : (
              <input
                type="range"
                min={clipStart}
                max={clipEnd}
                step={0.1}
                value={Math.min(clipEnd, Math.max(clipStart, currentTime))}
                onChange={(event) => {
                  const nextTime = Number(event.target.value);
                  if (videoRef.current) videoRef.current.currentTime = nextTime;
                  setCurrentTime(nextTime);
                }}
                className="w-full h-2 bg-gk-elevated rounded-full appearance-none cursor-pointer accent-gk-accent"
                aria-label="Navegar por el clip activo"
              />
            )
          ) : (
            <input
              type="range"
              min={0}
              max={maxTime}
              step={0.1}
              value={Math.min(maxTime, currentTime)}
              onChange={(e) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Number(e.target.value);
                }
              }}
              className="w-full h-2 bg-gk-elevated rounded-full appearance-none cursor-pointer accent-gk-accent"
            />
          )}
        </div>
      </div>

        {/* Manual clip creator stays below the playback controls. */}
        <div className="rounded-xl p-3" style={{ border: '1px solid rgba(232,172,101,0.15)', background: 'rgba(22,20,16,0.4)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Scissors size={14} style={{ color: '#e8ac65' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#e8ac65' }}>
              Cortes manuales
            </span>
            <span className="text-[10px] ml-auto" style={{ color: '#997b66' }}>±5 s desde el tiempo actual</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {clipCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => createManualClip(category)}
                disabled={!videoSrc}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  color: videoSrc ? '#f1ede7' : '#6b6257',
                  background: videoSrc ? 'rgba(232,172,101,0.10)' : 'rgba(22,20,16,0.5)',
                  border: '1px solid rgba(232,172,101,0.15)',
                  cursor: videoSrc ? 'pointer' : 'not-allowed',
                  opacity: videoSrc ? 1 : 0.6,
                }}
                title={videoSrc ? `Crear corte de ${category} alrededor de ${formatTime(currentTime)}` : 'Carga un vídeo para crear cortes'}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingCategories((value) => !value)}
              className="text-[10px] transition-colors"
              style={{ color: '#997b66' }}
            >
              {editingCategories ? 'Cerrar etiquetas' : 'Gestionar etiquetas'}
            </button>
          </div>
          {editingCategories && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-1.5">
                <input
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') addCategory(); }}
                  placeholder="Nueva etiqueta"
                  className="v2-input min-w-0 flex-1"
                  maxLength={30}
                />
                <button type="button" onClick={addCategory} className="p-2 rounded-lg" style={{ color: '#e8ac65', background: 'rgba(232,172,101,0.10)' }} title="Añadir etiqueta">
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {clipCategories.filter((category) => !DEFAULT_CLIP_CATEGORIES.includes(category)).map((category) => (
                  <span key={category} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px]" style={{ color: '#f1ede7', background: 'rgba(185,165,135,0.10)' }}>
                    {category}
                    <button type="button" onClick={() => removeCategory(category)} disabled={manualClips.some((clip) => clip.category === category)} className="disabled:opacity-30" title={manualClips.some((clip) => clip.category === category) ? 'Tiene cortes asociados' : 'Eliminar etiqueta'}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      <div className="order-2 lg:order-1 min-w-0 flex flex-col gap-4">
        {/* Download toolbar */}
        {(timelineItems.some((item) => item.type !== 'heading')) && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#997b66' }}>
              Clips visibles
            </span>
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={!videoSrc || batchState?.running}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                color: videoSrc && !batchState?.running ? '#e8ac65' : '#6b6257',
                background: videoSrc && !batchState?.running ? 'rgba(232,172,101,0.10)' : 'rgba(22,20,16,0.5)',
                border: '1px solid rgba(232,172,101,0.2)',
                cursor: videoSrc && !batchState?.running ? 'pointer' : 'not-allowed',
              }}
              title={videoSrc ? 'Descargar todos los clips visibles según los filtros' : 'Carga un vídeo para descargar clips'}
            >
              {batchState?.running ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {batchState?.running
                ? `Descargando ${batchState.done}/${batchState.total}…`
                : `Descargar todos (${timelineItems.filter((item) => item.type !== 'heading').length})`}
            </button>
          </div>
        )}

        {/* Mark filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {MARK_FILTERS.map(({ id, label, Icon }) => {
            const active = markFilter === id;
            const color = id === 'favorite' ? '#f0b429' : id === 'good' ? '#3dd68c' : id === 'bad' ? '#ff6b6b' : '#e8ac65';
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMarkFilter(id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
                style={{
                  border: active ? `1px solid ${color}66` : '1px solid rgba(185,165,135,0.08)',
                  background: active ? `${color}18` : 'rgba(22,20,16,0.6)',
                  color: active ? color : '#997b66',
                }}
                title={`Filtrar: ${label}`}
              >
                {Icon && <Icon size={12} fill={id === 'favorite' && active ? 'currentColor' : 'none'} />}
                {label}
              </button>
            );
          })}
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
        {filterTypes.map(type => (
          <button
            key={type}
            onClick={() => setEventFilter(type)}
            style={{
              padding: '4px 12px',
              fontSize: '0.75rem',
              borderRadius: 10,
              border: eventFilter === type ? '1px solid rgba(232,172,101,0.3)' : '1px solid rgba(185,165,135,0.08)',
              background: eventFilter === type ? 'rgba(232,172,101,0.10)' : 'rgba(22,20,16,0.6)',
              color: eventFilter === type ? '#e8ac65' : '#997b66',
              fontWeight: eventFilter === type ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {type}
          </button>
        ))}
        </div>

      {(customizingId || editingManualClipId || (clipStart != null && clipEnd != null)) && <style>{`
        .trim-container {
          position: relative;
          height: 32px;
          display: flex;
          align-items: center;
        }
        .trim-track-bg {
          position: absolute;
          left: 0; right: 0;
          height: 8px;
          background: #334155;
          border-radius: 4px;
        }
        .trim-track-fill {
          position: absolute;
          height: 8px;
          background: #d4a574;
          border-radius: 4px;
        }
        .trim-input {
          position: absolute;
          width: 100%;
          -webkit-appearance: none;
          background: transparent;
          pointer-events: none;
          margin: 0;
          height: 32px;
        }
        .trim-input::-webkit-slider-thumb {
          pointer-events: auto;
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          background: #f1f5f9;
          border: 2px solid #d4a574;
          border-radius: 50%;
          cursor: ew-resize;
          margin-top: -5px;
        }
        .trim-input::-moz-range-thumb {
          pointer-events: auto;
          width: 18px;
          height: 18px;
          background: #f1f5f9;
          border: 2px solid #d4a574;
          border-radius: 50%;
          cursor: ew-resize;
        }
      `}</style>}

      {/* Event list */}
        <div className="max-h-96 lg:max-h-[calc(100vh-12rem)] overflow-y-auto rounded-xl" style={{border: '1px solid rgba(185,165,135,0.08)', background: 'rgba(22,20,16,0.4)'}}>
        {timelineItems.length === 0 && (
          <div className="p-4 text-center text-sm text-gk-text-tertiary">No hay eventos del portero</div>
        )}
        {timelineItems.map((item) => {
          if (item.type === 'heading') {
            return (
              <div key={item.id} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#e8ac65', background: 'rgba(232,172,101,0.06)', borderBottom: '1px solid rgba(185,165,135,0.06)' }}>
                {item.category}
              </div>
            );
          }

          if (item.type === 'manual') {
            const clip = item.clip;
            const isEditing = editingManualClipId === clip.id;
            return (
              <div key={item.id}>
                <div className="flex items-center gap-1 px-2 py-2 border-b last:border-0" style={{ borderColor: 'rgba(185,165,135,0.04)', background: 'rgba(232,172,101,0.025)' }}>
                  <button type="button" onClick={() => playManualClip(clip)} className="group flex items-center gap-1.5 flex-1 min-w-0 rounded-lg px-1.5 py-1.5 -mx-1.5 text-left transition-colors hover:bg-gk-elevated/60 focus:outline-none focus:ring-1 focus:ring-gk-accent/60" title="Reproducir corte manual">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md shrink-0" style={{ color: '#e8ac65', background: 'rgba(232,172,101,0.12)' }}>
                      <Scissors size={12} />
                    </span>
                    <span className="text-xs font-semibold font-mono text-gk-text-primary whitespace-nowrap group-hover:text-white">{item.displayId}</span>
                    <span className="text-[10px] font-mono tabular-nums shrink-0 rounded-md px-1 py-1 max-w-[64px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: '#e8ac65', background: 'rgba(232,172,101,0.08)' }}>
                      {formatTime(clip.start)}–{formatTime(clip.end)}
                    </span>
                  </button>
                  <ClipMarkButton value={clipMarks[clip.id] || null} onChange={(mark) => onClipMarkChange?.(clip.id, mark)} />
                  <button
                    type="button"
                    onClick={() => downloadClip(item)}
                    disabled={downloadState[item.id] === 'exporting'}
                    className="p-0.5 rounded transition-colors shrink-0 disabled:opacity-40"
                    style={{ color: '#997b66' }}
                    title="Descargar corte"
                  >
                    {downloadState[item.id] === 'exporting' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  </button>
                  <button type="button" onClick={() => {
                    if (isEditing) {
                      setEditingManualClipId(null);
                    } else {
                      openManualClipEditor(clip);
                    }
                  }} className="p-0.5 rounded transition-colors shrink-0" style={{ color: isEditing ? '#e8ac65' : '#997b66' }} title="Editar duración">
                    <Pencil size={12} />
                  </button>
                  <button type="button" onClick={() => onManualClipDelete?.(clip.id)} className="p-0.5 rounded transition-colors shrink-0" style={{ color: '#997b66' }} title="Eliminar corte">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          }

          const ev = item.event;
          const minute = Math.round((ev.start / maxTime) * 90);
          const color = getEventColor(ev.labels);
          const rating = clipRatings[ev.id] || 0;
          const cust = getCustomTimes(ev, clipCustomizations);
          const isCustomizing = customizingId === ev.id;

          return (
            <div
              key={ev.id}
              className="border-b last:border-0 transition-all duration-300"
              style={{
                borderColor: 'rgba(185,165,135,0.04)',
                background: activeEventId === ev.id ? 'rgba(232,172,101,0.08)' : 'transparent',
                boxShadow: activeEventId === ev.id ? 'inset 3px 0 0 rgba(232,172,101,0.5)' : 'none',
              }}
            >
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-gk-elevated/30 transition-colors">
                <button
                  onClick={() => seekTo(ev)}
                  className="group flex items-center gap-2 flex-1 text-left min-w-0 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-gk-elevated/60 focus:outline-none focus:ring-1 focus:ring-gk-accent/60"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-mono text-gk-text-tertiary w-7 shrink-0">{minute}'</span>
                  <span className="text-xs font-semibold font-mono text-gk-text-primary whitespace-nowrap group-hover:text-white">{item.displayId}</span>
                  <span className="text-[10px] font-mono tabular-nums shrink-0 rounded-md px-1 py-1 max-w-[54px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: '#baa587', background: 'rgba(185,165,135,0.08)' }}>
                    {formatTime(ev.start)}
                  </span>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <StarRating
                    value={rating}
                    onChange={(val) => onClipRatingChange?.(ev.id, val === rating ? 0 : val)}
                    size={12}
                  />
                </div>

                <ClipMarkButton value={clipMarks[ev.id] || null} onChange={(mark) => onClipMarkChange?.(ev.id, mark)} />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadClip(item);
                  }}
                  disabled={downloadState[item.id] === 'exporting'}
                  className="p-0.5 rounded transition-colors shrink-0 disabled:opacity-40"
                  style={{ color: '#997b66' }}
                  title="Descargar clip"
                >
                  {downloadState[item.id] === 'exporting' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isCustomizing) {
                      setCustomizingId(null);
                      return;
                    }
                    setEditingManualClipId(null);
                    activateAutomaticClipForEditing(ev);
                    setCustomizingId(ev.id);
                  }}
                  className={`p-0.5 rounded text-xs transition-colors shrink-0 ${
                    isCustomizing ? 'bg-gk-accent/15 text-gk-accent' : 'text-gk-text-tertiary hover:text-gk-text-secondary hover:bg-gk-elevated'
                  }`}
                  title="Ajustar clip"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                </button>
              </div>

              {isCustomizing && (
                <div className="mx-2 mb-2 rounded-xl bg-gk-page border border-gk-accent/40 overflow-hidden shadow-lg shadow-gk-accent/5">
                  <div className="px-4 pt-3 pb-2 bg-gk-accent/10 border-b border-gk-accent/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-gk-accent uppercase tracking-wider">Editar clip</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-white tabular-nums leading-none">{cust.startOffset + cust.endOffset}</span>
                      <span className="text-xs text-gk-text-tertiary">segundos</span>
                    </div>
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {/* Visual bar */}
                    <div>
                      <div className="flex justify-between text-[10px] text-gk-text-tertiary mb-1 font-mono">
                        <span>Inicio clip</span>
                        <span className="text-gk-accent font-semibold">Evento</span>
                        <span>Fin clip</span>
                      </div>
                      <div className="trim-container">
                        <div className="trim-track-bg" />
                        <div className="trim-track-fill" style={{ left: `${(cust.startOffset / MAX_TRIM) * 100}%`, right: `${((MAX_TRIM - cust.endOffset) / MAX_TRIM) * 100}%` }} />
                        <input
                          type="range"
                          className="trim-input"
                          min={0}
                          max={MAX_TRIM}
                          step={0.5}
                          value={cust.startOffset}
                          onChange={(e) => {
                            const val = Math.min(MAX_TRIM, Math.max(0, Number(e.target.value)));
                            onClipCustomizationChange?.(ev.id, { _v: 2, startOffset: val, endOffset: cust.endOffset });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <input
                          type="range"
                          className="trim-input"
                          min={0}
                          max={MAX_TRIM}
                          step={0.5}
                          value={cust.endOffset}
                          onChange={(e) => {
                            const val = Math.min(MAX_TRIM, Math.max(0, Number(e.target.value)));
                            onClipCustomizationChange?.(ev.id, { _v: 2, startOffset: cust.startOffset, endOffset: val });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] font-mono text-gk-text-tertiary">-{cust.startOffset}s</span>
                        <span className="text-[10px] font-mono text-gk-text-tertiary">+{cust.endOffset}s</span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onClipCustomizationChange?.(ev.id, null); }}
                        className="shrink-0 px-3 py-2 rounded-lg bg-gk-card hover:bg-gk-elevated text-gk-text-secondary text-xs transition-colors border border-gk-border"
                        title="Restaurar valores por defecto"
                      >
                        Restaurar
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); seekTo(ev, cust.startOffset, cust.endOffset); }}
                        className="flex-1 py-2.5 rounded-lg bg-gk-accent hover:bg-gk-accent text-sm text-white font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gk-accent/20"
                      >
                        <Play size={14} fill="currentColor" />
                        Probar clip
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
