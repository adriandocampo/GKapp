import Dexie from 'dexie';

export const db = new Dexie('GKAppDBv2');

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

export async function initDatabase() {
  const count = await db.tasks.count();
  if (count === 0) {
    await seedDatabase();
  }
  await ensureDefaultSettings();
  await cleanupOrphanTags();
  localStorage.removeItem('shapePresets');
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
  const usedPhases = new Set(tasks.map(t => t.phase).filter(Boolean));
  const usedCategories = new Set(tasks.map(t => t.category).filter(Boolean));
  const usedSituations = new Set(tasks.map(t => t.situation).filter(Boolean));

  const tags = await db.tags.toArray();
  for (const tag of tags) {
    const usedSet = tag.type === 'phase' ? usedPhases : tag.type === 'category' ? usedCategories : tag.type === 'situation' ? usedSituations : null;
    if (usedSet && !usedSet.has(tag.name)) {
      await db.tags.delete(tag.id);
    }
  }
}

async function ensureDefaultSettings() {
  const count = await db.settings.count();
  if (count === 0) {
    const defaultPorteros = [
      { name: 'MARC', active: true },
      { name: 'IKER', active: true },
      { name: 'CANDAL', active: true },
    ];
    await db.settings.add({ key: 'teamName', value: 'Club Deportivo Lugo' });
    await db.settings.add({ key: 'teamCrest', value: null });
    await db.settings.add({ key: 'secondaryImage', value: null });
    await db.settings.add({ key: 'defaultPorteros', value: defaultPorteros });
  }
}

async function seedDatabase() {
  try {
    const base = import.meta.env.BASE_URL ?? './';
    const response = await fetch(`${base}seed_data.json`);
    if (!response.ok) throw new Error('Failed to load seed data');
    const tasks = await response.json();

    const VALID_PHASES = ['Activación', 'Parte Principal'];
    const VALID_CATEGORIES = ['Agarres', 'Desvíos', '1c1', 'Coberturas', 'Juego ofensivo', 'Velocidad de reacción'];
    const VALID_SITUATIONS = ['Centro lateral', 'Centro lateral cercano', 'Tiro cercano', 'Tiro lejano'];

    for (const task of tasks) {
      if (task.imagePath && task.imagePath.startsWith('/')) task.imagePath = task.imagePath.substring(1);
      if (task.videoPath && task.videoPath.startsWith('/')) task.videoPath = task.videoPath.substring(1);

      if (VALID_SITUATIONS.includes(task.category)) {
        task.situation = task.category;
        task.category = 'Otro';
      }

      if (!VALID_PHASES.includes(task.phase)) task.phase = 'Activación';
      if (!VALID_CATEGORIES.includes(task.category)) task.category = 'Otro';
      if (!VALID_SITUATIONS.includes(task.situation)) task.situation = 'Otro';
      await db.tasks.add(task);
    }

    const phases = [...new Set(tasks.map(t => t.phase).filter(Boolean))];
    const categories = [...new Set(tasks.map(t => t.category).filter(Boolean))];
    const situations = [...new Set(tasks.map(t => t.situation).filter(Boolean))];

    for (const name of phases) {
      if (name && name !== 'Otro') {
        const exists = await db.tags.where({ type: 'phase', name }).first();
        if (!exists) await db.tags.add({ type: 'phase', name });
      }
    }
    for (const name of categories) {
      if (name && name !== 'Otro') {
        const exists = await db.tags.where({ type: 'category', name }).first();
        if (!exists) await db.tags.add({ type: 'category', name });
      }
    }
    for (const name of situations) {
      if (name && name !== 'Otro') {
        const exists = await db.tags.where({ type: 'situation', name }).first();
        if (!exists) await db.tags.add({ type: 'situation', name });
      }
    }
  } catch (err) {
    console.error('Seed database error:', err);
  }
}
