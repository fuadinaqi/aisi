export const MAX_ZOOM = 4;

export type CropMode = 'fit' | 'cover';

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

/** Zoom that fits the whole photo inside the square. 1 means the square is fully covered. */
export function minZoom(view: Pick<CropView, 'naturalWidth' | 'naturalHeight'>) {
  const long = Math.max(view.naturalWidth, view.naturalHeight);
  const short = Math.min(view.naturalWidth, view.naturalHeight);
  if (long <= 0 || short <= 0) return 1;
  return short / long;
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
    offsetX: clamp(view.offsetX, Math.min(view.crop - width, 0), Math.max(view.crop - width, 0)),
    offsetY: clamp(view.offsetY, Math.min(view.crop - height, 0), Math.max(view.crop - height, 0)),
  };
}

function centered(view: CropView): CropView {
  const { width, height } = displayedSize(view);
  const next: CropView = {
    ...view,
    offsetX: (view.crop - width) / 2,
    offsetY: (view.crop - height) / 2,
  };
  return { ...next, ...clampOffset(next) };
}

/** Whole photo inside the square, leftover area stays empty. */
export function fitView(view: CropView): CropView {
  return centered({ ...view, zoom: minZoom(view) });
}

/** Photo fills the square; the overflow is cropped. */
export function coverView(view: CropView): CropView {
  return centered({ ...view, zoom: 1 });
}

export function initialCropView(
  crop: number,
  naturalWidth: number,
  naturalHeight: number,
  mode: CropMode = 'fit',
): CropView {
  const base: CropView = {
    crop: Math.max(crop, 1),
    naturalWidth,
    naturalHeight,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  };
  return mode === 'cover' ? coverView(base) : fitView(base);
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

/** Zoom while keeping the image point under the anchor fixed. */
export function zoomAround(view: CropView, nextZoom: number, anchorX: number, anchorY: number): CropView {
  const zoom = clamp(nextZoom, minZoom(view), MAX_ZOOM);
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

export async function fileFromSquareCrop(image: CanvasImageSource, view: CropView, fileName: string): Promise<File> {
  const { scale, width, height } = displayedSize(view);
  const output = Math.max(1, Math.min(1600, Math.round(scale > 0 ? view.crop / scale : view.crop)));
  const canvas = document.createElement('canvas');
  canvas.width = output;
  canvas.height = output;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gagal memotong foto');
  const ratio = view.crop > 0 ? output / view.crop : 1;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, output, output);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, view.offsetX * ratio, view.offsetY * ratio, width * ratio, height * ratio);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Gagal memotong foto');
  const base = fileName.replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
