/**
 * sync.js — Transparent Dexie ↔ Firestore synchronisation
 *
 * Strategy:
 *   • On login: bidirectional merge between local Dexie and Firestore
 *   • Dexie hooks intercept every write and mirror it to Firestore (background)
 *   • Failed writes are enqueued in syncQueue with exponential backoff retry
 *   • videoBlob is never sent to Firestore
 *   • imageBlob is compressed progressively (1200→800→600px) and sent as imageBase64
 *   • BroadcastChannel coordinates multiple tabs
 *   • Session guard enforces single-device login
 */

import {
  collection, doc,
  getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp,
  writeBatch, onSnapshot,
} from 'firebase/firestore';
import { firestore, isFirebaseEnabled } from './firebase';
import { db } from './db';
import { getTimestampMs } from './utils/date.js';
import { getBroadcastChannel } from './contexts/SyncContext.jsx';

// ─── Helpers ────────────────────────────────────────────────────────────────

let isSyncingFromFirestore = false;
let syncInProgress = false;
let syncDirty = false;
let hooksInstalled = false;
let activeSyncUid = null;
let hookUnsubscribers = [];
let sessionGuardUnsubscribe = null;
let queueTimerId = null;

const TABLES = ['tasks', 'sessions', 'tags', 'seasons', 'taskHistory', 'settings'];
const MAX_ATTEMPTS = 10;
const QUEUE_INTERVAL_MS = 30_000;
const FIRESTORE_IMAGE_LIMIT = 900_000;

const COMPRESSION_LEVELS = [
  { maxWidth: 1200, quality: 0.8 },
  { maxWidth: 800,  quality: 0.6 },
  { maxWidth: 600,  quality: 0.4 },
];

/** Deep clone preserving Date instances */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(deepClone);
  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = deepClone(obj[key]);
  }
  return result;
}

/** Convert Firestore Timestamps back to JS Date recursively */
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

/** Strip videoBlob and compress imageBlob for Firestore (progressive compression) */
async function stripBlobs(obj) {
  if (!obj) return {};

  const imageBlob = obj.imageBlob;
  const rest = deepClone(obj);
  delete rest.imageBlob;
  delete rest.videoBlob;
  delete rest.imageBase64;

  let finalImageBase64 = undefined;

  if (imageBlob === null) {
    finalImageBase64 = null;
  } else if (imageBlob) {
    let compressed = null;
    for (const level of COMPRESSION_LEVELS) {
      try {
        compressed = await compressImageBlob(imageBlob, level.maxWidth, level.quality);
        if (compressed.size < FIRESTORE_IMAGE_LIMIT) break;
      } catch (err) {
        console.warn('[sync] Error comprimiendo imagen', err);
        compressed = null;
        break;
      }
    }

    if (compressed && compressed.size < FIRESTORE_IMAGE_LIMIT) {
      finalImageBase64 = await blobToBase64(compressed);
    } else {
      finalImageBase64 = null;
      rest.imageSyncFailed = true;
    }
  }

  const result = deepClone(rest);

  if (finalImageBase64 !== undefined) {
    result.imageBase64 = finalImageBase64;
  }

  return result;
}

function userCol(uid, name) {
  return collection(firestore, 'users', uid, name);
}
function userDoc(uid, name, id) {
  return doc(firestore, 'users', uid, name, String(id));
}

// ─── Image compression helpers ─────────────────────────────────────────────

