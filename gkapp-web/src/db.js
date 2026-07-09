import Dexie from 'dexie';
import { getTimestampMs } from './utils/date.js';

export const db = new Dexie('GKAppDBv2');

// ─── Seed data cache (avoids double fetch) ──────────────────────────────────

let cachedSeedData = null;
let cachedSeedFetch = null;

async function fetchSeedData() {
  if (cachedSeedData) return cachedSeedData;
  if (cachedSeedFetch) return cachedSeedFetch;

  cachedSeedFetch = (async () => {
    const base = import.meta.env.BASE_URL ?? './';
    const response = await fetch(`${base}seed_data.json`);
    if (!response.ok) throw new Error('Failed to load seed data');
    cachedSeedData = await response.json();
    return cachedSeedData;
  })();

  return cachedSeedFetch;
}

// ─── Schema migrations ──────────────────────────────────────────────────────

db.version(2).stores({
  tasks: '++id, pageNumber, phase, category, situation, title',
  sessions: '++id, name, date, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date'
});

db.version(3).stores({
  sessions: '++id, name, date, createdAt',
}).upgrade(trans => {
  return trans.table('sessions').toCollection().modify(session => {
    if (!session.templateFields) {
      session.templateFields = {};
    }
  });
});

db.version(4).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
}).upgrade(async trans => {
  await trans.table('tasks').toCollection().modify(task => {
    if (task.rating === undefined) task.rating = 0;
    if (task.usageCount === undefined) task.usageCount = 0;
    if (task.lastUsedDate === undefined) task.lastUsedDate = null;
  });

  await trans.table('sessions').toCollection().modify(session => {
    if (!session.seasonId) session.seasonId = null;
  });

  const seasons = await trans.table('seasons').toArray();
  if (seasons.length === 0) {
    await trans.table('seasons').add({ name: '2025-26', createdAt: new Date() });
  }

  const agarreTitles = [
    'AGARRES CON CAÍDA CON RIESGO (PP)',
    'AGARRE + AGARRE AÉREO (BÁSICO)',
    'AGARRE + AGARRE AÉREO (AVANZADO)',
    'CAÍDA + AGARRE AÉREO + REMATE',
    'SIT. AGARRE AÉREO + DESPLAZAMIENTOS',
    'SIT. PASE ATRÁS - AGARRE AÉREO',
    'AGARRE AÉREO - REUBICACIÓN (DOMINIO)',
    'TIRO CERCANO - CERCANO DIAGONAL (AGARRES)',
    'AGARRES CON CAÍDA CON RIESGO (PP2)',
  ];

  await trans.table('tasks').toCollection().modify(task => {
    if (task.category === 'Desvíos' && agarreTitles.includes(task.title)) {
      task.category = 'Agarres';
      task.situation = 'Otro';
    }
  });

  const tasks = await trans.table('tasks').toArray();
  const phases = [...new Set(tasks.map(t => t.phase).filter(Boolean))];
  const categories = [...new Set(tasks.map(t => t.category).filter(Boolean))];
  const situations = [...new Set(tasks.map(t => t.situation).filter(Boolean))];

  const existingTags = await trans.table('tags').toArray();
  const existingNames = new Set(existingTags.map(t => `${t.type}:${t.name}`));

  for (const name of phases) {
    if (name && name !== 'Otro' && !existingNames.has(`phase:${name}`)) {
      await trans.table('tags').add({ type: 'phase', name });
    }
  }
  for (const name of categories) {
    if (name && name !== 'Otro' && !existingNames.has(`category:${name}`)) {
      await trans.table('tags').add({ type: 'category', name });
    }
  }
  for (const name of situations) {
    if (name && name !== 'Otro' && !existingNames.has(`situation:${name}`)) {
      await trans.table('tags').add({ type: 'situation', name });
    }
  }
});

