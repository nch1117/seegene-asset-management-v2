/* ============================================
   IndexedDB 래퍼 — 4개 스토어
   assets, move_history, move_requests, floorplans
   ============================================ */

const DB_NAME = 'sgm2_db';
const DB_VERSION = 1;
const STORES = ['assets', 'move_history', 'move_requests', 'floorplans'];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listAll(storeName) {
  const store = await tx(storeName);
  return reqToPromise(store.getAll());
}

export async function get(storeName, id) {
  const store = await tx(storeName);
  return reqToPromise(store.get(id));
}

export async function add(storeName, record) {
  const r = { id: record.id || uuid(), createdAt: Date.now(), ...record };
  const store = await tx(storeName, 'readwrite');
  await reqToPromise(store.add(r));
  return r;
}

export async function put(storeName, record) {
  if (!record.id) throw new Error('put requires id');
  const store = await tx(storeName, 'readwrite');
  const merged = { updatedAt: Date.now(), ...record };
  await reqToPromise(store.put(merged));
  return merged;
}

export async function remove(storeName, id) {
  const store = await tx(storeName, 'readwrite');
  return reqToPromise(store.delete(id));
}

export async function clearStore(storeName) {
  const store = await tx(storeName, 'readwrite');
  return reqToPromise(store.clear());
}

export async function count(storeName) {
  const store = await tx(storeName);
  return reqToPromise(store.count());
}

/* ─── 도메인 헬퍼 ─── */
export const Assets = {
  list: () => listAll('assets'),
  get:  id => get('assets', id),
  add:  data => add('assets', data),
  put:  data => put('assets', data),
  remove: id => remove('assets', id)
};
export const MoveRequests = {
  list: () => listAll('move_requests'),
  get:  id => get('move_requests', id),
  add:  data => add('move_requests', data),
  put:  data => put('move_requests', data)
};
export const MoveHistory = {
  list: () => listAll('move_history'),
  add:  data => add('move_history', data)
};
export const Floorplans = {
  list: () => listAll('floorplans'),
  get:  id => get('floorplans', id),
  put:  data => put('floorplans', data)
};
