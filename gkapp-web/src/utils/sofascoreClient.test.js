import { describe, it, expect } from 'vitest';
import { selectGoalkeeper, extractEventId, extractGoalkeeperMatchStats } from './sofascoreClient';

function gk({ id, name, teamId, home = true }) {
  return {
    player: { id, name, position: 'G' },
    teamId,
  };
}

describe('selectGoalkeeper', () => {
  const base = {
    homeTeamId: 10,
    awayTeamId: 20,
    homeTeamName: 'Home FC',
    awayTeamName: 'Away FC',
  };

  it('selecciona por fuzzyMatch de nombre al portero local consistente', () => {
    const res = selectGoalkeeper({
      ...base,
      homePlayers: [gk({ id: 1, name: 'Marc Martinez', teamId: 10 })],
      awayPlayers: [gk({ id: 2, name: 'Rival GK', teamId: 20, home: false })],
      goalkeeperName: 'MARC',
    });
    expect(res.goalkeeper?.player?.id).toBe(1);
    expect(res.goalkeeperIsHome).toBe(true);
  });

  it('ignora filas anómalas (nombre que coincide pero teamId del equipo contrario)', () => {
    // Iker está en la alineación local pero con teamId del visitante → anómalo
    const res = selectGoalkeeper({
      ...base,
      homePlayers: [gk({ id: 1, name: 'Iker Piedra', teamId: 20 })],
      awayPlayers: [gk({ id: 2, name: 'Marc Martinez', teamId: 10, home: false })],
      goalkeeperName: 'IKER',
    });
    expect(res.goalkeeper).toBeNull();
  });

  it('ignora filas con teamId ajeno al partido', () => {
    const res = selectGoalkeeper({
      ...base,
      homePlayers: [gk({ id: 1, name: 'Marc Martinez', teamId: 999 })],
      awayPlayers: [],
      goalkeeperName: 'MARC',
    });
    expect(res.goalkeeper).toBeNull();
  });

  it('hace fallback al primer portero (position G) consistente sin coincidencia de nombre', () => {
    const res = selectGoalkeeper({
      ...base,
      homePlayers: [gk({ id: 5, name: 'Carlos', teamId: 10 })],
      awayPlayers: [gk({ id: 6, name: 'Rival GK', teamId: 20, home: false })],
      goalkeeperName: 'NOBODY',
    });
    expect(res.goalkeeper?.player?.id).toBe(5);
  });

  it('preferredPlayerId sobreescribe aunque venga de una fila anómala', () => {
    const res = selectGoalkeeper({
      ...base,
      homePlayers: [gk({ id: 1, name: 'Iker Piedra', teamId: 20 })],
      awayPlayers: [],
      goalkeeperName: 'MARC',
      preferredPlayerId: 1,
    });
    expect(res.goalkeeper?.player?.id).toBe(1);
  });

  it('devuelve candidates de ambos equipos con su flag anomalous', () => {
    const res = selectGoalkeeper({
      ...base,
      homePlayers: [
        gk({ id: 1, name: 'Iker Piedra', teamId: 20 }), // anómalo
        gk({ id: 3, name: 'Marc Martinez', teamId: 10 }),
      ],
      awayPlayers: [gk({ id: 2, name: 'Rival GK', teamId: 20, home: false })],
      goalkeeperName: 'MARC',
    });
    const byId = Object.fromEntries(res.candidates.map((c) => [c.playerId, c]));
    expect(res.goalkeeper?.player?.id).toBe(3);
    expect(res.candidates).toHaveLength(3);
    expect(byId[1].anomalous).toBe(true);
    expect(byId[3].anomalous).toBe(false);
    expect(byId[2].anomalous).toBe(false);
    expect(byId[2].teamName).toBe('Away FC');
  });

  it('deduplica candidates por playerId', () => {
    const res = selectGoalkeeper({
      ...base,
      homePlayers: [
        gk({ id: 1, name: 'Marc Martinez', teamId: 10 }),
        gk({ id: 1, name: 'Marc Martinez', teamId: 10 }),
      ],
      awayPlayers: [],
      goalkeeperName: 'MARC',
    });
    expect(res.candidates).toHaveLength(1);
  });

  it('devuelve null cuando no hay ningún portero', () => {
    const res = selectGoalkeeper({
      ...base,
      homePlayers: [],
      awayPlayers: [],
      goalkeeperName: 'MARC',
    });
    expect(res.goalkeeper).toBeNull();
    expect(res.candidates).toHaveLength(0);
  });
});

describe('extractEventId', () => {
  it('extrae el eventId de una URL de SofaScore', () => {
    expect(extractEventId('https://www.sofascore.com/es/football/match/x/HLjsEMj#id:14102649')).toBe(14102649);
  });

  it('devuelve null sin id', () => {
    expect(extractEventId('https://www.sofascore.com')).toBeNull();
  });
});

describe('extractGoalkeeperMatchStats', () => {
  it('mapea los campos relevantes de las estadísticas del portero', () => {
    const res = extractGoalkeeperMatchStats({
      saves: 6,
      savedShotsFromInsideTheBox: 3,
      accurateKeeperSweeper: 0,
      goodHighClaim: 1,
      errorLeadToAShot: 1,
      totalPass: 16,
      accuratePass: 13,
      totalLongBalls: 11,
      accurateLongBalls: 8,
      rating: 7.1,
    });
    expect(res).toEqual({
      saves: 6,
      savedShotsFromInsideTheBox: 3,
      accurateKeeperSweeper: 0,
      goodHighClaim: 1,
      errorLeadToAShot: 1,
      totalPass: 16,
      accuratePass: 13,
      totalLongBalls: 11,
      accurateLongBalls: 8,
    });
  });

  it('convierte campos ausentes en null', () => {
    const res = extractGoalkeeperMatchStats({ saves: 2 });
    expect(res.saves).toBe(2);
    expect(res.goodHighClaim).toBeNull();
    expect(res.accurateLongBalls).toBeNull();
    expect(res.totalPass).toBeNull();
    expect(res.accuratePass).toBeNull();
  });

  it('devuelve null para entradas no válidas', () => {
    expect(extractGoalkeeperMatchStats(null)).toBeNull();
    expect(extractGoalkeeperMatchStats(undefined)).toBeNull();
    expect(extractGoalkeeperMatchStats('nope')).toBeNull();
    expect(extractGoalkeeperMatchStats([])).toBeNull();
  });
});