db.version(5).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
}).upgrade(async trans => {
  const SITUATION_TO_CATEGORY = ['1c1', 'Coberturas', 'Juego ofensivo', 'Velocidad de reacción'];
  const VALID_SITUATIONS = ['Centro lateral', 'Centro lateral cercano', 'Tiro cercano', 'Tiro lejano'];
  const VALID_CATEGORIES = ['Agarres', 'Desvíos', '1c1', 'Coberturas', 'Juego ofensivo', 'Velocidad de reacción'];
  const VALID_PHASES = ['Activación', 'Parte principal'];
  const CATEGORIES_WITH_SITUATION = ['Agarres', 'Desvíos'];

  await trans.table('tasks').toCollection().modify(task => {
    if (SITUATION_TO_CATEGORY.includes(task.situation)) {
      task.category = task.situation;
      task.situation = '';
    }
    if (!CATEGORIES_WITH_SITUATION.includes(task.category)) {
      task.situation = '';
    }
  });

  await trans.table('tags').toCollection().modify(tag => {
    if (tag.type === 'situation' && SITUATION_TO_CATEGORY.includes(tag.name)) {
      tag.type = 'category';
    }
  });

  const existingTags = await trans.table('tags').toArray();
  const existingNames = new Set(existingTags.map(t => `${t.type}:${t.name}`));

  for (const name of VALID_PHASES) {
    if (!existingNames.has(`phase:${name}`)) {
      await trans.table('tags').add({ type: 'phase', name });
    }
  }
  for (const name of VALID_CATEGORIES) {
    if (!existingNames.has(`category:${name}`)) {
      await trans.table('tags').add({ type: 'category', name });
    }
  }
  for (const name of VALID_SITUATIONS) {
    if (!existingNames.has(`situation:${name}`)) {
      await trans.table('tags').add({ type: 'situation', name });
    }
  }
});

db.version(6).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  const defaultPorteros = [
    { name: 'MARC', active: true },
    { name: 'IKER', active: true },
    { name: 'CANDAL', active: true },
  ];
  await trans.table('settings').add({ key: 'teamName', value: 'Club Deportivo Lugo' });
  await trans.table('settings').add({ key: 'teamCrest', value: null });
  await trans.table('settings').add({ key: 'secondaryImage', value: null });
  await trans.table('settings').add({ key: 'defaultPorteros', value: defaultPorteros });
});

db.version(7).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  await trans.table('tasks').toCollection().modify(task => {
    if (task.imageElements === undefined) task.imageElements = null;
  });
});

db.version(8).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  await trans.table('sessions').toCollection().modify(session => {
    if (session.valoracionGeneral === undefined) session.valoracionGeneral = 0;
    if (session.feedbackGeneral === undefined) session.feedbackGeneral = '';
    if (session.rpePorteros === undefined) session.rpePorteros = {};
  });
});

db.version(9).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  await trans.table('tasks').toCollection().modify(task => {
    if (task.videoBlob === undefined) task.videoBlob = null;
    if (task.videoPath === undefined) task.videoPath = null;
  });
});

db.version(10).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  await trans.table('sessions').toCollection().modify(session => {
    if (session.videoPath === undefined) session.videoPath = null;
  });
});

db.version(11).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  await trans.table('sessions').toCollection().modify(session => {
    if (session.videoBlob === undefined) session.videoBlob = null;
  });
});

db.version(12).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  await trans.table('tasks').toCollection().modify(task => {
    if (task.imagePath && task.imagePath.endsWith('.png')) {
      task.imagePath = task.imagePath.replace(/\.png$/i, '.webp');
    }
  });
});

db.version(13).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  const orphanSessions = await trans.table('sessions').filter(s => !s.seasonId).toArray();
  if (orphanSessions.length === 0) return;

  const affectedTaskIds = new Set();
  for (const session of orphanSessions) {
    for (const tid of (session.tasks || [])) {
      affectedTaskIds.add(tid);
    }
    await trans.table('sessions').delete(session.id);
    await trans.table('taskHistory').where('sessionId').equals(session.id).delete();
  }

  for (const taskId of affectedTaskIds) {
    const remainingHistory = await trans.table('taskHistory').where('taskId').equals(taskId).toArray();
    if (remainingHistory.length === 0) {
      await trans.table('tasks').update(taskId, { usageCount: 0, lastUsedDate: null });
    } else {
      let lastDate = null;
      for (const h of remainingHistory) {
        if (!lastDate || h.date > lastDate) {
          lastDate = h.date;
        }
      }
      await trans.table('tasks').update(taskId, { usageCount: remainingHistory.length, lastUsedDate: lastDate });
    }
  }
});

db.version(14).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  const VALID_SITUATIONS = ['Centro lateral', 'Centro lateral cercano', 'Tiro cercano', 'Tiro lejano'];
  
  await trans.table('tasks').toCollection().modify(task => {
    if (task.imagePath && task.imagePath.startsWith('/')) {
      task.imagePath = task.imagePath.substring(1);
    }
    if (task.videoPath && task.videoPath.startsWith('/')) {
      task.videoPath = task.videoPath.substring(1);
    }
    
    if (VALID_SITUATIONS.includes(task.category)) {
      task.situation = task.category;
      task.category = 'Otro';
    }
  });

  const existingTags = await trans.table('tags').toArray();
  const existingNames = new Set(existingTags.map(t => `${t.type}:${t.name}`));
  
  for (const name of VALID_SITUATIONS) {
    if (!existingNames.has(`situation:${name}`)) {
      await trans.table('tags').add({ type: 'situation', name });
    }
  }
});

