import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SavedAnalysis } from '../../types';

interface WhatsAppDB extends DBSchema {
  analyses: {
    key: string;
    value: SavedAnalysis;
    indexes: { 'by-createdAt': number };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'whatsapp-summary-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<WhatsAppDB>> | null = null;

function getDB(): Promise<IDBPDatabase<WhatsAppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WhatsAppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('analyses')) {
          const store = db.createObjectStore('analyses', { keyPath: 'id' });
          store.createIndex('by-createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveAnalysis(analysis: SavedAnalysis): Promise<void> {
  const db = await getDB();
  await db.put('analyses', analysis);
}

export async function getAllAnalyses(): Promise<SavedAnalysis[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('analyses', 'by-createdAt');
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAnalysis(id: string): Promise<SavedAnalysis | undefined> {
  const db = await getDB();
  return db.get('analyses', id);
}

export async function deleteAnalysis(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('analyses', id);
}

export async function deleteAllAnalyses(): Promise<void> {
  const db = await getDB();
  await db.clear('analyses');
}

export async function searchAnalyses(query: string): Promise<SavedAnalysis[]> {
  const all = await getAllAnalyses();
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((a) => a.title.toLowerCase().includes(q));
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('settings', value, key);
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get('settings', key)) as T | undefined;
}
