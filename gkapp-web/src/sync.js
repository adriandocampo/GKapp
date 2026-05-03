/**
 * sync.js — Transparent Dexie ↔ Firestore synchronisation
 *
 * Strategy:
 *   • On login: download all user data from Firestore into local Dexie
 *   • Dexie hooks intercept every write and mirror it to Firestore (background)
 *   • Blobs (imageBlob, videoBlob) are never sent to Firestore
 *
 * Components keep using `db` exactly as before — no component changes needed.
 */

import {
  collection, doc,
  getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore, isFirebaseEnabled } from './firebase';
import { db } from './db';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Strip fields that must NOT go to Firestore (binary blobs) */
function stripBlobs(obj) {
  const { imageBlob, videoBlob, ...rest } = obj ?? {};
  // Convert Date objects so Firestore doesn't reject them
  return JSON.parse(JSON.stringify(rest, (_, v) =>
    v instanceof Date ? v.toISOString() : v
  ));
}

function userCol(uid, name) {
  return collection(firestore, 'users', uid, name);
}
function userDoc(uid, name, id) {
  return doc(firestore, 'users', uid, name, String(id));
}

// ─── Initial sync: Firestore → Dexie ────────────────────────────────────────

const TABLES = ['tasks', 'sessions', 'tags', 'seasons', 'taskHistory', 'settings'];

export async function syncFromFirestore(uid) {
  if (!isFirebaseEnabled || !uid) return;
  try {
    for (const table of TABLES) {
      const snap = await getDocs(userCol(uid, table));
      if (snap.empty) continue;
      const rows = snap.docs.map(d => {
        const data = d.data();
        // Restore auto-increment ids if they're numeric strings
        const rawId = d.id;
        const id    = isNaN(rawId) ? rawId : Number(rawId);
        return { ...data, id };
      });

      // Clear local table and repopulate from cloud
      await db.table(table).clear();
      await db.table(table).bulkPut(rows);
    }
    console.log('[sync] Firestore → Dexie complete');
  } catch (err) {
    console.error('[sync] syncFromFirestore failed', err);
  }
}

// ─── Ongoing sync: Dexie hooks → Firestore ──────────────────────────────────

let hooksInstalled = false;

export function setupFirestoreSync(uid) {
  if (!isFirebaseEnabled || !uid || hooksInstalled) return;
  hooksInstalled = true;

  for (const table of TABLES) {
    const tbl = db.table(table);

    tbl.hook('creating', (primKey, obj) => {
      setDoc(userDoc(uid, table, primKey), {
        ...stripBlobs(obj),
        _syncedAt: serverTimestamp(),
      }).catch(err => console.warn('[sync] create failed', table, err));
    });

    tbl.hook('updating', (mods, primKey, _obj, _trans) => {
      const safe = stripBlobs(mods);
      if (Object.keys(safe).length === 0) return;
      updateDoc(userDoc(uid, table, primKey), {
        ...safe,
        _syncedAt: serverTimestamp(),
      }).catch(err => console.warn('[sync] update failed', table, err));
    });

    tbl.hook('deleting', (primKey) => {
      deleteDoc(userDoc(uid, table, primKey))
        .catch(err => console.warn('[sync] delete failed', table, err));
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
      await setDoc(
        userDoc(uid, table, row.id),
        { ...stripBlobs(row), _syncedAt: serverTimestamp() },
        { merge: true }
      );
    }
  }
  console.log('[sync] Local data pushed to Firestore');
}