function compressImageBlob(blob, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((newBlob) => {
        if (newBlob) resolve(newBlob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, mimeType = 'image/jpeg') {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i);
  }
  const byteArr = new Uint8Array(byteNums);
  return new Blob([byteArr], { type: mimeType });
}

function broadcast(type, payload) {
  const bc = getBroadcastChannel();
  if (bc) {
    try { bc.postMessage({ type, ...payload }); } catch { /* ignore */ }
  }
}

// ─── Sync Queue ─────────────────────────────────────────────────────────────

async function enqueueOperation(operation, table, docId, data) {
  try {
    await db.syncQueue.add({
      operation,
      table,
      docId: String(docId),
      data,
      attempts: 0,
      nextRetryAt: Date.now(),
      createdAt: new Date(),
    });
    console.log(`[sync] Enqueued ${operation} ${table}/${docId}`);
  } catch (err) {
    console.error('[sync] Failed to enqueue operation:', err);
  }
}

function calculateBackoff(attempts) {
  const baseDelay = 1000;
  const maxDelay = 60_000;
  const delay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
  return Date.now() + delay;
}

export async function processSyncQueue() {
  if (!isFirebaseEnabled || !activeSyncUid) return;

  const now = Date.now();
  const pending = await db.syncQueue
    .where('nextRetryAt').belowOrEqual(now)
    .filter(entry => entry.attempts < MAX_ATTEMPTS)
    .toArray();

  if (pending.length === 0) return;

  for (const entry of pending) {
    try {
      const ref = userDoc(activeSyncUid, entry.table, entry.docId);
      switch (entry.operation) {
        case 'create':
          await setDoc(ref, { ...entry.data, _syncedAt: serverTimestamp() });
          break;
        case 'update':
          await updateDoc(ref, { ...entry.data, _syncedAt: serverTimestamp() });
          break;
        case 'delete':
          await deleteDoc(ref);
          break;
      }
      await db.syncQueue.delete(entry.id);
      console.log(`[sync] Queue retry success: ${entry.operation} ${entry.table}/${entry.docId}`);
      broadcast('local-change', { table: entry.table, docId: entry.docId });
    } catch (err) {
      const newAttempts = entry.attempts + 1;
      if (newAttempts >= MAX_ATTEMPTS) {
        console.error(`[sync] Queue entry permanently failed after ${MAX_ATTEMPTS} attempts:`, entry.operation, entry.table, entry.docId, err);
        await db.syncQueue.update(entry.id, { attempts: newAttempts, nextRetryAt: Infinity });
      } else {
        await db.syncQueue.update(entry.id, {
          attempts: newAttempts,
          nextRetryAt: calculateBackoff(newAttempts),
        });
        console.warn(`[sync] Queue retry failed (attempt ${newAttempts}): ${entry.operation} ${entry.table}/${entry.docId}`, err);
      }
    }
  }
}

export async function clearSyncQueue() {
  try {
    await db.syncQueue.clear();
  } catch { /* ignore */ }
}

function startQueueProcessor() {
  stopQueueProcessor();
  queueTimerId = setInterval(() => {
    processSyncQueue().catch(err => console.error('[sync] Queue processor error:', err));
  }, QUEUE_INTERVAL_MS);

  window.addEventListener('online', handleOnline);
}

function stopQueueProcessor() {
  if (queueTimerId !== null) {
    clearInterval(queueTimerId);
    queueTimerId = null;
  }
  window.removeEventListener('online', handleOnline);
}

function handleOnline() {
  console.log('[sync] Network online, processing sync queue');
  processSyncQueue().catch(err => console.error('[sync] Queue processor error on online:', err));
}

// ─── Reset / cleanup ────────────────────────────────────────────────────────

export async function clearAllLocalData() {
  for (const table of TABLES) {
    try {
      await db.table(table).clear();
    } catch (err) {
      console.warn(`[sync] Error clearing table ${table}:`, err);
    }
  }
  try {
    await db.syncQueue.clear();
  } catch { /* ignore */ }
  console.log('[sync] All local tables cleared');
}

export function resetSyncHooks() {
  for (const unsub of hookUnsubscribers) {
    try { unsub(); } catch { /* ignore */ }
  }
  hookUnsubscribers = [];
  hooksInstalled = false;
  activeSyncUid = null;
  stopQueueProcessor();
  console.log('[sync] Hooks reset');
}

export function teardownSessionGuard() {
  if (sessionGuardUnsubscribe) {
    sessionGuardUnsubscribe();
    sessionGuardUnsubscribe = null;
  }
}

// ─── Sync Guard (prevents seed/tag writes from triggering hooks) ────────────

export async function withSyncGuard(fn) {
  const wasSyncing = isSyncingFromFirestore;
  isSyncingFromFirestore = true;
  try {
    await fn();
  } finally {
    isSyncingFromFirestore = wasSyncing;
  }
}

// ─── Session Guard (single-device enforcement) ──────────────────────────────

export function setupSessionGuard(uid, onKicked) {
  if (!isFirebaseEnabled || !uid) return;
  teardownSessionGuard();

  const ref = doc(firestore, 'userProfiles', uid);
  const localSessionId = localStorage.getItem('gkapp_session_id');

  sessionGuardUnsubscribe = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const remoteSessionId = snap.data()?.sessionId;
    if (remoteSessionId && remoteSessionId !== localSessionId) {
      console.warn('[sync] Session kicked by another device');
      onKicked();
    }
  }, (err) => {
    console.warn('[sync] Session guard listener error:', err);
  });

  console.log('[sync] Session guard active for uid:', uid);
}

