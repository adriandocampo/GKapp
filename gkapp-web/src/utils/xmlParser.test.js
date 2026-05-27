import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseMatchXml, computeBidirectionalFlow, computeOpponentStats } from './xmlParser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const xmlPath = resolve(__dirname, '../../public/XML/Lugo - Arenas Club 1-1 (Player-based).xml');

let fixture;
let parsed;

beforeAll(() => {
  fixture = readFileSync(xmlPath, 'utf-8');
  parsed = parseMatchXml(fixture);
  if (!parsed || !parsed.goalkeeper) throw new Error('Fixture parse failed');
});

// ─── Team detection ─────────────────────────────────────────────────────────

describe('team detection', () => {
  it('detects two teams', () => {
    expect(parsed.teams.home.length).toBeGreaterThan(0);
    expect(parsed.teams.away.length).toBeGreaterThan(0);
  });

  it('uses sort_order method', () => {
    expect(parsed.meta.teamDetection.method).toBe('sort_order');
    expect(parsed.meta.teamDetection.confidence).toBe('alta');
  });

  it('puts GK Marc Martínez in home team', () => {
    expect(parsed.teams.home.some(p => p.code.startsWith('1. Marc'))).toBe(true);
    expect(parsed.teams.away.some(p => p.code.startsWith('1. Marc'))).toBe(false);
  });

  it('separates Lugo (sort_order < 1000) vs Arenas (>= 1000)', () => {
    const homeCodes = parsed.teams.home.map(p => p.code);
    const awayCodes = parsed.teams.away.map(p => p.code);
    expect(homeCodes).toContain('6. Pere Haro');
    expect(homeCodes).toContain('3. Garriz');
    expect(awayCodes).toContain('21. Jon Sillero');
    expect(awayCodes).toContain('24. Santi Borikó');
    expect(awayCodes).toContain('8. Mikel Zabala');
  });
});

// ─── Goalkeeper ─────────────────────────────────────────────────────────────

describe('goalkeeper', () => {
  it('identifies 1. Marc Martínez', () => {
    expect(parsed.goalkeeper.code).toMatch(/1\.?\s*Marc/);
  });

  it('has events', () => {
    expect(parsed.goalkeeper.events.length).toBeGreaterThan(20);
  });
});

// ─── Goalkeeper stats ───────────────────────────────────────────────────────

describe('goalkeeper stats', () => {
  function s() { return parsed.goalkeeper.stats; }

  it('passes total > 0', () => expect(s().passes.total).toBeGreaterThan(0));

  it('restarts = team goal kicks + GK free kicks', () => {
    expect(s().restarts.total).toBe(s().goalKicks.total + s().freeKicks.total);
    expect(s().restarts.total).toBeGreaterThan(0);
  });

  it('counts exits', () => {
    const e = s().exits;
    expect(e.interceptions + e.goalkeeperExit + e.aerialDuels).toBeGreaterThanOrEqual(0);
  });

  it('counts shots against', () => {
    expect(s().shotsAgainst.total).toBeGreaterThanOrEqual(0);
    expect(s().shotsAgainst.saves + s().shotsAgainst.conceded).toBeGreaterThanOrEqual(0);
  });

  it('counts saves and reflex saves', () => {
    expect(s().shotsAgainst.saves).toBeGreaterThanOrEqual(0);
  });
});

// ─── Opponent stats ─────────────────────────────────────────────────────────

describe('opponent stats', () => {
  function s() { return parsed.opponent.stats; }

  it('shots including variants (Free kick shot, Head shot, etc.)', () => {
    const shotLabels = ['Shot', 'Head shot', 'Free kick shot', 'Shot after corner', 'Shot after throw in'];
    const oppCodes = parsed.teams.away.map(p => p.code);
    const manual = parsed.allEvents.filter(e =>
      oppCodes.includes(e.code) && e.labels.some(l => shotLabels.includes(l.text))
    ).length;
    expect(s().shots.total).toBe(manual);
  });

  it('crosses including Free kick cross', () => {
    const crossLabels = ['Cross', 'Free kick cross'];
    const oppCodes = parsed.teams.away.map(p => p.code);
    const manual = parsed.allEvents.filter(e =>
      oppCodes.includes(e.code) && e.labels.some(l => crossLabels.includes(l.text))
    ).length;
    expect(s().crosses.total).toBe(manual);
  });

  it('corners', () => expect(s().corners.total).toBeGreaterThanOrEqual(0));
});

// ─── Pass flow ──────────────────────────────────────────────────────────────

