/**
 * sync.js — Transparent Dexie ↔ Firestore synchronisation
 *
 * Strategy:
 *   • On login: bidirectional merge between local Dexie and Firestore
 *   • Dexie hooks intercept every write and mirror it to Firestore (background)
 *   • videoBlob is never sent to Firestore
 *   • imageBlob is compressed (max 1200px, JPEG 0.8) and sent as imageBase64
 */

import {
  collection, doc,
  getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { firestore, isFirebaseEnabled } from './firebase';
import { db } from './db';

// ─── Helpers ────────────────────────────────────────────────────────────────

let isSyncingFromFirestore = false;
let hooksInstalled = false;
let activeSyncUid = null; // mutable, read by hooks at runtime (prevents cross-user leaks)

const TABLES = ['tasks', 'sessions', 'tags', 'seasons', 'taskHistory', 'settings'];

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

/** Normalize any date-like value to timestamp ms */
function getTimestampMs(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  if (typeof value === 'number') return value;
  if (value.toDate && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  return 0;
}

/** Strip videoBlob and compress imageBlob for Firestore */
async function stripBlobs(obj) {
  const { imageBlob, videoBlob, imageBase64, ...rest } = obj ?? {};

  let finalImageBase64 = undefined; // undefined = don't touch this field

  if (imageBlob === null) {
    finalImageBase64 = null; // explicitly clear image
  } else if (imageBlob) {
    try {
      const compressed = await compressImageBlob(imageBlob, 1200, 0.8);
      if (compressed.size < 900_000) {
        finalImageBase64 = await blobToBase64(compressed);
      } else {
        console.warn('[sync] Imagen comprimida demasiado grande (>900KB), omitiendo sync de imagen');
        finalImageBase64 = null;
      }
    } catch (err) {
      console.warn('[sync] Error comprimiendo imagen', err);
      finalImageBase64 = null;
    }
  }

  // Preserve Date instances (Firestore converts them to Timestamps automatically)
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

// ─── Reset / cleanup ────────────────────────────────────────────────────────

export async function clearAllLocalData() {
  for (const table of TABLES) {
    try {
      await db.table(table).clear();
    } catch (err) {
      console.warn(`[sync] Error clearing table ${table}:`, err);
    }
  }
  console.log('[sync] All local tables cleared');
}

export function resetSyncHooks() {
  hooksInstalled = false;
  activeSyncUid = null;
  console.log('[sync] Hooks reset');
}

// ─── Initial sync: Bidirectional Firestore ↔ Dexie merge ────────────────────

export async function syncFromFirestore(uid) {
  if (!isFirebaseEnabled || !uid) return;
  if (isSyncingFromFirestore) {
    console.log('[sync] Already syncing, skipping duplicate call');
    return;
  }
  isSyncingFromFirestore = true;

  try {
    for (const table of TABLES) {
      try {
        const snap = await getDocs(userCol(uid, table));
        console.log(`[sync] Firestore table "${table}": ${snap.size} docs found`);

        // Build remote map
        const remoteMap = new Map();
        snap.docs.forEach(d => {
          const data = convertTimestamps(d.data());
          const rawId = d.id;
          const id = isNaN(rawId) ? rawId : Number(rawId);

          // Restore image from base64
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

        // Build local map
        const localDocs = await db.table(table).toArray();
        const localMap = new Map(localDocs.map(d => [String(d.id), d]));

        // Process remotes: update local if remote is newer or missing
        for (const [idStr, remoteDoc] of remoteMap) {
          const localDoc = localMap.get(idStr);
          const remoteTime = getTimestampMs(remoteDoc.updatedAt);
          const localTime = localDoc ? getTimestampMs(localDoc.updatedAt) : 0;
          const remoteDeleted = !!remoteDoc.deletedAt;
          const localDeleted = localDoc ? !!localDoc.deletedAt : false;

          if (!localDoc) {
            // Only exists remotely → insert locally
            await db.table(table).add(remoteDoc);
          } else if (remoteDeleted && !localDeleted) {
            // Remote is deleted but local is alive → local wins, resurrect remote
            const stripped = await stripBlobs(localDoc);
            await setDoc(
              userDoc(uid, table, localDoc.id),
              { ...stripped, deletedAt: null, _syncedAt: serverTimestamp() },
              { merge: true }
            );
          } else if (remoteTime > localTime) {
            // Remote is newer → update local
            await db.table(table).update(localDoc.id, remoteDoc);
          } else if (localTime > remoteTime) {
            // Local is newer → push to Firestore
            const stripped = await stripBlobs(localDoc);
            if (!stripped.deletedAt) stripped.deletedAt = null;
            await setDoc(
              userDoc(uid, table, localDoc.id),
              { ...stripped, _syncedAt: serverTimestamp() },
              { merge: true }
            );
          }
          // If equal timestamps, do nothing
        }

        // Process locals that don't exist remotely → push to Firestore
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
      } catch (tableErr) {
        console.error(`[sync] Error syncing table "${table}":`, tableErr);
      }
    }
    console.log('[sync] Firestore ↔ Dexie merge complete');
  } catch (err) {
    console.error('[sync] syncFromFirestore failed', err);
  } finally {
    isSyncingFromFirestore = false;
  }
}

// ─── Ongoing sync: Dexie hooks → Firestore ──────────────────────────────────

export function setupFirestoreSync(uid) {
  if (!isFirebaseEnabled || !uid) return;
  if (hooksInstalled && activeSyncUid === uid) return;

  hooksInstalled = true;
  activeSyncUid = uid;

  for (const table of TABLES) {
    const tbl = db.table(table);

    tbl.hook('creating', (primKey, obj) => {
      if (isSyncingFromFirestore) return;
      if (!activeSyncUid) return;
      (async () => {
        const stripped = await stripBlobs(obj);
        if (!stripped.deletedAt) stripped.deletedAt = null;
        await setDoc(userDoc(activeSyncUid, table, primKey), {
          ...stripped,
          _syncedAt: serverTimestamp(),
        });
        console.log(`[sync] Firestore create success: ${table}/${primKey}`);
      })().catch(err => console.warn('[sync] create failed', table, primKey, err));
    });

    tbl.hook('updating', (mods, primKey, _obj, _trans) => {
      if (isSyncingFromFirestore) return;
      if (!activeSyncUid) return;
      (async () => {
        const safe = await stripBlobs(mods);
        if (Object.keys(safe).length === 0) return;
        // If the local document is alive and this update is not a soft-delete,
        // explicitly clear deletedAt in Firestore to resurrect the doc if needed.
        if (!_obj.deletedAt && !('deletedAt' in safe)) {
          safe.deletedAt = null;
        }
        await updateDoc(userDoc(activeSyncUid, table, primKey), {
          ...safe,
          _syncedAt: serverTimestamp(),
        });
        console.log(`[sync] Firestore update success: ${table}/${primKey}`);
      })().catch(err => console.warn('[sync] update failed', table, primKey, err));
    });

    tbl.hook('deleting', (primKey) => {
      if (isSyncingFromFirestore) return;
      if (!activeSyncUid) return;
      deleteDoc(userDoc(activeSyncUid, table, primKey))
        .then(() => console.log(`[sync] Firestore delete success: ${table}/${primKey}`))
        .catch(err => console.warn('[sync] delete failed', table, primKey, err));
    });
  }

  console.log('[sync] Dexie hooks installed for uid:', uid);
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

  // Quick check: does user already have cloud data?
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
      // Fetch all docs and filter in memory to avoid compound-index issues
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
