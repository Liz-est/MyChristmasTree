// src/utils/db.ts

const DB_NAME = 'GrandLuxuryTreeDB';
const DB_VERSION = 1;
const STORE_IMAGES = 'images';
const STORE_AUDIO = 'audio';

// 初始化数据库
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES); // Key: image index (number)
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO); // Key: song title (string)
      }
    };
  });
};

// 保存文件
export const saveFileToDB = async (storeName: 'images' | 'audio', key: string | number, file: Blob) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(file, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// 读取单个文件
export const getFileFromDB = async (storeName: 'images' | 'audio', key: string | number): Promise<Blob | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// 读取所有音频
export const getAllAudioFromDB = async () => {
  const db = await initDB();
  return new Promise<{ key: string, file: Blob }[]>((resolve, reject) => {
    const transaction = db.transaction(STORE_AUDIO, 'readonly');
    const store = transaction.objectStore(STORE_AUDIO);
    const request = store.getAllKeys();
    
    const results: { key: string, file: Blob }[] = [];
    
    request.onsuccess = async () => {
      const keys = request.result;
      for (const key of keys) {
        const file = await getFileFromDB(STORE_AUDIO, key as string | number);
        if (file) results.push({ key: key.toString(), file });
      }
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

// 删除文件
export const deleteFileFromDB = async (storeName: 'images' | 'audio', key: string | number) => {
  const db = await initDB();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(key);
};