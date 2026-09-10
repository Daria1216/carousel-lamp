export const PHOTO_COUNT = 16;
export type Crop = { zoom: number; x: number; y: number };
export const initialCrop: Crop = { zoom: 1, x: 0, y: 0 };
export function cropRect(width: number, height: number, crop: Crop) {
  const scale =
    Math.max(440 / width, 520 / height) * Math.max(1, Math.min(3, crop.zoom));
  const w = 440 / scale,
    h = 520 / scale;
  const x = ((width - w) * (Math.max(-1, Math.min(1, crop.x)) + 1)) / 2;
  const y = ((height - h) * (Math.max(-1, Math.min(1, crop.y)) + 1)) / 2;
  return { x, y, w, h };
}
export function drawCrop(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  crop: Crop,
) {
  canvas.width = 440;
  canvas.height = 520;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('无法生成相片预览，请重试。');
  const r = cropRect(img.naturalWidth, img.naturalHeight, crop);
  c.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, 440, 520);
}
export function loadPhoto(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('这张相片无法解码，可能格式不受支持或文件已损坏。请重新导出为 JPG 或 PNG 后再试。'));
    image.src = src;
  });
}