// Version 15 — Add YouTube video support fields
db.version(15).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt',
  sessions: '++id, name, date, createdAt, seasonId',
  seasons: '++id, name, createdAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  await trans.table('tasks').toCollection().modify(task => {
    // videoType: 'local' | 'youtube' | 'none'
    if (task.videoType === undefined) {
      task.videoType = (task.videoBlob || task.videoPath) ? 'local' : 'none';
    }
    if (task.youtubeUrl === undefined) task.youtubeUrl = null;
  });
  await trans.table('sessions').toCollection().modify(session => {
    if (session.videoType === undefined) {
      session.videoType = session.videoBlob ? 'local' : 'none';
    }
    if (session.youtubeUrl === undefined) session.youtubeUrl = null;
  });
});

// Version 16 — Soft delete support (retain deleted items for 4 days)
db.version(16).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  await trans.table('tasks').toCollection().modify(task => {
    if (task.deletedAt === undefined) task.deletedAt = null;
  });
  await trans.table('sessions').toCollection().modify(session => {
    if (session.deletedAt === undefined) session.deletedAt = null;
  });
  await trans.table('seasons').toCollection().modify(season => {
    if (season.deletedAt === undefined) season.deletedAt = null;
  });
});

// Version 17 — Add updatedAt for bidirectional sync & extend retention to 7 days
db.version(17).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
}).upgrade(async trans => {
  await trans.table('tasks').toCollection().modify(task => {
    if (task.updatedAt === undefined) task.updatedAt = task.createdAt || new Date();
  });
  await trans.table('sessions').toCollection().modify(session => {
    if (session.updatedAt === undefined) session.updatedAt = session.createdAt || new Date();
  });
  await trans.table('seasons').toCollection().modify(season => {
    if (season.updatedAt === undefined) season.updatedAt = season.createdAt || new Date();
  });
});

// Version 18 — Add syncQueue for offline write persistence
db.version(18).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
  syncQueue: '++id, operation, table, docId, attempts, nextRetryAt',
});

// Version 19 — situation as array (multi-situation support) + seedId
db.version(19).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
  syncQueue: '++id, operation, table, docId, attempts, nextRetryAt',
}).upgrade(async trans => {
  await trans.table('tasks').toCollection().modify(task => {
    if (typeof task.situation === 'string') {
      if (task.situation === '' || task.situation === 'Otro') {
        task.situation = [];
      } else {
        task.situation = [task.situation];
      }
    }
    if (task.seedId === undefined) task.seedId = null;
  });
});

// Version 20 — Ensure defaultAttributes has valid dimensions
db.version(20).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
  syncQueue: '++id, operation, table, docId, attempts, nextRetryAt',
}).upgrade(async trans => {
  const defaultAttributes = {
    dimensions: [
      {
        name: 'Defensa de Portería',
        microItems: [
          { name: 'Parada en portería', value: 70 },
          { name: '1 contra 1', value: 70 },
          { name: 'Velocidad de reacción', value: 70 },
          { name: 'Impulso', value: 70 },
        ],
      },
      {
        name: 'Defensa de Espacio',
        microItems: [
          { name: 'Altura en relación a línea defensiva', value: 70 },
          { name: 'Juego aéreo', value: 70 },
          { name: 'Coberturas', value: 70 },
        ],
      },
      {
        name: 'Juego Ofensivo',
        microItems: [
          { name: 'Continuidad', value: 70 },
          { name: 'Reinicios', value: 70 },
          { name: 'Saque de volea', value: 70 },
          { name: 'Saque de mano', value: 70 },
        ],
      },
      {
        name: 'Perfil Psicológico',
        microItems: [
          { name: 'Liderazgo', value: 70 },
          { name: 'Compostura', value: 70 },
          { name: 'Asertividad', value: 70 },
        ],
      },
    ],
  };

  const settingsRows = await trans.table('settings').toArray();
  const existing = settingsRows.find(s => s.key === 'defaultAttributes');

  const now = new Date();
  if (!existing) {
    await trans.table('settings').add({ key: 'defaultAttributes', value: defaultAttributes, updatedAt: now });
  } else {
    const val = existing.value || {};
    const dims = val.dimensions;
    if (!Array.isArray(dims) || dims.length === 0) {
      await trans.table('settings').update(existing.id, { value: defaultAttributes, updatedAt: now });
    }
  }
});

