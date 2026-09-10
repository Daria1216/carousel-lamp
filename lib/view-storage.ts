export type SavedView = {
  night: boolean;
  spinning: boolean;
  position: [number, number, number];
  target: [number, number, number];
  angle: number;
};
export const VIEW_STORAGE_KEY = 'carousel-lamp-view-v1';
export function readSavedView(): SavedView | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) ?? 'null');
    const vector = (v: unknown): v is [number, number, number] =>
      Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 100);
    if (!value || typeof value.night !== 'boolean' || typeof value.spinning !== 'boolean' ||
      !vector(value.position) || !vector(value.target) || !Number.isFinite(value.angle)) return;
    const distance = Math.hypot(...value.position.map((n: number, i: number) => n - value.target[i]));
    if (distance < 1 || distance > 50) return;
    return value;
  } catch { return; }
}
export function saveView(view: SavedView): void {
  localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(view));
}
