import pako from 'pako';
import {
  collection, doc, getDocs, getDoc,
  setDoc, updateDoc, deleteDoc,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { firestore } from '../firebase';

const BACKUP_TIMEOUT_MS = 60000;
const TABLES = ['tasks', 'sessions', 'tags', 'seasons', 'taskHistory', 'settings', 'analyses', 'porteros'];

function userCol(uid, table) {
  return collection(firestore, 'users', uid, table);
}
function userDocRef(uid, table, id) {
  return doc(firestore, 'users', uid, table, String(id));
}

/** List all registered user profiles and discover users with data but no profile */
export async function listUserProfiles() {
  const profilesSnap = await getDocs(collection(firestore, 'userProfiles'));
  const profiles = new Map(profilesSnap.docs.map(d => [d.id, { uid: d.id, ...d.data() }]));

  // Discover UIDs that have data in Firestore sub-collections but no profile
  try {
    const usersSnap = await getDocs(collection(firestore, 'users'));
    for (const d of usersSnap.docs) {
      if (!profiles.has(d.id)) {
        profiles.set(d.id, { uid: d.id, email: null, displayName: 'Usuario sin perfil', photoURL: null });
      }
    }
  } catch (err) {
    console.warn('[admin] Error discovering users:', err);
  }

  return Array.from(profiles.values());
}

/** Get a single user profile */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(firestore, 'userProfiles', uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

/** Count documents per table for a user (quick metadata) */
export async function getUserDataCounts(uid) {
  const counts = {};
  for (const table of TABLES) {
    const snap = await getDocs(userCol(uid, table));
    if (table === 'tasks' || table === 'sessions' || table === 'seasons') {
      let active = 0, deleted = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if (data.deletedAt) deleted++;
        else active++;
      });
      counts[table] = active + deleted;
      counts[`${table}Active`] = active;
      counts[`${table}Deleted`] = deleted;
    } else {
      counts[table] = snap.size;
    }
  }
  return counts;
}

/** Convert Firestore Timestamps to JS Dates recursively */
function convertTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj.toDate && typeof obj.toDate === 'function') {
    return obj.toDate();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertTimestamps);
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = convertTimestamps(value);
  }
  return result;
}

/** Get all documents from one table for a user */
export async function getUserCollection(uid, table) {
  if (!TABLES.includes(table)) throw new Error('Invalid table: ' + table);
  const snap = await getDocs(userCol(uid, table));
  return snap.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) }));
}

