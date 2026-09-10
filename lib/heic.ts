import HeicWorker from './heic.worker?worker';
export const isHeicFile = (file: File) => /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf](?:-sequence)?$/i.test(file.type);

export function convertHeic(file: File, signal: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const worker = new HeicWorker();
    const finish = (blob?: Blob, error?: Error) => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error); else resolve(blob!);
    };
    const abort = () => finish(undefined, new DOMException('Cancelled', 'AbortError'));
    const timeout = setTimeout(() => finish(undefined, new Error('相片处理时间较长，请换一张较小的相片，或导出为 JPG 后重试。')), 90000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{blob?: Blob; error?: string}>) => {
      if (event.data.blob instanceof Blob) finish(event.data.blob);
      else finish(undefined, new Error(event.data.error || '相片转换失败，请重试。'));
    };
    worker.onerror = () => finish(undefined, new Error('无法启动 HEIC 转换，请刷新页面或换一个浏览器重试。'));
    worker.postMessage(file);
  });
}
