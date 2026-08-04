const API_BASE = 'https://www.sofascore.com';

function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fuzzyMatch(str1, str2) {
  const a = normalizeName(str1);
  const b = normalizeName(str2);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    referrerPolicy: 'no-referrer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${path}`);
  }
  return res.json();
}

export function extractEventId(url) {
  const match = String(url).match(/id:(\d+)/);
  return match ? Number(match[1]) : null;
}

export async function fetchEvent(eventId) {
  try {
    return await fetchJson(`/api/v1/event/${eventId}`);
  } catch (err) {
    console.error('[SofaScore] fetchEvent error:', err.message);
    return null;
  }
}

export async function fetchLineups(eventId) {
  try {
    return await fetchJson(`/api/v1/event/${eventId}/lineups`);
  } catch (err) {
    console.error('[SofaScore] fetchLineups error:', err.message);
    return null;
  }
}

export async function fetchShotmap(eventId) {
  try {
    return await fetchJson(`/api/v1/event/${eventId}/shotmap`);
  } catch (err) {
    console.error('[SofaScore] fetchShotmap error:', err.message);
    return [];
  }
}

export async function fetchHeatmap(eventId, playerId) {
  try {
    return await fetchJson(`/api/v1/event/${eventId}/player/${playerId}/heatmap`);
  } catch (err) {
    console.error('[SofaScore] fetchHeatmap error:', err.message);
    return null;
  }
}

export async function searchPlayer(query) {
  try {
    const data = await fetchJson(`/api/v1/search/players?q=${encodeURIComponent(query)}`);
    return (data?.results || []).filter(r => r.type === 'player').map(r => r.entity);
  } catch (err) {
    console.error('[SofaScore] searchPlayer error:', err.message);
    return [];
  }
}

export async function fetchPlayerProfile(playerId) {
  try {
    const data = await fetchJson(`/api/v1/player/${playerId}`);
    return data?.player || null;
  } catch (err) {
    console.error('[SofaScore] fetchPlayerProfile error:', err.message);
    return null;
  }
}

export async function fetchPlayerSeasons(playerId) {
  try {
    const data = await fetchJson(`/api/v1/player/${playerId}/statistics/seasons`);
    return data?.uniqueTournamentSeasons || [];
  } catch (err) {
    console.error('[SofaScore] fetchPlayerSeasons error:', err.message);
    return [];
  }
}

export async function fetchPlayerSeasonStats(playerId, seasonId) {
  try {
    const data = await fetchJson(`/api/v1/player/${playerId}/statistics?seasonId=${seasonId}`);
    return data?.seasons || [];
  } catch (err) {
    console.error('[SofaScore] fetchPlayerSeasonStats error:', err.message);
    return [];
  }
}

export function getPlayerImageUrl(playerId) {
  return `https://img.sofascore.com/api/v1/player/${playerId}/image`;
}

/**
 * Mapea las estadísticas de partido de un portero (respuesta de
 * /api/v1/event/{eventId}/player/{playerId}/statistics) a los campos
 * que interesan a la tarjeta "Datos del partido".
 */
export function extractGoalkeeperMatchStats(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null;
  return {
    saves: stats.saves ?? null,
    savedShotsFromInsideTheBox: stats.savedShotsFromInsideTheBox ?? null,
    accurateKeeperSweeper: stats.accurateKeeperSweeper ?? null,
    goodHighClaim: stats.goodHighClaim ?? null,
    errorLeadToAShot: stats.errorLeadToAShot ?? null,
    totalPass: stats.totalPass ?? null,
    accuratePass: stats.accuratePass ?? null,
    totalLongBalls: stats.totalLongBalls ?? null,
    accurateLongBalls: stats.accurateLongBalls ?? null,
  };
}

export async function fetchPlayerMatchStats(eventId, playerId) {
  try {
    const data = await fetchJson(`/api/v1/event/${eventId}/player/${playerId}/statistics`);
    return extractGoalkeeperMatchStats(data?.statistics);
  } catch (err) {
    console.error('[SofaScore] fetchPlayerMatchStats error:', err.message);
    return null;
  }
}

export async function fetchPlayerLastEvents(playerId) {
  try {
    const data = await fetchJson(`/api/v1/player/${playerId}/events/last/0`);
    return data?.events || [];
  } catch (err) {
    console.error('[SofaScore] fetchPlayerLastEvents error:', err.message);
    return [];
  }
}

function isConsistentPlayer(p, homeTeamId, awayTeamId) {
  if (!p.teamId) return true; // teamId desconocido: se mantiene como candidato posible
  const expected = p._isHome ? homeTeamId : awayTeamId;
  return p.teamId === expected;
}