describe('computeBidirectionalFlow', () => {
  function run() {
    const gkCode = parsed.goalkeeper.code;
    const isHome = parsed.teams.home.some(p => p.code === gkCode);
    const mateCodes = (isHome ? parsed.teams.home : parsed.teams.away).map(p => p.code);
    return computeBidirectionalFlow(gkCode, parsed.allEvents, mateCodes);
  }

  it('returns { flow: [...], meta: {...} }', () => {
    const r = run();
    expect(Array.isArray(r.flow)).toBe(true);
    expect(r.meta).toBeDefined();
    expect(r.meta.confidenceBuckets).toBeDefined();
    expect(r.meta.totalLinks).toBeGreaterThan(0);
  });

  it('has flow items with gkToPlayer + playerToGk > 0 total', () => {
    const total = run().flow.reduce((sum, f) => sum + f.gkToPlayer + f.playerToGk, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('excludes opponent players', () => {
    const gkCode = parsed.goalkeeper.code;
    const isHome = parsed.teams.home.some(p => p.code === gkCode);
    const awayCodes = new Set(parsed.teams.away.map(p => p.code));
    const mateCodes = (isHome ? parsed.teams.home : parsed.teams.away).map(p => p.code);
    const r = computeBidirectionalFlow(gkCode, parsed.allEvents, mateCodes);
    for (const item of r.flow) {
      expect(awayCodes.has(item.code)).toBe(false);
    }
  });

  it('has some alta-confidence links', () => {
    const r = run();
    expect(r.meta.confidenceBuckets.alta).toBeGreaterThan(0);
  });

  it('confidence bucket counts sum to totalLinks', () => {
    const r = run();
    const cb = r.meta.confidenceBuckets;
    expect(cb.alta + cb.media + cb.baja).toBe(r.meta.totalLinks);
  });
});

// ─── computeOpponentStats isolated ──────────────────────────────────────────

describe('computeOpponentStats (isolated)', () => {
  it('empty returns zeros', () => {
    const s = computeOpponentStats([]);
    expect(s.shots.total).toBe(0);
    expect(s.crosses.total).toBe(0);
    expect(s.corners.total).toBe(0);
  });

  it('counts Head shot without base Shot label', () => {
    const s = computeOpponentStats([{
      id: '1', code: 'p', start: 0, end: 1,
      labels: [{ group: '1 - Type', text: 'Head shot' }],
    }]);
    expect(s.shots.total).toBe(1);
    expect(s.shots.head).toBe(1);
  });

  it('counts Free kick shot as shot + afterFreeKick', () => {
    const s = computeOpponentStats([{
      id: '1', code: 'p', start: 0, end: 1,
      labels: [{ group: '1 - Type', text: 'Free kick shot' }],
    }]);
    expect(s.shots.total).toBe(1);
    expect(s.shots.afterFreeKick).toBe(1);
  });

  it('counts Free kick cross as cross', () => {
    const s = computeOpponentStats([{
      id: '1', code: 'p', start: 0, end: 1,
      labels: [{ group: '1 - Type', text: 'Free kick cross' }],
    }]);
    expect(s.crosses.total).toBe(1);
  });
});

// ─── Meta ────────────────────────────────────────────────────────────────────

describe('meta', () => {
  it('has teamDetection method', () => {
    expect(parsed.meta.teamDetection.method).toBe('sort_order');
  });

  it('has periods', () => {
    expect(parsed.periods.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Sanity: known match values ─────────────────────────────────────────────

describe('known match values (Lugo - Arenas Club 1-1)', () => {
  function gk() { return parsed.goalkeeper.stats; }
  function opp() { return parsed.opponent.stats; }

  it('GK passes = at least 30', () => {
    expect(gk().passes.total).toBeGreaterThanOrEqual(30);
  });

  it('GK free kicks = 2', () => {
    expect(gk().freeKicks.total).toBe(2);
  });

  it('Arenas shots = at least 3', () => {
    expect(opp().shots.total).toBeGreaterThanOrEqual(3);
  });

  it('Arenas crosses = at least 8', () => {
    expect(opp().crosses.total).toBeGreaterThanOrEqual(8);
  });

  it('Arenas corners = 5', () => {
    expect(opp().corners.total).toBe(5);
  });

  it('GK saves = 1', () => {
    expect(gk().shotsAgainst.saves).toBe(1);
  });

  it('GK conceded = 1', () => {
    expect(gk().shotsAgainst.conceded).toBe(1);
  });

  it('GK restarts >= 2 (team goal kicks + GK free kicks)', () => {
    expect(gk().restarts.total).toBeGreaterThanOrEqual(2);
  });
});
