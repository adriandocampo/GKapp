import { describe, it, expect } from 'vitest';
import { shouldRunBackup } from './backupSchedule';

const DAY_MS = 86400000;
const NOW = new Date('2026-08-11T12:00:00Z').getTime();

function config(overrides = {}) {
  return { enabled: true, intervalDays: 7, ...overrides };
}

describe('shouldRunBackup', () => {
  it('returns true when a one-shot backup is requested even if auto-backup is disabled', () => {
    expect(shouldRunBackup({
      config: config({ enabled: false, requestedBackupAt: '2026-08-11T10:00:00Z' }),
      lastBackupDate: new Date(NOW - 1 * DAY_MS),
      hasActivity: false,
      now: NOW,
    })).toBe(true);
  });

  it('returns false when disabled and no backup is requested', () => {
    expect(shouldRunBackup({
      config: config({ enabled: false }),
      lastBackupDate: new Date(NOW - 14 * DAY_MS),
      hasActivity: true,
      now: NOW,
    })).toBe(false);
  });

  it('returns true when enabled and there is no previous backup', () => {
    expect(shouldRunBackup({
      config: config(),
      lastBackupDate: null,
      hasActivity: true,
      now: NOW,
    })).toBe(true);
  });

  it('returns true when interval elapsed and there is activity', () => {
    expect(shouldRunBackup({
      config: config(),
      lastBackupDate: new Date(NOW - 10 * DAY_MS),
      hasActivity: true,
      now: NOW,
    })).toBe(true);
  });

  it('returns false when interval elapsed but there is no activity', () => {
    expect(shouldRunBackup({
      config: config(),
      lastBackupDate: new Date(NOW - 10 * DAY_MS),
      hasActivity: false,
      now: NOW,
    })).toBe(false);
  });

  it('returns false when interval has not elapsed', () => {
    expect(shouldRunBackup({
      config: config(),
      lastBackupDate: new Date(NOW - 2 * DAY_MS),
      hasActivity: true,
      now: NOW,
    })).toBe(false);
  });

  it('returns false when config is null', () => {
    expect(shouldRunBackup({
      config: null,
      lastBackupDate: null,
      hasActivity: true,
      now: NOW,
    })).toBe(false);
  });
});
