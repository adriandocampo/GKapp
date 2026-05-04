/**
 * sync.js — Transparent Dexie ↔ Firestore synchronisation
 *
 * Strategy:
 *   • On login: download all user data from Firestore into local Dexie
 *   • Dexie hooks intercept every write and mirror it to Firestore (background)
 *   • videoBlob is never sent to Firestore
 *   • imageBlob is compressed (max 1200px, JPEG 0.8) and sent as imageBase64
 */

import {
  collection, doc,
  getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore, isFirebaseEnabled } from './firebase';
import { db } from './db';

// ─── Helpers ────────────────────────────────────────────────────────────────

let isSyncingFromFirestore = false;
let hooksInstalled = false;
let currentSyncUid = null;

const TABLES = ['tasks', 'sessions', 'tags', 'seasons', 'taskHistory', 'settings'];

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

  const result = JSON.parse(JSON.stringify(rest, (_, v) =>
    v instanceof Date ? v.toISOString() : v
  ));

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
  currentSyncUid = null;
  console.log('[sync] Hooks reset');
}

// ─── Initial sync: Firestore → Dexie ────────────────────────────────────────

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

        // Clear local table so it matches Firestore exactly for this user
        await db.table(table).clear();

        if (snap.empty) continue;

        const rows = await Promise.all(snap.docs.map(async d => {
          const data = d.data();
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

          return { ...data, id };
        }));

        await db.table(table).bulkPut(rows);
        console.log(`[sync] Dexie table "${table}": ${rows.length} docs inserted`);
      } catch (tableErr) {
        console.error(`[sync] Error syncing table "${table}":`, tableErr);
      }
    }
    console.log('[sync] Firestore → Dexie complete');
  } catch (err) {
    console.error('[sync] syncFromFirestore failed', err);
  } finally {
    isSyncingFromFirestore = false;
  }
}

// ─── Ongoing sync: Dexie hooks → Firestore ──────────────────────────────────

export function setupFirestoreSync(uid) {
  if (!isFirebaseEnabled || !uid) return;
  if (hooksInstalled && currentSyncUid === uid) return;

  hooksInstalled = true;
  currentSyncUid = uid;

  for (const table of TABLES) {
    const tbl = db.table(table);

    tbl.hook('creating', (primKey, obj) => {
      if (isSyncingFromFirestore) return;
      (async () => {
        const stripped = await stripBlobs(obj);
        await setDoc(userDoc(uid, table, primKey), {
          ...stripped,
          _syncedAt: serverTimestamp(),
        });
        console.log(`[sync] Firestore create success: ${table}/${primKey}`);
      })().catch(err => console.warn('[sync] create failed', table, primKey, err));
    });

    tbl.hook('updating', (mods, primKey, _obj, _trans) => {
      if (isSyncingFromFirestore) return;
      (async () => {
        const safe = await stripBlobs(mods);
        if (Object.keys(safe).length === 0) return;
        await updateDoc(userDoc(uid, table, primKey), {
          ...safe,
          _syncedAt: serverTimestamp(),
        });
        console.log(`[sync] Firestore update success: ${table}/${primKey}`);
      })().catch(err => console.warn('[sync] update failed', table, primKey, err));
    });

    tbl.hook('deleting', (primKey) => {
      if (isSyncingFromFirestore) return;
      deleteDoc(userDoc(uid, table, primKey))
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