export async function registerSession(uid) {
  if (!isFirebaseEnabled || !uid) return;
  const sessionId = crypto.randomUUID();
  localStorage.setItem('gkapp_session_id', sessionId);

  await setDoc(doc(firestore, 'userProfiles', uid), {
    sessionId,
    sessionCreatedAt: serverTimestamp(),
  }, { merge: true });

  console.log('[sync] Session registered:', sessionId);
  return sessionId;
}

// ─── Initial sync: Bidirectional Firestore ↔ Dexie merge ────────────────────

async function syncOneTable(table, uid) {
  const snap = await getDocs(userCol(uid, table));
  console.log(`[sync] Firestore table "${table}": ${snap.size} docs found`);

  const remoteMap = new Map();
  snap.docs.forEach(d => {
    const data = convertTimestamps(d.data());
    const rawId = d.id;
    const id = isNaN(rawId) ? rawId : Number(rawId);

    if (data.imageBase64) {
      try {
        data.imageBlob = base64ToBlob(data.imageBase64);
      } catch (err) {
        console.warn('[sync] Error restaurando imagen', err);
      }
      delete data.imageBase64;
    }

    remoteMap.set(String(id), { ...data, id });
  });

  const localDocs = await db.table(table).toArray();
  const localMap = new Map(localDocs.map(d => [String(d.id), d]));

  for (const [idStr, remoteDoc] of remoteMap) {
    const localDoc = localMap.get(idStr);
    const remoteTime = getTimestampMs(remoteDoc.updatedAt);
    const localTime = localDoc ? getTimestampMs(localDoc.updatedAt) : 0;
    const remoteDeleted = !!remoteDoc.deletedAt;
    const localDeleted = localDoc ? !!localDoc.deletedAt : false;

    if (!localDoc) {
      await db.table(table).add(remoteDoc);
    } else if (remoteDeleted && !localDeleted) {
      const stripped = await stripBlobs(localDoc);
      await setDoc(
        userDoc(uid, table, localDoc.id),
        { ...stripped, deletedAt: null, _syncedAt: serverTimestamp() },
        { merge: true }
      );
    } else if (remoteTime > localTime) {
      await db.table(table).update(localDoc.id, remoteDoc);
    } else if (localTime > remoteTime) {
      const stripped = await stripBlobs(localDoc);
      if (!stripped.deletedAt) stripped.deletedAt = null;
      await setDoc(
        userDoc(uid, table, localDoc.id),
        { ...stripped, _syncedAt: serverTimestamp() },
        { merge: true }
      );
    }
  }

  for (const localDoc of localDocs) {
    const idStr = String(localDoc.id);
    if (!remoteMap.has(idStr)) {
      const stripped = await stripBlobs(localDoc);
      await setDoc(
        userDoc(uid, table, localDoc.id),
        { ...stripped, _syncedAt: serverTimestamp() },
        { merge: true }
      );
    }
  }

  console.log(`[sync] Dexie table "${table}": merged ${snap.size} remote, ${localDocs.length} local`);
}

