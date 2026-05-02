import { useState, useCallback, useEffect } from 'react';
import { db } from '../db';

export function useTags() {
  const [tags, setTags] = useState({ phase: [], category: [], situation: [] });

  const loadTags = useCallback(async () => {
    const all = await db.tags.toArray();
    const grouped = { phase: [], category: [], situation: [] };
    all.forEach(t => {
      if (grouped[t.type]) grouped[t.type].push(t.name);
    });
    setTags(grouped);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTags();
  }, [loadTags]);

  const addTag = useCallback(async (type, name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const exists = await db.tags.where({ type, name: trimmed }).first();
    if (!exists) {
      await db.tags.add({ type, name: trimmed });
      setTags(prev => ({ ...prev, [type]: [...prev[type], trimmed] }));
    }
    return trimmed;
  }, []);

  const deleteTag = useCallback(async (type, name) => {
    const tag = await db.tags.where({ type, name }).first();
    if (tag) {
      await db.tags.delete(tag.id);
      setTags(prev => ({ ...prev, [type]: prev[type].filter(t => t !== name) }));
    }
  }, []);

  return { tags, loadTags, addTag, deleteTag };
}
