import { describe, it, expect, vi } from 'vitest';
import { resolveSyncKey } from './syncKey';

describe('resolveSyncKey', () => {
  it('returns an existing primKey unchanged', () => {
    const obj = { id: 42 };
    const { key, assignToObj } = resolveSyncKey(42, obj);
    expect(key).toBe(42);
    expect(assignToObj).toBe(false);
    expect(obj.id).toBe(42);
  });

  it('uses obj.id when primKey is null', () => {
    const obj = { id: 'a1f22872-0000' };
    const { key, assignToObj } = resolveSyncKey(null, obj);
    expect(key).toBe('a1f22872-0000');
    expect(assignToObj).toBe(false);
  });

  it('generates a uuid when primKey and obj.id are both missing', () => {
    const obj = {};
    const { key, assignToObj } = resolveSyncKey(null, obj);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(10);
    expect(assignToObj).toBe(true);
  });

  it('falls back to a timestamp key when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    try {
      const obj = {};
      const { key, assignToObj } = resolveSyncKey(null, obj);
      expect(typeof key).toBe('string');
      expect(key).toMatch(/^\d{13}-/);
      expect(assignToObj).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
