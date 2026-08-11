export function createAnalysisPersistence(adapter) {
  let pending = Promise.resolve();

  function update(id, changes) {
    const operation = pending.then(async () => {
      const current = await adapter.get(id);
      if (!current) {
        throw new Error(`Analysis ${String(id)} not found`);
      }
      const updated = { ...current, ...changes, id, updatedAt: new Date() };
      await adapter.put(updated);
      return updated;
    });

    pending = operation.catch(() => {});
    return operation;
  }

  async function create(record) {
    return adapter.add(record);
  }

  return { create, update };
}
