// =========================================================
// DATABASE CONNECTION — @capacitor-community/sqlite
// Encrypted with SQLCipher via user's derived key
// =========================================================

// NOTE: In Phase 1 (web-only MVP), we use a simple localStorage-based
// mock that mirrors the SQLite API. Real SQLCipher is activated
// when running on native (Capacitor). This lets us develop in browser.

import { PLUTCHIK_EMOTIONS } from '@/utils/plutchikColors';

const DB_NAME = 'memories_db';
const DB_VERSION = 1;

// =========================================================
// WEB MOCK — IndexedDB backed simple SQL-like store
// Will be replaced by real @capacitor-community/sqlite
// =========================================================

export interface DBRow {
  [key: string]: unknown;
}

class MemoriesDatabase {
  private db: IDBDatabase | null = null;
  private isReady = false;

  async initialize(): Promise<void> {
    if (this.isReady) return;
    await this.openIndexedDB();
    await this.runMigrations();
    this.isReady = true;
    console.log('[DB] Memories database initialized ✓');
  }

  private openIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };
    });
  }

  private createStores(db: IDBDatabase): void {
    // Users
    if (!db.objectStoreNames.contains('user')) {
      const userStore = db.createObjectStore('user', { keyPath: 'id' });
      userStore.createIndex('username', 'username', { unique: true });
    }

    // Memories
    if (!db.objectStoreNames.contains('memory')) {
      const memStore = db.createObjectStore('memory', { keyPath: 'id' });
      memStore.createIndex('created_at', 'created_at');
      memStore.createIndex('scope', 'scope');
      memStore.createIndex('emotion_id', 'emotion_id');
    }

    // Media
    if (!db.objectStoreNames.contains('media')) {
      const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
      mediaStore.createIndex('memory_id', 'memory_id');
    }

    // Persons
    if (!db.objectStoreNames.contains('person')) {
      db.createObjectStore('person', { keyPath: 'id' });
    }

    // Memory-Person relation
    if (!db.objectStoreNames.contains('memory_person')) {
      const mpStore = db.createObjectStore('memory_person', { keyPath: ['memory_id', 'person_id'] });
      mpStore.createIndex('memory_id', 'memory_id');
    }

    // Tags
    if (!db.objectStoreNames.contains('tag')) {
      const tagStore = db.createObjectStore('tag', { keyPath: 'id' });
      tagStore.createIndex('name', 'name', { unique: true });
    }

    // Memory-Tag relation
    if (!db.objectStoreNames.contains('memory_tag')) {
      const mtStore = db.createObjectStore('memory_tag', { keyPath: ['memory_id', 'tag_id'] });
      mtStore.createIndex('memory_id', 'memory_id');
    }

    // Emotions (Plutchik catalog)
    if (!db.objectStoreNames.contains('emotion')) {
      db.createObjectStore('emotion', { keyPath: 'id' });
    }
  }

  private async runMigrations(): Promise<void> {
    // Seed emotions if not present
    const emotions = await this.getAll<{ id: string }>('emotion');
    if (emotions.length === 0) {
      await this.seedEmotions();
      console.log('[DB] Emotions seeded ✓');
    }
  }

  private async seedEmotions(): Promise<void> {
    for (const emotion of PLUTCHIK_EMOTIONS) {
      await this.put('emotion', emotion);
    }
  }

  // =========================================================
  // Generic CRUD helpers
  // =========================================================

  getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  getById<T>(storeName: string, id: unknown): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id as IDBValidKey);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  getByIndex<T>(storeName: string, indexName: string, value: unknown): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value as IDBValidKey);
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  put<T>(storeName: string, data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  delete(storeName: string, id: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id as IDBValidKey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  getByFirstIndex<T>(storeName: string, indexName: string, value: unknown): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.get(value as IDBValidKey);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }
}

// Singleton
export const db = new MemoriesDatabase();
