import { heicTo } from 'heic-to/next';

self.onmessage = async (event: MessageEvent<Blob>) => {
  try {
    const bitmap = await heicTo({ blob: event.data, type: 'bitmap' });
    try {
      const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: .92 });
      self.postMessage({ blob });
    } finally { bitmap.close(); }
  } catch {
    self.postMessage({ error: '这张 HEIC 相片暂时无法转换。请尝试其他相片，或导出为 JPG 后重试。' });
  }
};
