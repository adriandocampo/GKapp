import { describe, expect, it } from 'vitest';
import { getInclusiveDayCount, isValidMicrocycleRange } from './microcicloItems';

describe('microcycle date range', () => {
  it('accepts the minimum three-day range', () => {
    expect(getInclusiveDayCount('2026-08-03', '2026-08-05')).toBe(3);
    expect(isValidMicrocycleRange('2026-08-03', '2026-08-05')).toBe(true);
  });

  it('accepts the maximum fourteen-day range', () => {
    expect(getInclusiveDayCount('2026-08-03', '2026-08-16')).toBe(14);
    expect(isValidMicrocycleRange('2026-08-03', '2026-08-16')).toBe(true);
  });

  it('rejects ranges shorter than three, longer than fourteen, or reversed', () => {
    expect(isValidMicrocycleRange('2026-08-03', '2026-08-04')).toBe(false);
    expect(isValidMicrocycleRange('2026-08-03', '2026-08-17')).toBe(false);
    expect(isValidMicrocycleRange('2026-08-05', '2026-08-03')).toBe(false);
  });
});
