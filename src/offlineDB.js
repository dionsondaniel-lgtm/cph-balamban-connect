import { openDB } from 'idb';

const DB_NAME = 'cph_app_db';
const DB_VERSION = 1;
const MESSAGE_STORE = 'messages';

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        db.createObjectStore(MESSAGE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function saveMessageOffline(message) {
  const db = await initDB();
  await db.add(MESSAGE_STORE, message);
}

export async function getAllMessagesOffline() {
  const db = await initDB();
  return db.getAll(MESSAGE_STORE);
}

export async function clearMessagesOffline() {
  const db = await initDB();
  const tx = db.transaction(MESSAGE_STORE, 'readwrite');
  await tx.objectStore(MESSAGE_STORE).clear();
  await tx.done;
}
