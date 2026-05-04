import {
  collection, doc, getDocs, getDoc,
  setDoc, updateDoc, deleteDoc,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { firestore } from '../firebase';

const TABLES = ['tasks', 'sessions', 'tags', 'seasons', 'taskHistory', 'settings'];

function userCol(uid, table) {
  return collection(firestore, 'users', uid, table);
}
function userDocRef(uid, table, id) {
  return doc(firestore, 'users', uid, table, String(id));
}

/** List all registered user profiles */
export async function listUserProfiles() {
  const snap = await getDocs(collection(firestore, 'userProfiles'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
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

/** Import (restore) user data from a JSON object.
 *  WARNING: this OVERWRITES existing documents with matching IDs.
 */
export async function importAllUserData(uid, payload) {
  for (const table of TABLES) {
    const rows = payload[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    // Firestore batch max is 500; split if necessary
    const BATCH_SIZE = 450;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestore);
      const chunk = rows.slice(i, i + BATCH_SIZE);
      for (const row of chunk) {
        const id = String(row.id);
        const ref = userDocRef(uid, table, id);
        const { id: _id, ...data } = row;
        batch.set(ref, data, { merge: true });
      }
      await batch.commit();
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