/** Get a single document from a user's table */
export async function getUserDocument(uid, table, docId) {
  const snap = await getDoc(userDocRef(uid, table, docId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Update (or create) a document in a user's table */
export async function updateUserDocument(uid, table, docId, data) {
  const ref = userDocRef(uid, table, docId);
  const snap = await getDoc(ref);
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
}

/** Delete a single document from a user's table */
export async function deleteUserDocument(uid, table, docId) {
  await deleteDoc(userDocRef(uid, table, docId));
}

/** Export all user data as a JSON-friendly object */
export async function exportAllUserData(uid) {
  const payload = { uid, exportedAt: new Date().toISOString() };
  for (const table of TABLES) {
    payload[table] = await getUserCollection(uid, table);
  }
  return payload;
}

const SIZE_FIELDS = ['imageBase64', 'goalkeeperPhoto', 'rawXml', 'xmlData', 'sofascoreData'];

async function setDocWithRetry(ref, data) {
  try {
    await setDoc(ref, data, { merge: true });
  } catch (err) {
    if (err.message?.includes?.('exceeds the maximum allowed size')) {
      for (const field of SIZE_FIELDS) {
        if (field in data) {
          const { [field]: _, ...rest } = data;
          try {
            await setDoc(ref, rest, { merge: true });
            return;
          } catch (retryErr) {
            if (!retryErr.message?.includes?.('exceeds the maximum allowed size')) throw retryErr;
            data = rest;
          }
        }
      }
      throw err;
    }
    throw err;
  }
}

/** Import (restore) user data from a JSON object.
 *  WARNING: this OVERWRITES existing documents with matching IDs.
 */
export async function importAllUserData(uid, payload) {
  for (const table of TABLES) {
    const rows = payload[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const BATCH_SIZE = 450;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(firestore);
      for (const row of chunk) {
        const id = String(row.id);
        const ref = userDocRef(uid, table, id);
        const { id: _id, ...data } = row;
        batch.set(ref, data, { merge: true });
      }
      try {
        await batch.commit();
      } catch (err) {
        if (err.message?.includes?.('exceeds the maximum allowed size')) {
          for (const row of chunk) {
            const id = String(row.id);
            const ref = userDocRef(uid, table, id);
            const { id: _id, ...data } = row;
            await setDocWithRetry(ref, data);
          }
        } else {
          throw err;
        }
      }
    }
  }
}

/** Delete ALL data for a user (keeps the auth account) */
export async function purgeUserData(uid) {
  for (const table of TABLES) {
    const snap = await getDocs(userCol(uid, table));
    const BATCH_SIZE = 450;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestore);
      const chunk = docs.slice(i, i + BATCH_SIZE);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  }
  // Optionally remove user profile as well
  await deleteDoc(doc(firestore, 'userProfiles', uid));
}

// ─── Backup functions ────────────────────────────────────────────────────────

/** Get backup config for a user */
export async function getBackupConfig(uid) {
  const ref = doc(firestore, 'users', uid, 'backups', 'config');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/** Set backup config (admin toggle) */
export async function setBackupConfig(uid, config) {
  const ref = doc(firestore, 'users', uid, 'backups', 'config');
  await setDoc(ref, config, { merge: true });
}

/** Get the latest backup metadata (without data) */
export async function getBackup(uid) {
  const ref = doc(firestore, 'users', uid, 'backups', 'latest');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    _createdAt: data._createdAt,
    _size: data._size,
    _filename: data._filename,
  };
}

/** Check if user has any document updated since a given date */
export async function hasActivitySince(uid, sinceDate) {
  const since = sinceDate instanceof Date ? sinceDate : new Date(sinceDate);
  const TABLES_SCAN = ['tasks', 'sessions', 'seasons', 'settings', 'taskHistory', 'analyses', 'porteros'];

  for (const table of TABLES_SCAN) {
    const snap = await getDocs(userCol(uid, table));
    for (const d of snap.docs) {
      const data = d.data();
      if (data.deletedAt) continue;
      const updatedAt = data.updatedAt?.toDate?.() || data.updatedAt;
      if (updatedAt && new Date(updatedAt) > since) return true;
    }
  }
  return false;
}

/** Compress binary data to base64 string */
function binaryToBase64(bytes) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes]);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Error reading blob for base64'));
    reader.readAsDataURL(blob);
  });
}

