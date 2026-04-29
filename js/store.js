/* ============================================
   Firestore 래퍼 — 4개 컬렉션
   assets, move_history, move_requests, floorplans
   ============================================ */
import { db } from './firebase.js';
import {
  collection, doc, getDocs, getDoc,
  setDoc, deleteDoc, getCountFromServer, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export async function listAll(storeName) {
  const snap = await getDocs(collection(db, storeName));
  return snap.docs.map(d => d.data());
}

export async function get(storeName, id) {
  const snap = await getDoc(doc(db, storeName, id));
  return snap.exists() ? snap.data() : null;
}

export async function add(storeName, record) {
  const r = { id: record.id || uuid(), createdAt: Date.now(), ...record };
  await setDoc(doc(db, storeName, r.id), r);
  return r;
}

export async function put(storeName, record) {
  if (!record.id) throw new Error('put requires id');
  const r = { updatedAt: Date.now(), ...record };
  await setDoc(doc(db, storeName, r.id), r);
  return r;
}

export async function remove(storeName, id) {
  await deleteDoc(doc(db, storeName, id));
}

export async function clearStore(storeName) {
  const snap = await getDocs(collection(db, storeName));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

export async function count(storeName) {
  const snap = await getCountFromServer(collection(db, storeName));
  return snap.data().count;
}

/* ─── 도메인 헬퍼 ─── */
export const Assets = {
  list:   ()   => listAll('assets'),
  get:    id   => get('assets', id),
  add:    data => add('assets', data),
  put:    data => put('assets', data),
  remove: id   => remove('assets', id)
};
export const MoveRequests = {
  list: ()   => listAll('move_requests'),
  get:  id   => get('move_requests', id),
  add:  data => add('move_requests', data),
  put:  data => put('move_requests', data)
};
export const MoveHistory = {
  list: ()   => listAll('move_history'),
  add:  data => add('move_history', data)
};
export const Floorplans = {
  list:   ()   => listAll('floorplans'),
  get:    id   => get('floorplans', id),
  put:    data => put('floorplans', data),
  remove: id   => remove('floorplans', id)
};
