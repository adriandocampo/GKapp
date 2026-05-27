import https from 'https';

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

export class SofaScoreScraper {
  extractEventId(url) {
    const match = String(url).match(/id:(\d+)/);
    return match ? Number(match[1]) : null;
  }

  _fetchJson(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'www.sofascore.com',
        path: path,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.sofascore.com/',
        },
      };

      https.get(options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          try {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve(JSON.parse(text));
          } catch (err) {
            reject(new Error(`JSON parse error: ${err.message}`));
          }
        });
      }).on('error', reject);
    });
  }

  async fetchEvent(eventId) {
    try {
      return await this._fetchJson(`/api/v1/event/${eventId}`);
    } catch (err) {
      console.error('[SofaScoreScraper] fetchEvent error:', err.message);
      return null;
    }
  }

  async fetchLineups(eventId) {
    try {
      return await this._fetchJson(`/api/v1/event/${eventId}/lineups`);
    } catch (err) {
      console.error('[SofaScoreScraper] fetchLineups error:', err.message);
      return null;
    }
  }

  async fetchShotmap(eventId) {
    try {
      return await this._fetchJson(`/api/v1/event/${eventId}/shotmap`);
    } catch (err) {
      console.error('[SofaScoreScraper] fetchShotmap error:', err.message);
      return [];
    }
  }

  async fetchHeatmap(eventId, playerId) {
    try {
      return await this._fetchJson(`/api/v1/event/${eventId}/player/${playerId}/heatmap`);
    } catch (err) {
      console.error('[SofaScoreScraper] fetchHeatmap error:', err.message);
      return null;
    }
  }

  async fetchMatchData(url, goalkeeperName) {
    const eventId = this.extractEventId(url);
    if (!eventId) {
      throw new Error('No se pudo extraer el eventId de la URL');
    }

    const [event, lineups] = await Promise.all([
      this.fetchEvent(eventId),
      this.fetchLineups(eventId),
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
      this.fetchHeatmap(eventId, playerId),
      this.fetchShotmap(eventId),
    ]);

    const shots = Array.isArray(shotmap) ? shotmap : [];
    const rivalShots = shots.filter((shot) => shot.isHome === !goalkeeperIsHome);

    return {
      event,
      lineups,
      goalkeeper,
      goalkeeperHeatmap,
      rivalShots,
    };
  }
}