/** Create a backup and push it to the GitHub backup repo via Cloudflare Worker */
export async function createBackup(uid, adminUid = null) {
  const label = `[backup ${uid.slice(0, 6)}]`;

  const withTimeout = (promise, step) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${step} excedió ${BACKUP_TIMEOUT_MS / 1000}s`)), BACKUP_TIMEOUT_MS)
      ),
    ]);

  try {
    console.time(`${label} exportAllUserData`);
    const data = await withTimeout(exportAllUserData(uid), 'exportAllUserData');
    console.timeEnd(`${label} exportAllUserData`);

    console.time(`${label} JSON.stringify`);
    const json = JSON.stringify(data);
    console.timeEnd(`${label} JSON.stringify`);

    console.time(`${label} pako.gzip (level 9)`);
    const encoder = new TextEncoder();
    const compressed = pako.gzip(encoder.encode(json), { level: 9 });
    console.timeEnd(`${label} pako.gzip (level 9)`);

    const KB = (compressed.length / 1024).toFixed(1);
    const totalTasks = data.tasks?.length || 0;
    const totalSessions = data.sessions?.length || 0;
    const totalAnalyses = data.analyses?.length || 0;
    console.log(`${label} Tamaño comprimido: ${KB} KB (${totalTasks} tareas, ${totalSessions} sesiones, ${totalAnalyses} análisis)`);

    console.time(`${label} base64 encode`);
    const backupBase64 = await binaryToBase64(compressed);
    console.timeEnd(`${label} base64 encode`);

    const workerUrl = import.meta.env.VITE_BACKUP_WORKER_URL;
    if (!workerUrl) {
      throw new Error('Backup Worker no configurado (VITE_BACKUP_WORKER_URL)');
    }

    const filename = `gkapp_backup_${uid}_${Date.now()}.json.gz`;

    console.time(`${label} Worker upload`);
    const res = await withTimeout(
      fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, filename, backupBase64 }),
      }),
      'Worker upload'
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Worker respondió ${res.status}: ${text.slice(0, 200)}`);
    }
    console.timeEnd(`${label} Worker upload`);

    // Save metadata to Firestore
    console.time(`${label} setDoc (metadatos)`);
    const metaRef = doc(firestore, 'users', uid, 'backups', 'latest');
    await withTimeout(
      setDoc(metaRef, {
        _createdAt: serverTimestamp(),
        _size: compressed.length,
        _filename: filename,
        _triggeredBy: adminUid || 'auto',
        _via: 'github',
      }),
      'setDoc'
    );
    console.timeEnd(`${label} setDoc (metadatos)`);

    console.log(`${label} Backup subido a GitHub (${KB} KB)`);
    return { size: compressed.length, filename };
  } catch (err) {
    console.error(`${label} Error:`, err.message);
    console.timeEnd(`${label} exportAllUserData`);
    console.timeEnd(`${label} JSON.stringify`);
    console.timeEnd(`${label} pako.gzip (level 9)`);
    console.timeEnd(`${label} base64 encode`);
    console.timeEnd(`${label} Worker upload`);
    console.timeEnd(`${label} setDoc (metadatos)`);
    throw err;
  }
}

/** Restore user data from a local backup file (.json or .json.gz) */
export async function restoreFromFile(uid, file, { force } = {}) {
  const buffer = await file.arrayBuffer();

  let data;
  const bytes = new Uint8Array(buffer.slice(0, 2));

  if (bytes[0] === 0x1F && bytes[1] === 0x8B) {
    const decompressed = pako.ungzip(new Uint8Array(buffer));
    data = JSON.parse(new TextDecoder().decode(decompressed));
  } else {
    data = JSON.parse(new TextDecoder().decode(buffer));
  }

  if (data.uid && data.uid !== uid && !force) {
    throw new Error(`El backup pertenece a ${data.uid}, no a ${uid}`);
  }

  await importAllUserData(uid, data);
  return true;
}