async function deduplicateTagsAfterSync(uid) {
  try {
    const allTags = await db.tags.toArray();
    const groups = new Map();
    for (const tag of allTags) {
      const key = `${tag.type}:${tag.name}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(tag);
    }
    const toDelete = [];
    for (const [, tags] of groups) {
      if (tags.length <= 1) continue;
      tags.sort((a, b) => a.id - b.id);
      for (let i = 1; i < tags.length; i++) {
        toDelete.push(tags[i].id);
      }
    }
    if (toDelete.length === 0) return;
    await db.tags.bulkDelete(toDelete);
    console.log(`[sync] Deduplicated ${toDelete.length} duplicate tags`);
    if (isFirebaseEnabled && uid) {
      for (const id of toDelete) {
        try { await deleteDoc(userDoc(uid, 'tags', id)); } catch { /* ignore */ }
      }
    }
  } catch (err) {
    console.warn('[sync] Error deduplicating tags:', err);
  }
}

export async function syncFromFirestore(uid) {
  if (!isFirebaseEnabled || !uid) return;
  if (syncInProgress) {
    syncDirty = true;
    console.log('[sync] Sync already in progress, marked dirty');
    return;
  }

  syncInProgress = true;
  isSyncingFromFirestore = true;

  try {
    await doSync(uid);
    while (syncDirty) {
      syncDirty = false;
      console.log('[sync] Re-syncing (dirty flag was set)');
      await doSync(uid);
    }
    await deduplicateTagsAfterSync(uid);
    broadcast('sync-complete');
  } catch (err) {
    console.error('[sync] syncFromFirestore failed', err);
  } finally {
    syncInProgress = false;
    isSyncingFromFirestore = false;
  }
}

async function doSync(uid) {
  await Promise.all(
    TABLES.map(table =>
      syncOneTable(table, uid).catch(tableErr => {
        console.error(`[sync] Error syncing table "${table}":`, tableErr);
      })
    )
  );
  console.log('[sync] Firestore ↔ Dexie merge complete');
}

// ─── Ongoing sync: Dexie hooks → Firestore (with queue fallback) ───────────

export function setupFirestoreSync(uid) {
  if (!isFirebaseEnabled || !uid) return;
  if (hooksInstalled && activeSyncUid === uid) return;

  hooksInstalled = true;
  activeSyncUid = uid;

  for (const table of TABLES) {
    const tbl = db.table(table);

    hookUnsubscribers.push(
      tbl.hook('creating', (primKey, obj) => {
        if (isSyncingFromFirestore) return;
        if (!activeSyncUid) return;
        (async () => {
          const stripped = await stripBlobs(obj);
          if (!stripped.deletedAt) stripped.deletedAt = null;
          try {
            await setDoc(userDoc(activeSyncUid, table, primKey), {
              ...stripped,
              _syncedAt: serverTimestamp(),
            });
            console.log(`[sync] Firestore create success: ${table}/${primKey}`);
            broadcast('local-change', { table, docId: primKey });
          } catch (err) {
            console.warn('[sync] create failed, enqueuing', table, primKey, err);
            await enqueueOperation('create', table, primKey, { ...stripped, deletedAt: stripped.deletedAt });
          }
        })();
      })
    );

    hookUnsubscribers.push(
      tbl.hook('updating', (mods, primKey, _obj) => {
        if (isSyncingFromFirestore) return;
        if (!activeSyncUid) return;
        (async () => {
          const safe = await stripBlobs(mods);
          if (Object.keys(safe).length === 0) return;
          if (!_obj.deletedAt && !('deletedAt' in safe)) {
            safe.deletedAt = null;
          }
          try {
            await updateDoc(userDoc(activeSyncUid, table, primKey), {
              ...safe,
              _syncedAt: serverTimestamp(),
            });
            console.log(`[sync] Firestore update success: ${table}/${primKey}`);
            broadcast('local-change', { table, docId: primKey });
          } catch (err) {
            console.warn('[sync] update failed, enqueuing', table, primKey, err);
            await enqueueOperation('update', table, primKey, { ...safe, deletedAt: safe.deletedAt });
          }
        })();
      })
    );

    hookUnsubscribers.push(
      tbl.hook('deleting', (primKey) => {
        if (isSyncingFromFirestore) return;
        if (!activeSyncUid) return;
        deleteDoc(userDoc(activeSyncUid, table, primKey))
          .then(() => {
            console.log(`[sync] Firestore delete success: ${table}/${primKey}`);
            broadcast('local-change', { table, docId: primKey });
          })
          .catch(async (err) => {
            console.warn('[sync] delete failed, enqueuing', table, primKey, err);
            await enqueueOperation('delete', table, primKey, null);
          });
      })
    );
  }

  startQueueProcessor();

  console.log('[sync] Hooks installed for uid:', uid, '(', hookUnsubscribers.length, 'subscribers)');
}

/** Push all local Dexie data to Firestore (first-time migration from Electron) */
export async function pushToFirestore(uid) {
  if (!isFirebaseEnabled || !uid) return;
  for (const table of TABLES) {
    const rows = await db.table(table).toArray();
    for (const row of rows) {
      const stripped = await stripBlobs(row);
      await setDoc(
        userDoc(uid, table, row.id),
        { ...stripped, _syncedAt: serverTimestamp() },
        { merge: true }
      );
    }
  }
  console.log('[sync] Local data pushed to Firestore');
}

/** Migrate local guest data to Firestore when a guest signs in.
 *  Only runs if the user has no existing Firestore data.
 */
export async function migrateGuestData(uid) {
  if (!isFirebaseEnabled || !uid) return false;

  const guestKey = localStorage.getItem('gkapp_guest');
  if (!guestKey) return false;

  const tasksSnap = await getDocs(userCol(uid, 'tasks'));
  if (!tasksSnap.empty) {
    console.log('[sync] User already has Firestore data, skipping guest migration');
    return false;
  }

  await pushToFirestore(uid);
  localStorage.removeItem('gkapp_guest');
  console.log('[sync] Guest data migrated to uid:', uid);
  return true;
}

export async function cleanupOldDeletedFirestore(uid) {
  if (!isFirebaseEnabled || !uid) return;
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const table of ['tasks', 'sessions', 'seasons']) {
    try {
      const col = userCol(uid, table);
      const snap = await getDocs(col);
      const toDelete = snap.docs.filter(d => {
        const data = d.data();
        if (!data.deletedAt) return false;
        const deletedTime = getTimestampMs(data.deletedAt);
        return deletedTime > 0 && deletedTime < cutoff.getTime();
      });

      if (toDelete.length === 0) continue;

      const BATCH_SIZE = 450;
      for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const chunk = toDelete.slice(i, i + BATCH_SIZE);
        for (const d of chunk) {
          batch.delete(d.ref);
        }
        await batch.commit();
      }
      console.log(`[sync] Cleaned up ${toDelete.length} old deleted ${table} from Firestore`);
    } catch (err) {
      console.warn(`[sync] Error cleaning up old deleted ${table}:`, err);
    }
  }
}

/** Check if any Firestore documents have imageSyncFailed flag */
export async function hasImageSyncFailures(uid) {
  if (!isFirebaseEnabled || !uid) return false;
  try {
    const snap = await getDocs(userCol(uid, 'tasks'));
    return snap.docs.some(d => d.data().imageSyncFailed === true);
  } catch {
    return false;
  }
}