const RETENTION_DAYS = 7;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export async function cleanupDeletedItems() {
  try {
    const cutoff = Date.now() - RETENTION_MS;
    let totalCleaned = 0;
    const affectedTaskIds = new Set();

    // Purge old deleted sessions (and their taskHistory)
    const allSessions = await db.sessions.toArray();
    const sessionsToDelete = allSessions.filter(s => getTimestampMs(s.deletedAt) > 0 && getTimestampMs(s.deletedAt) < cutoff);
    for (const session of sessionsToDelete) {
      for (const tid of (session.tasks || [])) {
        affectedTaskIds.add(tid);
      }
      await db.sessions.delete(session.id);
      await db.taskHistory.where('sessionId').equals(session.id).delete();
      totalCleaned++;
    }

    // Purge old deleted tasks (and their taskHistory)
    const allTasks = await db.tasks.toArray();
    const tasksToDelete = allTasks.filter(t => getTimestampMs(t.deletedAt) > 0 && getTimestampMs(t.deletedAt) < cutoff);
    for (const task of tasksToDelete) {
      await db.tasks.delete(task.id);
      await db.taskHistory.where('taskId').equals(task.id).delete();
      affectedTaskIds.delete(task.id);
      totalCleaned++;
    }

    // Purge old deleted seasons
    const allSeasons = await db.seasons.toArray();
    const seasonsToDelete = allSeasons.filter(s => getTimestampMs(s.deletedAt) > 0 && getTimestampMs(s.deletedAt) < cutoff);
    for (const season of seasonsToDelete) {
      await db.seasons.delete(season.id);
      totalCleaned++;
    }

    // Recalculate usage counts for affected tasks
    for (const taskId of affectedTaskIds) {
      const remainingHistory = await db.taskHistory.where('taskId').equals(taskId).toArray();
      if (remainingHistory.length === 0) {
        await db.tasks.update(taskId, { usageCount: 0, lastUsedDate: null, updatedAt: new Date() });
      } else {
        let lastDate = null;
        for (const h of remainingHistory) {
          if (!lastDate || h.date > lastDate) {
            lastDate = h.date;
          }
        }
        await db.tasks.update(taskId, { usageCount: remainingHistory.length, lastUsedDate: lastDate, updatedAt: new Date() });
      }
    }

    if (totalCleaned > 0) {
      console.log(`[db] Cleaned up ${totalCleaned} old deleted items`);
    }
  } catch (err) {
    console.warn('[db] Error cleaning up deleted items:', err);
  }
}

const DEFAULT_PHASES = ['Activación', 'Parte Principal'];
const DEFAULT_CATEGORIES = ['Agarres', 'Desvíos', '1c1', 'Coberturas', 'Juego ofensivo', 'Velocidad de reacción'];
const DEFAULT_SITUATIONS = ['Centro lateral', 'Centro lateral cercano', 'Tiro cercano', 'Tiro lejano'];
const DEFAULT_DIMENSIONS = ['Defensa de portería', 'Defensa de espacio', 'Juego ofensivo'];
const DEFAULT_TAG_NAMES = new Set([...DEFAULT_PHASES, ...DEFAULT_CATEGORIES, ...DEFAULT_SITUATIONS, ...DEFAULT_DIMENSIONS]);

export async function initDatabase() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const granted = await navigator.storage.persist();
      console.log('[db] Storage persist:', granted ? 'granted' : 'denied');
    } catch (err) {
      console.warn('[db] navigator.storage.persist() failed:', err);
    }
  }

  const count = await db.tasks.count();
  if (count === 0) {
    await ensureSeedTasks();
  } else {
    // Merge seed tasks into existing DB and remove duplicates caused by
    // previous versions that created new copies with numeric IDs.
    await ensureSeedTasks();
    await deduplicateSeedTasks();
  }
  await ensureDefaultSettings();
  await ensureDefaultTags();
  await cleanupOrphanTags();
  await cleanupDeletedItems();
}

export async function getSetting(key) {
  const entry = await db.settings.where('key').equals(key).first();
  return entry ? entry.value : null;
}

export async function setSetting(key, value) {
  const entry = await db.settings.where('key').equals(key).first();
  if (entry) {
    await db.settings.update(entry.id, { value });
  } else {
    await db.settings.add({ key, value });
  }
}