/**
 * Selecciona al portero de forma determinista (sin red) y devuelve la lista
 * de porteros candidatos para corrección manual.
 *
 * - La selección automática solo considera jugadores CONSISTENTES: su teamId
 *   debe coincidir con el equipo de su lado de la alineación. Así se descartan
 *   filas anómalas (p.ej. un portero en la alineación local con teamId del
 *   visitante, o con teamId ajeno al partido).
 * - Orden de selección: preferredPlayerId > fuzzyMatch por nombre > posición 'G'.
 * - candidates incluye todos los porteros únicos de ambos equipos (incluye los
 *   anómalos, marcados con `anomalous: true`) para permitir corrección manual.
 */
export function selectGoalkeeper({
  homePlayers,
  awayPlayers,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  goalkeeperName,
  preferredPlayerId = null,
}) {
  const allPlayers = [
    ...(Array.isArray(homePlayers) ? homePlayers : []).map((p) => ({ ...p, _isHome: true })),
    ...(Array.isArray(awayPlayers) ? awayPlayers : []).map((p) => ({ ...p, _isHome: false })),
  ];

  const consistentPlayers = allPlayers.filter((p) => isConsistentPlayer(p, homeTeamId, awayTeamId));

  const candidates = [];
  const seen = new Set();
  for (const p of allPlayers) {
    if (p.player?.position !== 'G') continue;
    const pid = p.player?.id;
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    candidates.push({
      playerId: pid,
      name: p.player?.name || '',
      shortName: p.player?.shortName || '',
      teamId: p.teamId ?? null,
      teamName: (p._isHome ? homeTeamName : awayTeamName) || '',
      isHome: p._isHome,
      anomalous: !!(p.teamId && !isConsistentPlayer(p, homeTeamId, awayTeamId)),
      photoUrl: getPlayerImageUrl(pid),
    });
  }

  let goalkeeper = null;
  let goalkeeperIsHome = null;

  if (preferredPlayerId) {
    const match = allPlayers.find((p) => p.player?.id === preferredPlayerId);
    if (match) {
      goalkeeper = match;
      goalkeeperIsHome = match._isHome;
    }
  }

  if (!goalkeeper) {
    for (const p of consistentPlayers) {
      const name = p.player?.name;
      const shortName = p.player?.shortName;
      if (fuzzyMatch(goalkeeperName, name) || fuzzyMatch(goalkeeperName, shortName)) {
        goalkeeper = p;
        goalkeeperIsHome = p._isHome;
        break;
      }
    }
  }

  if (!goalkeeper) {
    for (const p of consistentPlayers) {
      if (p.player?.position === 'G') {
        goalkeeper = p;
        goalkeeperIsHome = p._isHome;
        break;
      }
    }
  }

  return {
    goalkeeper: goalkeeper || null,
    goalkeeperIsHome,
    candidates,
  };
}

export async function fetchMatchData(url, goalkeeperName, preferredPlayerId = null) {
  const eventId = extractEventId(url);
  if (!eventId) {
    throw new Error('No se pudo extraer el eventId de la URL');
  }

  const [event, lineups] = await Promise.all([
    fetchEvent(eventId),
    fetchLineups(eventId),
  ]);

  if (!lineups) {
    throw new Error('No se pudieron obtener las alineaciones');
  }

  const ev = event?.event || event;
  const homeTeamId = ev?.homeTeam?.id;
  const awayTeamId = ev?.awayTeam?.id;

  const homePlayers = Array.isArray(lineups.home?.players) ? lineups.home.players : [];
  const awayPlayers = Array.isArray(lineups.away?.players) ? lineups.away.players : [];

  const { goalkeeper, goalkeeperIsHome, candidates } = selectGoalkeeper({
    homePlayers,
    awayPlayers,
    homeTeamId,
    awayTeamId,
    homeTeamName: ev?.homeTeam?.name,
    awayTeamName: ev?.awayTeam?.name,
    goalkeeperName,
    preferredPlayerId,
  });

  if (!goalkeeper) {
    throw new Error('No se encontró al portero en las alineaciones');
  }

  const playerId = goalkeeper.player?.id;
  if (!playerId) {
    throw new Error('El portero encontrado no tiene playerId');
  }

  const [goalkeeperHeatmap, shotmap, goalkeeperMatchStats] = await Promise.all([
    fetchHeatmap(eventId, playerId),
    fetchShotmap(eventId),
    fetchPlayerMatchStats(eventId, playerId),
  ]);

  const shots = Array.isArray(shotmap?.shotmap) ? shotmap.shotmap : Array.isArray(shotmap) ? shotmap : [];
  const rivalShots = shots.filter((shot) => shot.isHome === !goalkeeperIsHome);

  return {
    event: ev,
    lineups,
    goalkeeper,
    goalkeeperHeatmap,
    rivalShots,
    goalkeeperCandidates: candidates,
    goalkeeperMatchStats,
  };
}
