/**
 * xmlParser.js — Parse match analysis XML files into structured JSON
 *
 * Supports two formats:
 *   • Simple: <instance><ID/><start/><end/><code/><label><text/></label></instance>
 *   • Player-based: same but with multiple <label><group/><text/></label> per instance
 */

export function parseMatchXml(xmlString, options = {}) {
  const goalkeeperNames = Array.isArray(options.goalkeeperNames) ? options.goalkeeperNames : [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) throw new Error('Invalid XML: ' + parserError.textContent);

  const instances = Array.from(doc.querySelectorAll('ALL_INSTANCES > instance'));
  const rows = Array.from(doc.querySelectorAll('ROWS > row'));

  // ─── Parse team roster from ROWS ───────────────────────────────────────────
  const allPlayers = [];
  rows.forEach(row => {
    const code = row.querySelector('code')?.textContent?.trim() || '';
    if (!code || code === 'Periods') return;
    const r = parseInt(row.querySelector('R')?.textContent || '0', 10);
    const g = parseInt(row.querySelector('G')?.textContent || '0', 10);
    const b = parseInt(row.querySelector('B')?.textContent || '0', 10);
    const sortOrderInput = row.querySelector('sort_order')?.textContent;
    const sortOrder = sortOrderInput !== undefined && sortOrderInput !== null
      ? parseFloat(sortOrderInput) : NaN;
    allPlayers.push({ code, r, g, b, sortOrder });
  });

  // ─── Parse periods ─────────────────────────────────────────────────────────
  const periods = instances
    .filter(inst => {
      const code = inst.querySelector('code')?.textContent?.trim();
      return code === 'Periods';
    })
    .map(inst => ({
      id: inst.querySelector('ID')?.textContent || '',
      start: parseFloat(inst.querySelector('start')?.textContent || '0'),
      end: parseFloat(inst.querySelector('end')?.textContent || '0'),
    }));

  // Fallback periods for simple XML format
  if (periods.length === 0) {
    const allStarts = instances
      .map(i => parseFloat(i.querySelector('start')?.textContent || '0'))
      .filter(s => s > 0);
    const maxStart = Math.max(...allStarts, 0);
    const halfTime = maxStart > 5000 ? maxStart / 2 : maxStart;
    periods.push({ id: '1H', start: 1, end: halfTime });
    if (maxStart > halfTime + 10) {
      periods.push({ id: '2H', start: halfTime + 1, end: maxStart });
    }
  }

  // ─── Parse all instances ───────────────────────────────────────────────────
  const allEvents = instances.map(inst => {
    const id = inst.querySelector('ID')?.textContent || '';
    const code = inst.querySelector('code')?.textContent?.trim() || '';
    const start = parseFloat(inst.querySelector('start')?.textContent || '0');
    const end = parseFloat(inst.querySelector('end')?.textContent || '0');
    const labels = Array.from(inst.querySelectorAll('label')).map(l => {
      const group = l.querySelector('group')?.textContent || '';
      const text = l.querySelector('text')?.textContent || '';
      return { group, text };
    });
    return { id, code, start, end, labels };
  });

  // ─── Detect goalkeeper ─────────────────────────────────────────────────────
  const normalize = (v) =>
    String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const wanted = goalkeeperNames
    .map((g) => normalize(typeof g === 'string' ? g : g?.name))
    .filter(Boolean);

  const byCode = new Map();
  for (const ev of allEvents) {
    if (!ev.code || ev.code === 'Periods') continue;
    if (!byCode.has(ev.code)) {
      byCode.set(ev.code, {
        code: ev.code,
        normCode: normalize(ev.code.replace(/^\(?\d+\)?\.?\s*/, '')),
        hasGoalkeeperAction: false,
        score: 0,
      });
    }
    const item = byCode.get(ev.code);
    if (ev.labels.some((l) => l.text === 'Goalkeeper action')) item.hasGoalkeeperAction = true;
  }

  for (const item of byCode.values()) {
    if (/^1\./.test(item.code) || /^\(1\)/.test(item.code)) item.score += 1;
    if (item.hasGoalkeeperAction) item.score += 5;
    if (wanted.length) {
      for (const n of wanted) {
        if (!n) continue;
        if (item.normCode.includes(n) || n.includes(item.normCode)) {
          item.score += 20;
          break;
        }
      }
    }
  }

  const ranked = Array.from(byCode.values()).sort((a, b) => b.score - a.score);
  let goalkeeperCode = ranked[0]?.code || '';

  // ─── Split into two teams ───────────────────────────────────────────────
  // Primary: sort_order bucket (sort_order < 1000 = team A, 1000–99999 = team B)
  // Fallback: color RGB similarity
  function detectTeams(players, gkCode) {
    const meta = { method: '', confidence: 'low', warnings: [] };
    if (players.length === 0) return { home: [], away: [], meta };
    const hasSortOrder = players.some(p => p.sortOrder !== undefined && !isNaN(p.sortOrder) && p.sortOrder > 0);
    if (hasSortOrder) {
      const buckets = new Map();
      for (const p of players) {
        const bucket = Math.floor(p.sortOrder / 1000);
        if (bucket >= 100) continue;
        if (!buckets.has(bucket)) buckets.set(bucket, []);
        buckets.get(bucket).push(p);
      }
      const sorted = Array.from(buckets.entries()).sort((a, b) => b[1].length - a[1].length);
      if (sorted.length >= 2) {
        const teamA = sorted[0][1];
        const teamB = sorted[1][1];
        meta.method = 'sort_order';
        meta.confidence = 'alta';
        const home = teamA.some(p => p.code === gkCode) ? teamA : teamB;
        const away = teamA.some(p => p.code === gkCode) ? teamB : teamA;
        return { home, away, meta };
      }
      meta.warnings.push('sort_order presente pero insuficiente buckets, se usa fallback color');
    }
    const colorKey = (p) => `${p.r},${p.g},${p.b}`;
    const groups = new Map();
    for (const p of players) {
      const key = colorKey(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const entries = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
    const teamA = entries[0]?.[1] || [];
    const teamB = entries[1]?.[1] || [];
    const home = teamA.some(p => p.code === gkCode) ? teamA : teamB;
    const away = teamA.some(p => p.code === gkCode) ? teamB : teamA;
    meta.method = 'color';
    meta.confidence = 'media';
    if (!teamB.length) meta.warnings.push('Solo se detectó un equipo por color');
    return { home, away, meta };
  }
  const { home: homeTeam, away: awayTeam, meta: teamDetectionMeta } = detectTeams(allPlayers, goalkeeperCode);
  const teams = { home: homeTeam, away: awayTeam };

  const gkEvents = allEvents.filter(e => e.code === goalkeeperCode);

  // Build set of opponent player codes for reliable filtering
  const isGkHome = teams.home.some(p => p.code === goalkeeperCode);
  const opponentPlayerCodes = isGkHome
    ? new Set(teams.away.map(p => p.code))
    : new Set(teams.home.map(p => p.code));

  const opponentEvents = allEvents.filter(e => {
    if (e.code === goalkeeperCode || e.code === '' || e.code === 'Periods') return false;
    return opponentPlayerCodes.has(e.code);
  });

  const goalkeeperStats = computeGkStats(gkEvents, allEvents, teams.home.some(p => p.code === goalkeeperCode) ? teams.home.map(p => p.code) : teams.away.map(p => p.code));
  let opponentStats = computeOpponentStats(opponentEvents);

  // Fallback: if opponent has no shots, try without team color filtering
  if ((opponentStats.shots.total || 0) === 0) {
    const myTeamCodes = new Set(isGkHome ? teams.home.map(p => p.code) : teams.away.map(p => p.code));
    const fallbackOpponentEvents = allEvents.filter(e =>
      e.code !== goalkeeperCode &&
      e.code !== '' &&
      e.code !== 'Periods' &&
      !myTeamCodes.has(e.code) &&
      !e.labels.some(l => l.text === 'Goalkeeper action')
    );
    opponentStats = computeOpponentStats(fallbackOpponentEvents);
  }

  // If opponent shots still 0 but GK faced shots, remap GK 'Shot against' events
  if ((opponentStats.shots.total || 0) === 0 && goalkeeperStats.shotsAgainst.total > 0) {
    const gkShotEvents = gkEvents.filter(e =>
      e.labels.some(l => l.text === 'Shot against')
    );
    if (gkShotEvents.length > 0) {
      const mapped = gkShotEvents.map(ev => ({
        ...ev,
        labels: ev.labels.map(l => ({
          ...l,
          text: l.text === 'Shot against' ? 'Shot' : l.text
        }))
      }));
      const mergedStats = computeOpponentStats([...opponentEvents, ...mapped]);
      if (mergedStats.shots.total > 0) {
        opponentStats = mergedStats;
      }
    }
  }

  return {
    teams,
    periods,
    goalkeeper: {
      code: goalkeeperCode,
      name: goalkeeperCode.replace(/^\d+\.\s*/, '').replace(/^\(\d+\)\s*/, ''),
      events: gkEvents,
      stats: goalkeeperStats,
    },
    opponent: {
      events: opponentEvents,
      stats: opponentStats,
    },
    allEvents,
    meta: {
      teamDetection: teamDetectionMeta,
    },
  };
}

function computeGkStats(events, allEvents, teamCodes) {
  const stats = {
    passes: { total: 0, forward: 0, lateral: 0, back: 0, short: 0, long: 0, progressive: 0, loss: 0, underPressure: 0, hand: 0, head: 0 },
    goalKicks: { total: 0, loss: 0 },
    freeKicks: { total: 0 },
    exits: { total: 0, interceptions: 0, goalkeeperExit: 0, aerialDuels: 0, recoveries: 0 },
    shotsAgainst: { total: 0, onTarget: 0, offTarget: 0, conceded: 0, penalty: 0, saves: 0, saveWithReflex: 0 },
    crosses: { total: 0, completed: 0, blocked: 0, loss: 0 },
    corners: { total: 0 },
    distribution: {},
  };

  events.forEach(ev => {
    const texts = ev.labels.map(l => l.text);

    // Passes (including touches merged with passes)
    if (texts.includes('Pass')) {
      stats.passes.total++;
      if (texts.includes('Forward pass')) stats.passes.forward++;
      if (texts.includes('Lateral pass')) stats.passes.lateral++;
      if (texts.includes('Back pass')) stats.passes.back++;
      if (texts.includes('Short or medium pass')) stats.passes.short++;
      if (texts.includes('Long pass')) stats.passes.long++;
      if (texts.includes('Progressive pass')) stats.passes.progressive++;
      if (texts.includes('Loss')) stats.passes.loss++;
      if (texts.includes('Under pressure')) stats.passes.underPressure++;
      if (texts.includes('Hand pass')) stats.passes.hand++;
      if (texts.includes('Head pass')) stats.passes.head++;
    }

    // Goal kicks
    if (texts.includes('Goal kick')) {
      stats.goalKicks.total++;
      if (texts.includes('Loss')) stats.goalKicks.loss++;
    }

    // Free kicks
    if (texts.includes('Free kick')) stats.freeKicks.total++;

    // Exits / defensive actions
    if (texts.includes('Interception')) stats.exits.interceptions++;
    if (texts.includes('Goalkeeper exit')) stats.exits.goalkeeperExit++;
    if (texts.includes('Aerial duel')) stats.exits.aerialDuels++;
    if (texts.includes('Recovery')) stats.exits.recoveries++;

    // Shots against
    if (texts.includes('Shot against')) {
      stats.shotsAgainst.total++;
      if (texts.includes('Conceded goal')) stats.shotsAgainst.conceded++;
      if (texts.includes('Penalty conceded goal')) stats.shotsAgainst.penalty++;
      if (texts.includes('Save with reflex')) {
        stats.shotsAgainst.saves++;
        stats.shotsAgainst.saveWithReflex++;
      } else if (texts.includes('Save')) {
        stats.shotsAgainst.saves++;
      }
    }
  });

  // Count goal kicks from teammates too (e.g. defender taking goal kicks)
  if (teamCodes && allEvents) {
    const gkCodes = new Set(events.map(e => e.code));
    for (const ev of allEvents) {
      if (!teamCodes.includes(ev.code) || gkCodes.has(ev.code)) continue;
      const texts = ev.labels.map(l => l.text);
      if (texts.includes('Goal kick')) {
        stats.goalKicks.total++;
        if (texts.includes('Loss')) stats.goalKicks.loss++;
      }
    }
  }

  // Restarts: team goal kicks + GK free kicks
  stats.restarts = {
    total: stats.goalKicks.total + stats.freeKicks.total,
    goalKicks: stats.goalKicks.total,
    gkFreeKicks: stats.freeKicks.total,
  };

  return stats;
}

export function computeOpponentStats(events) {
  const stats = {
    shots: { total: 0, onTarget: 0, offTarget: 0, head: 0, afterCorner: 0, afterFreeKick: 0, opportunity: 0, touchInBox: 0 },
    crosses: { total: 0, completed: 0, blocked: 0, loss: 0 },
    corners: { total: 0 },
  };

  events.forEach(ev => {
    const texts = ev.labels.map(l => l.text);

    // Shots — include all shot variants (some XMLs only label Free kick shot, Head shot, etc.)
    const isShot = texts.some(t =>
      ['Shot', 'Head shot', 'Free kick shot', 'Shot after corner', 'Shot after throw in'].includes(t)
    );
    if (isShot) {
      stats.shots.total++;
      if (texts.includes('Head shot')) stats.shots.head++;
      if (texts.includes('Shot after corner')) stats.shots.afterCorner++;
      if (texts.includes('Free kick shot') || texts.includes('Shot after free kick')) stats.shots.afterFreeKick++;
      if (texts.includes('Opportunity')) stats.shots.opportunity++;
      if (texts.includes('Touch in box')) stats.shots.touchInBox++;
    }

    // Crosses — include free kick crosses
    const isCross = texts.some(t => ['Cross', 'Free kick cross'].includes(t));
    if (isCross) {
      stats.crosses.total++;
      if (texts.includes('Deep completed cross')) stats.crosses.completed++;
      if (texts.includes('Cross blocked')) stats.crosses.blocked++;
      if (texts.includes('Loss')) stats.crosses.loss++;
    }

    // Corners
    if (texts.includes('Corner')) stats.corners.total++;
  });

  return stats;
}

/**
 * Build pass map data: { targets: [{ code, name, passes, x, y }] }
 * Uses sequential instances (ID+1 within 10s) as target heuristic.
 */
export function buildPassMap(events, allEvents) {
  const allById = new Map(allEvents.map(e => [e.id, e]));
  const targets = new Map();

  events.forEach(ev => {
    const texts = ev.labels.map(l => l.text);
    if (!texts.includes('Pass')) return;

    // Skip failed passes — no receiver
    if (texts.includes('Loss')) return;

    const nextId = String(parseInt(ev.id, 10) + 1);
    const next = allById.get(nextId);
    if (!next || next.code === '' || next.code === 'Periods') return;

    const timeDiff = next.start - ev.start;
    if (timeDiff < 0 || timeDiff > 10) return;

    const targetCode = next.code;
    const targetName = targetCode.replace(/^\d+\.\s*/, '').replace(/^\(\d+\)\s*/, '');

    if (!targets.has(targetCode)) {
      targets.set(targetCode, {
        code: targetCode,
        name: targetName,
        passes: 0,
      });
    }

    targets.get(targetCode).passes++;
  });

  // Default 4-3-3 positions (percentage x,y on a 100x100 field)
  const defaultPositions = {
    '3.':  { x: 35, y: 78 }, // DFC1
    '16.': { x: 65, y: 78 }, // DFC2
    '14.': { x: 15, y: 75 }, // LI
    '4.':  { x: 85, y: 75 }, // LD
    '6.':  { x: 30, y: 55 }, // MC1
    '10.': { x: 50, y: 55 }, // MC2
    '5.':  { x: 70, y: 55 }, // MC3
    '20.': { x: 20, y: 35 }, // EI
    '9.':  { x: 50, y: 30 }, // DC
    '7.':  { x: 80, y: 35 }, // ED
  };

  const result = [];
  for (const [code, data] of targets) {
    const numPrefix = code.match(/^(\d+)\./)?.[1] || '';
    const pos = Object.entries(defaultPositions).find(([k]) => code.startsWith(k));
    const defaultPos = pos ? pos[1] : { x: 50, y: 50 };

    result.push({
      ...data,
      x: defaultPos.x,
      y: defaultPos.y,
      number: numPrefix,
    });
  }

  return result;
}

/**
 * Calculate match minute from video timestamp and periods.
 */
export function toMatchMinute(start, periods) {
  if (!periods || periods.length === 0) return start / 60;

  const p1 = periods.find(p => p.id === '1H') || periods[0];
  const p2 = periods.find(p => p.id === '2H');

  if (start <= p1.end) {
    return (start / p1.end) * 45;
  }
  if (p2 && start >= p2.start) {
    return 45 + ((start - p2.start) / (p2.end - p2.start)) * 45;
  }
  return start / 60;
}

/**
 * Compute bidirectional pass flow between GK and each player.
 * Returns: { code: { gkToPlayer, playerToGk, gkSuccess, gkTotal, playerSuccess, playerTotal } }
 * @param {string} gkCode - Goalkeeper's player code
 * @param {Array} allEvents - All events from the match
 * @param {string[]} [teammateCodes] - Array of player codes on the GK's team (to filter out opponents)
 */
export function computeBidirectionalFlow(gkCode, allEvents, teammateCodes) {
  const allById = new Map(allEvents.map(e => [e.id, e]));
  
  const flow = new Map();

  // Normalize player codes for fuzzy matching (strip number prefix, normalize whitespace)
  const normalizeCode = (code) =>
    String(code || '')
      .replace(/^\(?\d+\)?\.?\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const teammateNormMap = teammateCodes
    ? new Map(teammateCodes.map(c => [normalizeCode(c), c]))
    : null;

  // Helper to classify player by position based on jersey number prefix
  function getPositionType(code) {
    const num = parseInt(code.match(/^(\d+)\./)?.[1] || code.match(/^\((\d+)\)/)?.[1] || '0', 10);
    if (num >= 1 && num <= 4) return 'defense'; // 1-4: DEF
    if (num >= 5 && num <= 11) return 'midfield'; // 5-11: MID
    return 'forward'; // rest: ATT
  }

  // Track inference quality for reporting
  const flowMeta = { totalLinks: 0, droppedByGap: 0, droppedByTeam: 0, droppedByNonPass: 0, confidenceBuckets: { alta: 0, media: 0, baja: 0 } };

  // Normalize a code once and reuse
  const normGkCode = normalizeCode(gkCode);

  allEvents.forEach(ev => {
    const texts = ev.labels.map(l => l.text);
    if (!texts.includes('Pass')) return;
    if (texts.includes('Loss')) return;

    const evCode = ev.code;
    if (!evCode || evCode === '' || evCode === 'Periods') return;

    const nextId = String(parseInt(ev.id, 10) + 1);
    const next = allById.get(nextId);
    if (!next || next.code === '' || next.code === 'Periods') {
      flowMeta.droppedByNonPass++;
      return;
    }

    // Use start-to-start gap for pass inference
    // (events overlap heavily so end-to-start is unreliable)
    const timeDiff = next.start - ev.start;
    const maxTimeDiff = 8.0;
    if (timeDiff < 0 || timeDiff > maxTimeDiff) {
      flowMeta.droppedByGap++;
      return;
    }

    const nextTexts = next.labels.map(l => l.text);
    const normEvCode = normalizeCode(evCode);
    const normNextCode = normalizeCode(next.code);

    const isFromGK = normEvCode === normGkCode;
    const isToGK = normNextCode === normGkCode;

    if (!isFromGK && !isToGK) return;

    const targetCode = isFromGK ? next.code : ev.code;
    const normTarget = normalizeCode(targetCode);

    // Filter opponents using normalized comparison
    if (teammateNormMap && normTarget !== normGkCode) {
      const isTeammate = teammateNormMap.has(normTarget);
      if (!isTeammate) {
        flowMeta.droppedByTeam++;
        return;
      }
      const resolvedCode = teammateNormMap.get(normTarget);
      if (resolvedCode && !flow.has(resolvedCode)) {
        flow.set(resolvedCode, {
          code: resolvedCode,
          name: resolvedCode.replace(/^\d+\.\s*/, '').replace(/^\(\d+\)\s*/, ''),
          position: getPositionType(resolvedCode),
          gkToPlayer: 0,
          playerToGk: 0,
          gkSuccess: 0,
          gkTotal: 0,
          playerSuccess: 0,
          playerTotal: 0,
          confidence: 'none',
          gap: 0,
        });
      }
      const f = flow.get(resolvedCode);
      if (isFromGK) {
        f.gkToPlayer++;
        f.gkTotal++;
        f.gkSuccess++;
      } else {
        f.playerToGk++;
        f.playerTotal++;
        f.playerSuccess++;
      }
      // Assign confidence based on start-to-start gap
      let linkConfidence = 'baja';
      if (timeDiff <= 2.0 && (nextTexts.includes('Touch') || nextTexts.includes('Carry') || nextTexts.includes('Recovery') || nextTexts.includes('Pass'))) {
        linkConfidence = 'alta';
      } else if (timeDiff <= 4.0) {
        linkConfidence = 'media';
      }
      f.confidence = linkConfidence;
      f.gap = timeDiff;
      flowMeta.confidenceBuckets[linkConfidence]++;
      flowMeta.totalLinks++;
      return;
    }

    if (!flow.has(targetCode)) {
      flow.set(targetCode, {
        code: targetCode,
        name: targetCode.replace(/^\d+\.\s*/, '').replace(/^\(\d+\)\s*/, ''),
        position: getPositionType(targetCode),
        gkToPlayer: 0,
        playerToGk: 0,
        gkSuccess: 0,
        gkTotal: 0,
        playerSuccess: 0,
        playerTotal: 0,
        confidence: 'none',
        gap: 0,
      });
    }

    const f = flow.get(targetCode);

    if (isFromGK) {
      f.gkToPlayer++;
      f.gkTotal++;
      f.gkSuccess++;
    } else {
      f.playerToGk++;
      f.playerTotal++;
      f.playerSuccess++;
    }

    let linkConfidence = 'baja';
    if (timeDiff <= 2.0 && (nextTexts.includes('Touch') || nextTexts.includes('Carry') || nextTexts.includes('Recovery') || nextTexts.includes('Pass'))) {
      linkConfidence = 'alta';
    } else if (timeDiff <= 4.0) {
      linkConfidence = 'media';
    }
    f.confidence = linkConfidence;
    f.gap = timeDiff;
    flowMeta.confidenceBuckets[linkConfidence]++;
    flowMeta.totalLinks++;
  });

  // Calculate max flow for line width normalization
  let maxFlow = 0;
  for (const f of flow.values()) {
    const total = f.gkToPlayer + f.playerToGk;
    if (total > maxFlow) maxFlow = total;
  }

  // Convert to array with computed fields
  const result = [];
  for (const [, data] of flow) {
    const total = data.gkToPlayer + data.playerToGk;
    result.push({
      ...data,
      total,
      gkSuccessRate: data.gkTotal > 0 ? data.gkSuccess / data.gkTotal : 0,
      playerSuccessRate: data.playerTotal > 0 ? data.playerSuccess / data.playerTotal : 0,
      widthRatio: maxFlow > 0 ? total / maxFlow : 0,
    });
  }

  return {
    flow: result.sort((a, b) => b.total - a.total),
    meta: flowMeta,
  };
}

/**
 * Compute passes RECEIVED by the goalkeeper (passes from teammates to GK).
 */
export function computePassesReceived(gkCode, allEvents) {
  const allById = new Map(allEvents.map(e => [e.id, e]));
  
  const received = {
    total: 0,
    fromDefense: 0,
    fromMidfield: 0,
    fromAttack: 0,
    successful: 0,
  };

  function getPositionType(code) {
    const num = parseInt(code.match(/^(\d+)\./)?.[1] || code.match(/^\((\d+)\)/)?.[1] || '0', 10);
    if (num >= 1 && num <= 4) return 'defense';
    if (num >= 5 && num <= 11) return 'midfield';
    return 'attack';
  }

  allEvents.forEach(ev => {
    const texts = ev.labels.map(l => l.text);
    
    // Check if this event is a pass OR touch (receiving the ball)
    const isPassOrTouch = texts.includes('Pass') || texts.includes('Touch');
    if (!isPassOrTouch) return;
    
    // Check if this event is the GK receiving
    const evCode = ev.code;
    if (!evCode || evCode === '' || evCode === 'Periods') return;
    const isGKEvent = evCode === gkCode || evCode.includes(gkCode);
    if (!isGKEvent) return;

    // Look at previous event to see if it was a pass TO the GK from a teammate
    const prevId = String(parseInt(ev.id, 10) - 1);
    const prev = allById.get(prevId);
    if (!prev || prev.code === '' || prev.code === 'Periods') return;
    
    const prevTexts = prev.labels.map(l => l.text);
    if (!prevTexts.includes('Pass')) return;
    
    // Si el pase del compañero fue fallido, el GK no lo recibió
    if (prevTexts.includes('Loss')) return;

    // Previous was a pass from teammate TO GK - this is a "received pass"
    received.total++;
    received.successful++;

    const posType = getPositionType(prev.code);
    if (posType === 'defense') received.fromDefense++;
    else if (posType === 'midfield') received.fromMidfield++;
    else received.fromAttack++;
  });

  return {
    ...received,
    successRate: received.total > 0 ? received.successful / received.total : 0,
  };
}

/**
 * Merge Touch events with the following event from the same player.
 * A Touch followed by a Pass becomes a single event starting at Touch.start
 * and ending at Pass.end, with all labels merged.
 */
export function mergeTouchEvents(events) {
  const merged = [];
  const skipIds = new Set();

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (skipIds.has(ev.id)) continue;

    const texts = ev.labels.map(l => l.text);

    if (texts.includes('Touch') && i + 1 < events.length) {
      const next = events[i + 1];
      if (next.code === ev.code) {
        const mergedEvent = {
          ...next,
          start: ev.start,
          originalTouchId: ev.id,
          originalEventId: next.id,
          mergedLabels: [...ev.labels, ...next.labels],
        };
        merged.push(mergedEvent);
        skipIds.add(ev.id);
        skipIds.add(next.id);
        continue;
      }
    }

    merged.push(ev);
  }

  return merged;
}

/**
 * Interpolate between two hex colors based on a 0-1 value.
 */
export function interpolateColor(color1, color2, factor) {
  const hex = (c) => parseInt(c.slice(1), 16);
  const r1 = (hex(color1) >> 16) & 255;
  const g1 = (hex(color1) >> 8) & 255;
  const b1 = hex(color1) & 255;
  const r2 = (hex(color2) >> 16) & 255;
  const g2 = (hex(color2) >> 8) & 255;
  const b2 = hex(color2) & 255;
  
  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);
  
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Get color based on success rate (green->yellow->red gradient).
 */
export function getSuccessColor(successRate) {
  // Athletic-style palette: Red (#ef4444) -> Yellow/Gold (#f59e0b) -> Teal/Green (#d4a574)
  if (successRate >= 0.9) return '#d4a574'; // Teal
  if (successRate >= 0.7) {
    return interpolateColor('#f59e0b', '#d4a574', (successRate - 0.7) * 5);
  }
  if (successRate >= 0.4) {
    return interpolateColor('#ef4444', '#f59e0b', (successRate - 0.4) * 2);
  }
  return '#ef4444'; // Red
}