export async function cleanupOrphanTags() {
  const tasks = await db.tasks.toArray();
  const activeTasks = tasks.filter(t => !t.deletedAt);
  const usedPhases = new Set(activeTasks.map(t => t.phase).filter(Boolean));
  const usedCategories = new Set(activeTasks.flatMap(t => Array.isArray(t.category) ? t.category : (t.category ? [t.category] : [])).filter(Boolean));
  const usedSituations = new Set(activeTasks.flatMap(t => Array.isArray(t.situation) ? t.situation : (t.situation ? [t.situation] : [])).filter(Boolean));
  const usedDimensions = new Set(activeTasks.flatMap(t => Array.isArray(t.dimension) ? t.dimension : (t.dimension ? [t.dimension] : [])).filter(Boolean));

  const tags = await db.tags.toArray();
  for (const tag of tags) {
    // Never delete default (standard) tags even if no task currently uses them
    if (DEFAULT_TAG_NAMES.has(tag.name)) continue;

    const usedSet = tag.type === 'phase' ? usedPhases : tag.type === 'category' ? usedCategories : tag.type === 'situation' ? usedSituations : tag.type === 'dimension' ? usedDimensions : null;
    if (usedSet && !usedSet.has(tag.name)) {
      await db.tags.delete(tag.id);
    }
  }
}

export async function ensureDefaultTags() {
  const existing = await db.tags.toArray();
  const existingSet = new Set(existing.map(t => `${t.type}:${t.name}`));

  for (const name of DEFAULT_PHASES) {
    if (!existingSet.has(`phase:${name}`)) {
      await db.tags.add({ type: 'phase', name });
    }
  }
  for (const name of DEFAULT_CATEGORIES) {
    if (!existingSet.has(`category:${name}`)) {
      await db.tags.add({ type: 'category', name });
    }
  }
  for (const name of DEFAULT_SITUATIONS) {
    if (!existingSet.has(`situation:${name}`)) {
      await db.tags.add({ type: 'situation', name });
    }
  }
  for (const name of DEFAULT_DIMENSIONS) {
    if (!existingSet.has(`dimension:${name}`)) {
      await db.tags.add({ type: 'dimension', name });
    }
  }
}

async function ensureDefaultSettings() {
  const count = await db.settings.count();
  const defaultAttributes = {
    dimensions: [
      {
        name: 'Defensa de Portería',
        microItems: [
          { name: 'Parada en portería', value: 70 },
          { name: '1 contra 1', value: 70 },
          { name: 'Velocidad de reacción', value: 70 },
          { name: 'Impulso', value: 70 },
        ],
      },
      {
        name: 'Defensa de Espacio',
        microItems: [
          { name: 'Altura en relación a línea defensiva', value: 70 },
          { name: 'Juego aéreo', value: 70 },
          { name: 'Coberturas', value: 70 },
        ],
      },
      {
        name: 'Juego Ofensivo',
        microItems: [
          { name: 'Continuidad', value: 70 },
          { name: 'Reinicios', value: 70 },
          { name: 'Saque de volea', value: 70 },
          { name: 'Saque de mano', value: 70 },
        ],
      },
      {
        name: 'Perfil Psicológico',
        microItems: [
          { name: 'Liderazgo', value: 70 },
          { name: 'Compostura', value: 70 },
          { name: 'Asertividad', value: 70 },
        ],
      },
    ],
  };
  if (count === 0) {
    const defaultPorteros = [
      { name: 'MARC', active: true, photo: null },
      { name: 'IKER', active: true, photo: null },
      { name: 'CANDAL', active: true, photo: null },
    ];
    await db.settings.add({ key: 'teamName', value: 'Club Deportivo Lugo' });
    await db.settings.add({ key: 'teamCrest', value: null });
    await db.settings.add({ key: 'secondaryImage', value: null });
    await db.settings.add({ key: 'defaultPorteros', value: defaultPorteros });
    await db.settings.add({ key: 'defaultAttributes', value: defaultAttributes });
  } else {
    const existing = await db.settings.where('key').equals('defaultAttributes').first();
    if (!existing) {
      await db.settings.add({ key: 'defaultAttributes', value: defaultAttributes });
    }
  }
  const existingColor = await db.settings.where('key').equals('corporateColor').first();
  if (!existingColor) {
    await db.settings.add({ key: 'corporateColor', value: '#dc2626' });
  }

}

