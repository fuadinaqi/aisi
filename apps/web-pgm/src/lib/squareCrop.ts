export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export type CropView = {
  crop: number;
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Scale that makes the shorter side fill the square at zoom 1. */
export function coverScale(view: Pick<CropView, 'crop' | 'naturalWidth' | 'naturalHeight'>) {
  const short = Math.min(view.naturalWidth, view.naturalHeight);
  if (short <= 0 || view.crop <= 0) return 0;
  return view.crop / short;
}

export function displayedSize(view: CropView) {
  const scale = coverScale(view) * view.zoom;
  return {
    scale,
    width: view.naturalWidth * scale,
    height: view.naturalHeight * scale,
  };
}

export function clampOffset(view: CropView): Pick<CropView, 'offsetX' | 'offsetY'> {
  const { width, height } = displayedSize(view);
  return {
    offsetX: clamp(view.offsetX, Math.min(view.crop - width, 0), 0),
    offsetY: clamp(view.offsetY, Math.min(view.crop - height, 0), 0),
  };
}

export function initialCropView(crop: number, naturalWidth: number, naturalHeight: number): CropView {
  const view: CropView = {
    crop: Math.max(crop, 1),
    naturalWidth,
    naturalHeight,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  };
  const { width, height } = displayedSize(view);
  view.offsetX = (view.crop - width) / 2;
  view.offsetY = (view.crop - height) / 2;
  return { ...view, ...clampOffset(view) };
}

export function resizeCrop(view: CropView, nextCrop: number): CropView {
  if (nextCrop <= 0 || view.crop <= 0 || Math.abs(view.crop - nextCrop) < 0.5) return view;
  const ratio = nextCrop / view.crop;
  const next: CropView = {
    ...view,
    crop: nextCrop,
    offsetX: view.offsetX * ratio,
    offsetY: view.offsetY * ratio,
  };
  return { ...next, ...clampOffset(next) };
}

/** Zoom while keeping the image point under the anchor fixed, then keep the square covered. */
export function zoomAround(view: CropView, nextZoom: number, anchorX: number, anchorY: number): CropView {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const prev = displayedSize(view);
  if (prev.width <= 0 || prev.height <= 0) return { ...view, zoom };
  const nextScale = coverScale(view) * zoom;
  const nextWidth = view.naturalWidth * nextScale;
  const nextHeight = view.naturalHeight * nextScale;
  const next: CropView = {
    ...view,
    zoom,
    offsetX: anchorX - ((anchorX - view.offsetX) / prev.width) * nextWidth,
    offsetY: anchorY - ((anchorY - view.offsetY) / prev.height) * nextHeight,
  };
  return { ...next, ...clampOffset(next) };
}

/** Source square in original image pixels. */
export function sourceSquare(view: CropView): { sx: number; sy: number; size: number } {
  const { scale } = displayedSize(view);
  const maxSize = Math.min(view.naturalWidth, view.naturalHeight);
  let size = scale > 0 ? view.crop / scale : maxSize;
  if (!Number.isFinite(size) || size <= 0) size = maxSize;
  size = Math.min(size, maxSize);
  const sx = clamp(-view.offsetX / (scale || 1), 0, Math.max(0, view.naturalWidth - size));
  const sy = clamp(-view.offsetY / (scale || 1), 0, Math.max(0, view.naturalHeight - size));
  return { sx, sy, size };
}

export async function fileFromSquareCrop(image: CanvasImageSource, view: CropView, fileName: string): Promise<File> {
  const { sx, sy, size } = sourceSquare(view);
  const output = Math.max(1, Math.min(1600, Math.round(size)));
  const canvas = document.createElement('canvas');
  canvas.width = output;
  canvas.height = output;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gagal memotong foto');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, output, output);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sx, sy, size, size, 0, 0, output, output);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Gagal memotong foto');
  const base = fileName.replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
