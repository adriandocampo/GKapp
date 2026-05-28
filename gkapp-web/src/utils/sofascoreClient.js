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

export async function fetchPlayerLastEvents(playerId) {
  try {
    const data = await fetchJson(`/api/v1/player/${playerId}/events/last/0`);
    return data?.events || [];
  } catch (err) {
    console.error('[SofaScore] fetchPlayerLastEvents error:', err.message);
    return [];
  }
}

export async function fetchMatchData(url, goalkeeperName) {
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

  const homePlayers = Array.isArray(lineups.home?.players) ? lineups.home.players : [];
  const awayPlayers = Array.isArray(lineups.away?.players) ? lineups.away.players : [];
  const allPlayers = [
    ...homePlayers.map((p) => ({ ...p, _isHome: true })),
    ...awayPlayers.map((p) => ({ ...p, _isHome: false })),
  ];

  let goalkeeper = null;
  let goalkeeperIsHome = null;

  // Try fuzzy match first
  for (const p of allPlayers) {
    const name = p.player?.name;
    const shortName = p.player?.shortName;
    if (fuzzyMatch(goalkeeperName, name) || fuzzyMatch(goalkeeperName, shortName)) {
      goalkeeper = p;
      goalkeeperIsHome = p._isHome;
      break;
    }
  }

  // Fallback to position === 'G'
  if (!goalkeeper) {
    for (const p of allPlayers) {
      if (p.player?.position === 'G') {
        goalkeeper = p;
        goalkeeperIsHome = p._isHome;
        break;
      }
    }
  }

  if (!goalkeeper) {
    throw new Error('No se encontró al portero en las alineaciones');
  }

  const playerId = goalkeeper.player?.id;
  if (!playerId) {
    throw new Error('El portero encontrado no tiene playerId');
  }

  const [goalkeeperHeatmap, shotmap] = await Promise.all([
    fetchHeatmap(eventId, playerId),
    fetchShotmap(eventId),
  ]);

  const shots = Array.isArray(shotmap?.shotmap) ? shotmap.shotmap : Array.isArray(shotmap) ? shotmap : [];
  const rivalShots = shots.filter((shot) => shot.isHome === !goalkeeperIsHome);

  return {
    event: event?.event || event,
    lineups,
    goalkeeper,
    goalkeeperHeatmap,
    rivalShots,
  };
}
