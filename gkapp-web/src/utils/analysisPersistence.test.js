import { describe, expect, it } from 'vitest';
import { createAnalysisPersistence } from './analysisPersistence';

function createMemoryAdapter() {
  const records = new Map();
  let nextId = 1;
  return {
    records,
    async get(id) { return records.get(id); },
    async add(record) {
      const id = nextId++;
      records.set(id, { ...record, id });
      return id;
    },
    async put(record) { records.set(record.id, record); },
  };
}

describe('analysis persistence', () => {
  it('creates, reopens and updates the same analysis record', async () => {
    const adapter = createMemoryAdapter();
    const persistence = createAnalysisPersistence(adapter);
    const id = await persistence.create({ rpe: 5, matchName: 'Inicial' });

    await persistence.update(id, { rpe: 8, matchName: 'Actualizado', opponent: 'Rival' });

    expect(adapter.records.size).toBe(1);
    expect(adapter.records.get(id)).toMatchObject({ id, rpe: 8, matchName: 'Actualizado', opponent: 'Rival' });
  });

  it('rejects an update when the analysis ID does not exist', async () => {
    const adapter = createMemoryAdapter();
    const persistence = createAnalysisPersistence(adapter);

    await expect(persistence.update(99, { rpe: 8 })).rejects.toThrow('Analysis 99 not found');
  });

  it('serializes consecutive updates without losing the latest fields', async () => {
    const adapter = createMemoryAdapter();
    const persistence = createAnalysisPersistence(adapter);
    const id = await persistence.create({ rpe: 5, matchName: 'Inicial' });

    await Promise.all([
      persistence.update(id, { rpe: 7 }),
      persistence.update(id, { matchName: 'Nuevo partido' }),
    ]);

    expect(adapter.records.get(id)).toMatchObject({ id, rpe: 7, matchName: 'Nuevo partido' });
  });
});
