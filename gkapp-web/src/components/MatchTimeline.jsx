import { useRef, useEffect, useState, useMemo } from 'react';
import { Play, Pause, Rewind, FastForward, Star } from 'lucide-react';

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

function getEventLabel(labels) {
  const texts = labels.map(l => l.text);
  if (texts.includes('Conceded goal')) return 'Gol encajado';
  if (texts.includes('Cross') || texts.includes('Free kick cross')) return 'Centro';
  if (texts.includes('Corner')) return 'Córner';
  if (texts.includes('Pass')) return texts.includes('Long pass') ? 'Pase largo' : 'Pase';
  if (texts.includes('Goal kick') || texts.includes('Free kick')) return 'Reinicio';
  if (texts.includes('Interception')) return 'Intercepción';
  if (texts.includes('Goalkeeper exit')) return 'Salida';
  if (texts.includes('Aerial duel')) return 'Duelo aéreo';
  if (texts.includes('Recovery')) return 'Recuperación';
  if (texts.includes('Shot against')) return texts.includes('Save') ? 'Parada' : 'Tiro';
  if (texts.some(t => SHOT_LABELS.includes(t))) return 'Tiro';
  return texts[0] || 'Acción';
}

const FILTER_TYPES = ['Todos', 'Pases', 'Tiros', 'Goles', 'Centros', 'Reinicios'];

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

export default function MatchTimeline({
  events = [], periods = [], videoSrc, videoPath, videoType,
  playbackMode = 'clip', onPlaybackModeChange, videoSync,
  clipRatings = {}, onClipRatingChange,
  clipCustomizations = {}, onClipCustomizationChange,
  activeVideoSource, onActiveVideoSourceChange,
}) {
  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clipStart, setClipStart] = useState(null);
  const [clipEnd, setClipEnd] = useState(null);
  const [eventFilter, setEventFilter] = useState('Todos');
  const [customizingId, setCustomizingId] = useState(null);

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
    if (video.currentTime >= clipEnd) {
      video.pause();
      setClipEnd(null);
    }
  }, [currentTime, clipEnd, playbackMode]);

  const toVideoTime = (xmlTime) => {
    if (!videoSync) return xmlTime;
    const xmlPart2 = Number(videoSync.xmlPart2 || 2700);
    const xmlAnchor = xmlTime >= xmlPart2 ? Number(videoSync.xmlPart2 || 2700) : Number(videoSync.xmlPart1 || 0);
    const videoAnchor = xmlTime >= xmlPart2 ? Number(videoSync.videoPart2 || 2700) : Number(videoSync.videoPart1 || 0);
    return Math.max(0, xmlTime - (xmlAnchor - videoAnchor));
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
    videoRef.current.play().catch(() => {});
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play().catch(() => {});
  };

  const maxTime = Math.max(duration, totalDuration, 1);

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'Todos') return events;
    return events.filter(ev => {
      const type = getEventType(ev.labels);
      return type === eventFilter;
    });
  }, [events, eventFilter]);

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

  return (
    <div className="w-full space-y-4">
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
            <input
              type="range"
              min={clipStart}
              max={clipEnd}
              step={0.1}
              value={Math.min(clipEnd, Math.max(clipStart, currentTime))}
              onChange={(e) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Number(e.target.value);
                }
              }}
              className="w-full h-2 bg-gk-elevated rounded-full appearance-none cursor-pointer accent-gk-accent"
            />
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

      {/* Filter buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTER_TYPES.map(type => (
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

      {customizingId && <style>{`
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
      <div className="max-h-96 overflow-y-auto rounded-xl" style={{border: '1px solid rgba(185,165,135,0.08)', background: 'rgba(22,20,16,0.4)'}}>
        {filteredEvents.length === 0 && (
          <div className="p-4 text-center text-sm text-gk-text-tertiary">No hay eventos del portero</div>
        )}
        {filteredEvents.map(ev => {
          const minute = Math.round((ev.start / maxTime) * 90);
          const color = getEventColor(ev.labels);
          const label = getEventLabel(ev.labels);
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
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-mono text-gk-text-tertiary w-10 shrink-0">{minute}'</span>
                  <span className="text-sm text-gk-text-primary truncate">{label}</span>
                  <span className="text-xs text-gk-text-tertiary ml-auto shrink-0">{formatTime(ev.start)}</span>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <StarRating
                    value={rating}
                    onChange={(val) => onClipRatingChange?.(ev.id, val === rating ? 0 : val)}
                    size={12}
                  />
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); setCustomizingId(isCustomizing ? null : ev.id); }}
                  className={`p-1 rounded text-xs transition-colors ${
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
  );
}
