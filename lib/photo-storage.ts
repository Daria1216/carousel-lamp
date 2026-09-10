import type { Crop } from './photos';

export type SavedPhoto = {
  slot: number;
  source: Blob | null;
  preview: string;
  crop: Crop;
  empty: boolean;
};
function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('carousel-lamp-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'slot' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本机相片存储，请检查浏览器的网站存储设置。'));
    request.onblocked = () => reject(new Error('相片存储暂时被其他页面占用，请关闭其他页面后重试。'));
  });
}
export async function readSavedPhotos(): Promise<SavedPhoto[]> {
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readonly');
      const request = tx.objectStore('photos').getAll();
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error('未能读取本机保存的相片，请刷新重试。'));
    });
  } finally { db.close(); }
}
export async function savePhotoLocally(photo: SavedPhoto): Promise<void> {
  return savePhotosLocally([photo]);
}

// Commit both sides of an exchange together, so a failed write cannot lose a photo.
export async function savePhotosLocally(photos: SavedPhoto[]): Promise<void> {
  const db = await openStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite', { durability: 'strict' });
      try {
        for (const photo of photos) tx.objectStore('photos').put(photo);
      } catch {
        tx.abort();
        reject(new Error('相片未能保存，位置没有改变。'));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error('相片未能保存到本机，可能存储空间不足。请释放空间后重试。'));
    });
  } finally { db.close(); }
}
