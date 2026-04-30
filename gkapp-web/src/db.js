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

export async function initDatabase() {
  const count = await db.tasks.count();
  if (count === 0) {
    await seedDatabase();
  }
}

async function seedDatabase() {
  try {
    const res = await fetch('/seed_data.json');
    const data = await res.json();
    
    for (const task of data) {
      await db.tasks.add({
        ...task,
        imagePath: `/images/tasks/pagina_${String(task.pageNumber).padStart(3, '0')}.png`,
        imageBlob: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    
    const phases = [...new Set(data.map(t => t.phase))];
    const categories = [...new Set(data.map(t => t.category))];
    const situations = [...new Set(data.map(t => t.situation))];
    
    for (const name of phases) {
      if (name && name !== 'Otro') await db.tags.add({ type: 'phase', name });
    }
    for (const name of categories) {
      if (name && name !== 'Otro') await db.tags.add({ type: 'category', name });
    }
    for (const name of situations) {
      if (name && name !== 'Otro') await db.tags.add({ type: 'situation', name });
    }
    
    console.log('Database seeded successfully');
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}
