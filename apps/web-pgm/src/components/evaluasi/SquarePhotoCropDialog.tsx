import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampOffset,
  displayedSize,
  fileFromSquareCrop,
  initialCropView,
  resizeCrop,
  zoomAround,
  type CropView,
} from '@/lib/squareCrop';

type SquarePhotoCropDialogProps = {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

type LoadedImage = {
  url: string;
  width: number;
  height: number;
};

export function SquarePhotoCropDialog({ file, onCancel, onConfirm }: SquarePhotoCropDialogProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const decodedRef = useRef<HTMLImageElement | null>(null);
  const viewRef = useRef<CropView | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const pinch = useRef<{ distance: number; view: CropView; anchorX: number; anchorY: number } | null>(null);
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [view, setView] = useState<CropView | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'saving'>('loading');
  const [error, setError] = useState('');

  viewRef.current = view;

  const updateView = (recipe: (current: CropView) => CropView) => {
    setView((current) => {
      if (!current) return current;
      const next = recipe(current);
      viewRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    setStatus('loading');
    setError('');
    setLoaded(null);
    setView(null);
    img
      .decode()
      .then(() => {
        if (cancelled) return;
        if (img.naturalWidth < 1 || img.naturalHeight < 1) {
          setStatus('error');
          setError('Foto tidak bisa dibaca. Gunakan JPG atau PNG.');
          return;
        }
        decodedRef.current = img;
        setLoaded({ url, width: img.naturalWidth, height: img.naturalHeight });
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
        setError('Foto tidak bisa dibaca. Gunakan JPG atau PNG.');
      });
    return () => {
      cancelled = true;
      if (decodedRef.current === img) decodedRef.current = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !loaded) return;
    const apply = () => {
      const crop = frame.clientWidth;
      if (crop < 8) return;
      setView((current) => {
        const next =
          !current || current.naturalWidth !== loaded.width || current.naturalHeight !== loaded.height
            ? initialCropView(crop, loaded.width, loaded.height)
            : resizeCrop(current, crop);
        viewRef.current = next;
        return next;
      });
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [loaded]);

  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && status !== 'saving') onCancelRef.current();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [status]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = viewRef.current;
      if (!current || status !== 'ready') return;
      const factor = event.deltaY > 0 ? 0.92 : 1.08;
      updateView((value) => zoomAround(value, value.zoom * factor, value.crop / 2, value.crop / 2));
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [status, loaded]);

  const display = view ? displayedSize(view) : null;

  const pointInFrame = (clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (status !== 'ready' || !viewRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const anchor = pointInFrame((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        view: viewRef.current,
        anchorX: anchor.x,
        anchorY: anchor.y,
      };
      drag.current = null;
      return;
    }
    pinch.current = null;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: viewRef.current.offsetX,
      offsetY: viewRef.current.offsetY,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const start = pinch.current;
      const nextZoom = start.view.zoom * (distance / start.distance);
      updateView(() => zoomAround(start.view, nextZoom, start.anchorX, start.anchorY));
      return;
    }
    const activeDrag = drag.current;
    if (!activeDrag || pointers.current.size !== 1) return;
    const dx = event.clientX - activeDrag.x;
    const dy = event.clientY - activeDrag.y;
    updateView((current) => ({
      ...current,
      ...clampOffset({ ...current, offsetX: activeDrag.offsetX + dx, offsetY: activeDrag.offsetY + dy }),
    }));
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
    if (pointers.current.size === 1 && viewRef.current) {
      const remaining = [...pointers.current.values()][0];
      drag.current = {
        x: remaining.x,
        y: remaining.y,
        offsetX: viewRef.current.offsetX,
        offsetY: viewRef.current.offsetY,
      };
      return;
    }
    drag.current = null;
  };

  const confirm = async () => {
    const image = decodedRef.current;
    const current = viewRef.current;
    if (!image || !current || status !== 'ready') return;
    try {
      setStatus('saving');
      setError('');
      const cropped = await fileFromSquareCrop(image, current, file.name);
      onConfirm(cropped);
    } catch (err: unknown) {
      setStatus('ready');
      setError(err instanceof Error ? err.message : 'Gagal memotong foto');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={status === 'saving' ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="square-crop-title"
        className="my-auto w-full max-w-md rounded-2xl border bg-card p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-1">
          <h2 id="square-crop-title" className="text-lg font-semibold">
            Potong jadi persegi
          </h2>
          <p className="text-sm text-muted-foreground">
            Geser foto dan atur perbesaran. Kotak ini yang tersimpan untuk poster laporan.
          </p>
        </div>

        <div
          ref={frameRef}
          className="relative mt-4 aspect-square w-full cursor-grab touch-none overflow-hidden rounded-lg bg-muted active:cursor-grabbing"
          aria-label="Area geser foto"
          role="group"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          {loaded && display && view && (
            <img
              src={loaded.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
              style={{
                width: display.width,
                height: display.height,
                transform: `translate(${view.offsetX}px, ${view.offsetY}px)`,
              }}
            />
          )}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.75))' }}
          >
            <div className="absolute inset-3 border border-white/70" />
            <div className="absolute left-1/3 top-0 h-full w-px bg-white/45" />
            <div className="absolute left-2/3 top-0 h-full w-px bg-white/45" />
            <div className="absolute left-0 top-1/3 h-px w-full bg-white/45" />
            <div className="absolute left-0 top-2/3 h-px w-full bg-white/45" />
            <div className="absolute left-2 top-2 h-5 w-5 border-l-2 border-t-2 border-white" />
            <div className="absolute right-2 top-2 h-5 w-5 border-r-2 border-t-2 border-white" />
            <div className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-white" />
            <div className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-white" />
          </div>
          {status === 'loading' && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Memuat foto...</p>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={view?.zoom ?? MIN_ZOOM}
            aria-label="Perbesar"
            disabled={!view || status !== 'ready'}
            className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
            onChange={(event) => {
              const nextZoom = Number(event.target.value);
              updateView((current) => zoomAround(current, nextZoom, current.crop / 2, current.crop / 2));
            }}
          />
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="rounded-xl" disabled={status === 'saving'} onClick={onCancel}>
            Batal
          </Button>
          <Button type="button" className="rounded-xl" disabled={status !== 'ready'} onClick={() => void confirm()}>
            {status === 'saving' ? 'Memotong...' : 'Pakai foto'}
          </Button>
        </div>
      </div>
    </div>
  );
}
