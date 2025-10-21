// IndexedDB ユーティリティ関数

const DB_NAME = 'wkwkCollectionDB';
const DB_VERSION = 1;
const STORE_NAME = 'collectedModels';

// IndexedDBを開く
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// 収集したモデルを保存
export const saveCollectedModels = async (models: string[]): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const data = {
      id: 'collection',
      models: models,
      timestamp: new Date().toISOString()
    };

    store.put(data);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('Error saving to IndexedDB:', error);
    throw error;
  }
};

// 収集したモデルを読み込み
export const loadCollectedModels = async (): Promise<string[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('collection');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const result = request.result;
        resolve(result ? result.models : []);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error loading from IndexedDB:', error);
    return [];
  }
};

// コレクションをクリア
export const clearCollectedModels = async (): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete('collection');

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('Error clearing IndexedDB:', error);
    throw error;
  }
};