/** Restore all user data from the latest GitHub backup via Cloudflare Worker */
export async function restoreFromBackup(uid) {
  const metaRef = doc(firestore, 'users', uid, 'backups', 'latest');
  const metaSnap = await getDoc(metaRef);
  if (!metaSnap.exists()) throw new Error('No hay backup disponible');
  const meta = metaSnap.data();
  if (!meta._filename) throw new Error('No hay backup disponible');

  const workerUrl = import.meta.env.VITE_BACKUP_WORKER_URL;
  if (!workerUrl) throw new Error('Backup Worker no configurado');

  const response = await fetch(`${workerUrl}/backups/${uid}/${meta._filename}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Error descargando backup: ${response.status} ${text.slice(0, 200)}`);
  }
  const buffer = await response.arrayBuffer();
  const decompressed = pako.ungzip(new Uint8Array(buffer));
  const data = JSON.parse(new TextDecoder().decode(decompressed));

  const BATCH_SIZE = 450;

  for (const table of TABLES) {
    const rows = data[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    // Clear existing data in this table
    const existingSnap = await getDocs(userCol(uid, table));
    for (let i = 0; i < existingSnap.docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestore);
      const chunk = existingSnap.docs.slice(i, i + BATCH_SIZE);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }

    // Write backup data (excluding imageBase64 to stay within limits)
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestore);
      const chunk = rows.slice(i, i + BATCH_SIZE);
      for (const row of chunk) {
        const id = String(row.id);
        const ref = userDocRef(uid, table, id);
        const { id: _id, imageBase64, ...clean } = row;
        batch.set(ref, { ...clean, updatedAt: serverTimestamp() });
      }
      await batch.commit();
    }
  }

  // Touch backup config to mark restore happened
  const configRef = doc(firestore, 'users', uid, 'backups', 'config');
  await updateDoc(configRef, { lastRestoreAt: serverTimestamp() }).catch(() => {});

  return true;
}

const DEFAULT_PHASES = ['Activación', 'Parte Principal'];
const DEFAULT_CATEGORIES = ['Agarres', 'Desvíos', '1c1', 'Coberturas', 'Juego ofensivo', 'Velocidad de reacción'];
const DEFAULT_SITUATIONS = ['Centro lateral', 'Centro lateral cercano', 'Tiro cercano', 'Tiro lejano'];

/** Restore missing default tags for a user in Firestore */
export async function restoreDefaultTagsForUser(uid) {
  const snap = await getDocs(userCol(uid, 'tags'));
  const existingSet = new Set(snap.docs.map(d => `${d.data().type}:${d.data().name}`));

  let count = 0;
  for (const name of DEFAULT_PHASES) {
    if (!existingSet.has(`phase:${name}`)) {
      await setDoc(doc(firestore, 'users', uid, 'tags', `phase_${name}`), { type: 'phase', name });
      count++;
    }
  }
  for (const name of DEFAULT_CATEGORIES) {
    if (!existingSet.has(`category:${name}`)) {
      await setDoc(doc(firestore, 'users', uid, 'tags', `category_${name}`), { type: 'category', name });
      count++;
    }
  }
  for (const name of DEFAULT_SITUATIONS) {
    if (!existingSet.has(`situation:${name}`)) {
      await setDoc(doc(firestore, 'users', uid, 'tags', `situation_${name}`), { type: 'situation', name });
      count++;
    }
  }
  return count;
}

/** Restore default (seed) tasks for a user in Firestore.
 *  Uses merge:true so existing user data is preserved; only writes seedId + label fields.
 */
export async function restoreDefaultTasksForUser(uid) {
  const base = import.meta.env.BASE_URL ?? './';
  const response = await fetch(`${base}seed_data.json`);
  if (!response.ok) throw new Error('Failed to load seed_data.json');
  const tasks = await response.json();

  const BATCH_SIZE = 450;
  let totalRestored = 0;

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestore);
    const chunk = tasks.slice(i, i + BATCH_SIZE);
    let chunkCount = 0;

    for (const task of chunk) {
      const normalized = { ...task };
      if (normalized.imagePath && normalized.imagePath.startsWith('/')) normalized.imagePath = normalized.imagePath.substring(1);
      if (normalized.videoPath && normalized.videoPath.startsWith('/')) normalized.videoPath = normalized.videoPath.substring(1);

      normalized.createdAt = normalized.createdAt || new Date();
      normalized.updatedAt = normalized.updatedAt || normalized.createdAt;
      normalized.deletedAt = null;

      const ref = userDocRef(uid, 'tasks', normalized.id);
      batch.set(ref, normalized, { merge: true });
      chunkCount++;
    }

    if (chunkCount > 0) {
      await batch.commit();
      totalRestored += chunkCount;
    }
  }

  return totalRestored;
}