export async function ensureSeedTasks() {
  try {
    const tasks = await fetchSeedData();

    const VALID_PHASES = ['Activación', 'Parte Principal'];
    const VALID_CATEGORIES = ['Agarres', 'Desvíos', '1c1', 'Coberturas', 'Juego ofensivo', 'Velocidad de reacción'];
    const VALID_SITUATIONS = ['Centro lateral', 'Centro lateral cercano', 'Tiro cercano', 'Tiro lejano'];

    const localTasks = await db.tasks.toArray();

    // Build lookup maps
    const localBySeedId = new Map();
    const localByTitle = new Map();
    for (const t of localTasks) {
      if (t.seedId) localBySeedId.set(t.seedId, t);
      localByTitle.set(`${t.pageNumber}:${t.title}`, t);
    }

    // Track which seedIds were processed (for cleanup of removed seed tasks later)
    const processedIds = new Set();
    const toAdd = [];

    for (const task of tasks) {
      if (task.imagePath && task.imagePath.startsWith('/')) task.imagePath = task.imagePath.substring(1);
      if (task.videoPath && task.videoPath.startsWith('/')) task.videoPath = task.videoPath.substring(1);

      // Normalize situation and category to arrays
      if (!Array.isArray(task.situation)) {
        task.situation = task.situation ? [task.situation] : [];
      }
      task.situation = task.situation.filter(s => VALID_SITUATIONS.includes(s));

      if (!Array.isArray(task.category)) {
        task.category = task.category ? [task.category] : [];
      }
      task.category = task.category.filter(c => VALID_CATEGORIES.includes(c));

      if (!Array.isArray(task.dimension)) {
        task.dimension = task.dimension ? [task.dimension] : [];
      }

      if (!VALID_PHASES.includes(task.phase)) task.phase = 'Activación';
      task.createdAt = task.createdAt || new Date();
      task.updatedAt = task.updatedAt || task.createdAt;
      task.deletedAt = null;

      processedIds.add(task.seedId);

      // Match by seedId first, fallback to pageNumber:title
      let existing = task.seedId ? localBySeedId.get(task.seedId) : null;
      if (!existing) {
        existing = localByTitle.get(`${task.pageNumber}:${task.title}`);
      }

      if (!existing) {
        toAdd.push(task);
      } else if (!existing.seedId && task.seedId) {
        await db.tasks.update(existing.id, { seedId: task.seedId, updatedAt: new Date() });
      }
    }

    if (toAdd.length > 0) {
      await db.tasks.bulkAdd(toAdd);
      console.log(`[db] Added ${toAdd.length} seed tasks`);
    }
  } catch (err) {
    console.error('Ensure seed tasks error:', err);
  }
}

export async function deduplicateSeedTasks() {
  try {
    const seedTasks = await fetchSeedData();
    const seedById = new Map(seedTasks.filter(t => t.seedId).map(t => [t.seedId, t]));
    const seedByTitle = new Map(seedTasks.map(t => [`${t.pageNumber}:${t.title}`, t]));

    const allTasks = await db.tasks.toArray();

    // Group by seedId (preferred) or pageNumber:title (fallback)
    const groups = new Map();
    for (const task of allTasks) {
      let key = task.seedId ? `seed:${task.seedId}` : `title:${task.pageNumber}:${task.title}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(task);
    }

    let removed = 0;
    for (const [, tasks] of groups) {
      if (tasks.length <= 1) continue;

      // Prefer: not deleted > has real tags > most recently updated
      tasks.sort((a, b) => {
        const aDel = a.deletedAt ? 1 : 0;
        const bDel = b.deletedAt ? 1 : 0;
        if (aDel !== bDel) return aDel - bDel;

        const aGood = (Array.isArray(a.category) && a.category.some(c => c !== 'Otro')) || (Array.isArray(a.situation) && a.situation.length > 0) || (Array.isArray(a.dimension) && a.dimension.length > 0);
        const bGood = (Array.isArray(b.category) && b.category.some(c => c !== 'Otro')) || (Array.isArray(b.situation) && b.situation.length > 0) || (Array.isArray(b.dimension) && b.dimension.length > 0);
        if (aGood !== bGood) return bGood - aGood;

        return getTimestampMs(b.updatedAt) - getTimestampMs(a.updatedAt);
      });

      const keeper = tasks[0];
      const idsToDelete = [];
      for (let i = 1; i < tasks.length; i++) {
        idsToDelete.push(tasks[i].id);
        removed++;
      }
      if (idsToDelete.length > 0) {
        await db.tasks.bulkDelete(idsToDelete);
      }

      // Restore proper tags from seed if missing
      let seed = null;
      if (keeper.seedId) {
        seed = seedById.get(keeper.seedId);
      }
      if (!seed) {
        seed = seedByTitle.get(`${keeper.pageNumber}:${keeper.title}`);
      }
      if (seed) {
        const needsFix = !Array.isArray(keeper.category) || keeper.category.length === 0 || keeper.category.every(c => c === 'Otro') || !keeper.phase || keeper.phase === 'Otro'
          || !Array.isArray(keeper.situation) || keeper.situation.length === 0
          || !Array.isArray(keeper.dimension) || keeper.dimension.length === 0;
        if (needsFix) {
          await db.tasks.update(keeper.id, {
            phase: seed.phase,
            category: Array.isArray(seed.category) ? seed.category : (seed.category ? [seed.category] : []),
            situation: Array.isArray(seed.situation) ? seed.situation : [],
            dimension: Array.isArray(seed.dimension) ? seed.dimension : [],
            updatedAt: new Date(),
          });
        }
        if (!keeper.seedId && seed.seedId) {
          await db.tasks.update(keeper.id, { seedId: seed.seedId });
        }
      }
    }

    if (removed > 0) {
      console.log(`[db] Removed ${removed} duplicate seed tasks`);
    }
  } catch (err) {
    console.error('[db] Deduplicate seed tasks error:', err);
  }
}

// Version 20 — Add goalkeeper match analysis table
db.version(20).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
  syncQueue: '++id, operation, table, docId, attempts, nextRetryAt',
  analyses: '++id, goalkeeperName, opponent, date, seasonId, createdAt, deletedAt',
});

// Version 21 — Extend analyses for match library/editor workflow
db.version(21).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
  syncQueue: '++id, operation, table, docId, attempts, nextRetryAt',
  analyses: '++id, [seasonId+xmlFileName], seasonId, xmlFileName, matchName, goalkeeperName, opponent, date, jornadaNumber, createdAt, deletedAt',
});

// Version 22 — Add clipRatings and clipCustomizations to analyses
db.version(22).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
  syncQueue: '++id, operation, table, docId, attempts, nextRetryAt',
  analyses: '++id, [seasonId+xmlFileName], seasonId, xmlFileName, matchName, goalkeeperName, opponent, date, jornadaNumber, createdAt, deletedAt',
}).upgrade(async trans => {
  await trans.table('analyses').toCollection().modify(a => {
    if (a.clipRatings === undefined) a.clipRatings = {};
    if (a.clipCustomizations === undefined) a.clipCustomizations = {};
    if (a.microciclo === undefined) a.microciclo = null;
  });
});

// Version 23 — Infer videoType/videoSource for analyses with videoPath but missing type
db.version(23).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
  syncQueue: '++id, operation, table, docId, attempts, nextRetryAt',
  analyses: '++id, [seasonId+xmlFileName], seasonId, xmlFileName, matchName, goalkeeperName, opponent, date, jornadaNumber, createdAt, deletedAt',
}).upgrade(async trans => {
  await trans.table('analyses').toCollection().modify(a => {
    if (!a.videoType && !a.videoSource && a.videoPath) {
      a.videoType = 'local';
      a.videoSource = 'local';
    }
    if (!a.videoType && !a.videoSource && a.youtubeUrl) {
      a.videoType = 'veo';
      a.videoSource = 'veo';
    }
  });
});

// Version 24 — Version-marker legacy clipCustomizations
// Iterates over existing analyses and marks legacy clipCustomizations
// entries that do NOT have a `_v` field with `_v: 1` so future code
// can distinguish the legacy format from the new v2 format.
db.version(24).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
  syncQueue: '++id, operation, table, docId, attempts, nextRetryAt',
  analyses: '++id, [seasonId+xmlFileName], seasonId, xmlFileName, matchName, goalkeeperName, opponent, date, jornadaNumber, createdAt, deletedAt',
}).upgrade(async trans => {
  await trans.table('analyses').toCollection().modify(a => {
    if (a.clipCustomizations && typeof a.clipCustomizations === 'object' && !Array.isArray(a.clipCustomizations)) {
      for (const eventId of Object.keys(a.clipCustomizations)) {
        const entry = a.clipCustomizations[eventId];
        if (entry && typeof entry === 'object' && !Array.isArray(entry) && !('_v' in entry)) {
          entry._v = 1;
        }
      }
    }
  });
});

// Version 25 — Add SofaScore match URL and data support
db.version(25).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
  syncQueue: '++id, operation, table, docId, attempts, nextRetryAt',
  analyses: '++id, [seasonId+xmlFileName], seasonId, xmlFileName, matchName, goalkeeperName, opponent, date, jornadaNumber, createdAt, deletedAt, matchUrl',
}).upgrade(async trans => {
  await trans.table('analyses').toCollection().modify(a => {
    if (a.matchUrl === undefined) a.matchUrl = '';
    if (a.sofascoreData === undefined) a.sofascoreData = null;
  });
});

// Version 26 — Add porteros (goalkeeper profiles) table
db.version(26).stores({
  tasks: '++id, pageNumber, phase, category, situation, title, rating, createdAt, deletedAt',
  sessions: '++id, name, date, createdAt, seasonId, deletedAt',
  seasons: '++id, name, createdAt, deletedAt',
  tags: '++id, type, name',
  taskHistory: '++id, taskId, sessionId, sessionName, date',
  settings: '++id, key',
  syncQueue: '++id, operation, table, docId, attempts, nextRetryAt',
  analyses: '++id, [seasonId+xmlFileName], seasonId, xmlFileName, matchName, goalkeeperName, opponent, date, jornadaNumber, createdAt, deletedAt',
  porteros: '++id, name, slug, sofascoreId, isManual, createdAt',
}).upgrade(async trans => {
  const count = await trans.table('porteros').count();
  if (count === 0) {
    const defaultPorteros = [
      { name: 'MARC', slug: 'marc', isManual: true, team: 'CD Lugo', personalRating: 0, customAttributes: {
        dimensions: [
          { name: 'Defensa de Portería', microItems: [
            { name: 'Parada en portería', value: 70 }, { name: '1 contra 1', value: 70 },
            { name: 'Velocidad de reacción', value: 70 }, { name: 'Impulso', value: 70 },
          ]},
          { name: 'Defensa de Espacio', microItems: [
            { name: 'Altura en relación a línea defensiva', value: 70 },
            { name: 'Juego aéreo', value: 70 }, { name: 'Coberturas', value: 70 },
          ]},
          { name: 'Juego Ofensivo', microItems: [
            { name: 'Continuidad', value: 70 }, { name: 'Reinicios', value: 70 },
            { name: 'Saque de volea', value: 70 }, { name: 'Saque de mano', value: 70 },
          ]},
          { name: 'Perfil Psicológico', microItems: [
            { name: 'Liderazgo', value: 70 }, { name: 'Compostura', value: 70 },
            { name: 'Asertividad', value: 70 },
          ]},
        ],
      }, createdAt: new Date(), updatedAt: new Date() },
      { name: 'IKER', slug: 'iker', isManual: true, team: 'CD Lugo', personalRating: 0, customAttributes: {
        dimensions: [
          { name: 'Defensa de Portería', microItems: [
            { name: 'Parada en portería', value: 70 }, { name: '1 contra 1', value: 70 },
            { name: 'Velocidad de reacción', value: 70 }, { name: 'Impulso', value: 70 },
          ]},
          { name: 'Defensa de Espacio', microItems: [
            { name: 'Altura en relación a línea defensiva', value: 70 },
            { name: 'Juego aéreo', value: 70 }, { name: 'Coberturas', value: 70 },
          ]},
          { name: 'Juego Ofensivo', microItems: [
            { name: 'Continuidad', value: 70 }, { name: 'Reinicios', value: 70 },
            { name: 'Saque de volea', value: 70 }, { name: 'Saque de mano', value: 70 },
          ]},
          { name: 'Perfil Psicológico', microItems: [
            { name: 'Liderazgo', value: 70 }, { name: 'Compostura', value: 70 },
            { name: 'Asertividad', value: 70 },
          ]},
        ],
      }, createdAt: new Date(), updatedAt: new Date() },
      { name: 'CANDAL', slug: 'candal', isManual: true, team: 'CD Lugo', personalRating: 0, customAttributes: {
        dimensions: [
          { name: 'Defensa de Portería', microItems: [
            { name: 'Parada en portería', value: 70 }, { name: '1 contra 1', value: 70 },
            { name: 'Velocidad de reacción', value: 70 }, { name: 'Impulso', value: 70 },
          ]},
          { name: 'Defensa de Espacio', microItems: [
            { name: 'Altura en relación a línea defensiva', value: 70 },
            { name: 'Juego aéreo', value: 70 }, { name: 'Coberturas', value: 70 },
          ]},
          { name: 'Juego Ofensivo', microItems: [
            { name: 'Continuidad', value: 70 }, { name: 'Reinicios', value: 70 },
            { name: 'Saque de volea', value: 70 }, { name: 'Saque de mano', value: 70 },
          ]},
          { name: 'Perfil Psicológico', microItems: [
            { name: 'Liderazgo', value: 70 }, { name: 'Compostura', value: 70 },
            { name: 'Asertividad', value: 70 },
          ]},
        ],
      }, createdAt: new Date(), updatedAt: new Date() },
    ];
    await trans.table('porteros').bulkAdd(defaultPorteros);
  }
});

// Backwards compatibility alias
export const seedDatabase = ensureSeedTasks;
