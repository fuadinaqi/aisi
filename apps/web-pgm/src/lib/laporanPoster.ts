import { toWeekDateParam } from '@/lib/utils';

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

const A4_WIDTH = 1654;
const A4_HEIGHT = 2339;
const SCRIPT_FONT = '"Alex Brush", cursive';

type Rect = { x: number; y: number; w: number; h: number };
type Drawable = CanvasImageSource & { width: number; height: number };

export type LaporanPosterInput = {
  schoolName: string;
  monthLabel: string;
  weekLabel: string;
  photos: Drawable[];
  template: Drawable | null;
};

/** Bulan dan nomor pekan mengikuti Kamis pada pekan itu, misalnya September · Pekan-4. */
export function weekPosterMeta(date: string | Date): { monthLabel: string; weekLabel: string } {
  const mondayParam = toWeekDateParam(date);
  const [y, m, d] = mondayParam.split('-').map(Number);
  const thursday = new Date(Date.UTC(y, m - 1, d + 3));
  const pekan = Math.ceil(thursday.getUTCDate() / 7);
  return {
    monthLabel: `${MONTHS[thursday.getUTCMonth()]} ${thursday.getUTCFullYear()}`,
    weekLabel: `Pekan-${pekan}`,
  };
}

export function posterFileName(schoolName: string, monthLabel: string, weekLabel: string): string {
  const slug = [schoolName, monthLabel, weekLabel]
    .join('-')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `laporan-${slug || 'pgm'}.png`;
}

export async function buildLaporanPoster(input: LaporanPosterInput): Promise<Blob> {
  await document.fonts.load(`400 96px ${SCRIPT_FONT}`);
  const canvas = document.createElement('canvas');
  canvas.width = A4_WIDTH;
  canvas.height = A4_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawPoster(ctx, canvas.width, canvas.height, input);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Gagal membuat gambar poster');
  return blob;
}

function drawPoster(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  input: LaporanPosterInput,
) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  if (input.template) drawCover(ctx, input.template, { x: 0, y: 0, w, h });

  const hasTemplate = Boolean(input.template);
  const padX = w * (hasTemplate ? 0.075 : 0.06);
  const photoTop = hasTemplate ? h * 0.31 : h * 0.22;
  const photoBottom = h * (hasTemplate ? 0.07 : 0.045);
  drawLabels(ctx, w, h, input, hasTemplate);

  const area: Rect = { x: padX, y: photoTop, w: w - padX * 2, h: h - photoTop - photoBottom };
  const gap = Math.max(10, w * 0.012);
  const slots = squareSlots(input.photos.length, area, gap);
  input.photos.forEach((photo, i) => {
    const slot = slots[i];
    if (!slot) return;
    drawContainSquare(ctx, photo, slot);
  });
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  input: LaporanPosterInput,
  hasTemplate: boolean,
) {
  const color = hasTemplate ? '#FFFFFF' : '#2C241C';
  const [monthName, monthYear] = input.monthLabel.split(' ');
  const monthLines = [monthName, monthYear].filter((line): line is string => Boolean(line));
  const monthSize = fitSize(
    ctx,
    monthLines.reduce((longest, line) => (line.length > longest.length ? line : longest), ''),
    w * 0.24,
    Math.round(h * 0.046),
    36,
    400,
    SCRIPT_FONT,
  );
  drawScript(ctx, monthLines, {
    x: w * 0.97,
    y: h * 0.02,
    align: 'right',
    size: monthSize,
    color,
    shadow: hasTemplate,
  });

  const weekSize = fitSize(ctx, input.weekLabel, w * 0.22, Math.round(h * 0.046), 34, 400, SCRIPT_FONT);
  const weekTop = h * (hasTemplate ? 0.136 : 0.012);
  drawScript(ctx, [input.weekLabel], {
    x: w * 0.035,
    y: weekTop,
    align: 'left',
    size: weekSize,
    color,
    shadow: hasTemplate,
  });

  if (!hasTemplate) {
    const schoolSize = fitSize(ctx, input.schoolName, w * 0.7, Math.round(h * 0.05), 32, 400, SCRIPT_FONT);
    drawScript(ctx, [input.schoolName], {
      x: w * 0.04,
      y: weekTop + weekSize * 1.15,
      align: 'left',
      size: schoolSize,
      color,
      shadow: false,
    });
  }
}

function drawScript(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  text: { x: number; y: number; align: 'left' | 'right'; size: number; color: string; shadow: boolean },
) {
  ctx.save();
  ctx.font = `400 ${text.size}px ${SCRIPT_FONT}`;
  ctx.fillStyle = text.color;
  ctx.textAlign = text.align;
  ctx.textBaseline = 'top';
  if (text.shadow) {
    ctx.shadowColor = 'rgba(20, 16, 48, 0.45)';
    ctx.shadowBlur = text.size * 0.08;
    ctx.shadowOffsetY = text.size * 0.025;
  }
  const lineH = text.size * 0.92;
  lines.forEach((line, index) => ctx.fillText(line, text.x, text.y + lineH * index));
  ctx.restore();
}
/** Equal squares, largest that fit, centered. A short last row is centered too. */
function squareSlots(count: number, area: Rect, gap: number): Rect[] {
  if (count <= 0 || area.w <= 0 || area.h <= 0) return [];
  let bestCols = 1;
  let bestCell = 0;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cellW = (area.w - gap * (cols - 1)) / cols;
    const cellH = (area.h - gap * (rows - 1)) / rows;
    const cell = Math.min(cellW, cellH);
    if (cell > bestCell) {
      bestCell = cell;
      bestCols = cols;
    }
  }
  const cell = Math.max(1, bestCell);
  const cols = bestCols;
  const rows = Math.ceil(count / cols);
  const gridW = cols * cell + gap * (cols - 1);
  const gridH = rows * cell + gap * (rows - 1);
  const originX = area.x + (area.w - gridW) / 2;
  const originY = area.y + (area.h - gridH) / 2;
  const slots: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const rowCount = Math.min(cols, count - row * cols);
    const rowW = rowCount * cell + gap * Math.max(0, rowCount - 1);
    const rowX = originX + (gridW - rowW) / 2;
    slots.push({
      x: rowX + col * (cell + gap),
      y: originY + row * (cell + gap),
      w: cell,
      h: cell,
    });
  }
  return slots;
}

/** Fit the whole photo inside the square. Leftover space is black, nothing is cropped. */
function drawContainSquare(ctx: CanvasRenderingContext2D, img: Drawable, rect: Rect) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (img.width <= 0 || img.height <= 0) return;
  const scale = Math.min(rect.w / img.width, rect.h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, rect.x + (rect.w - dw) / 2, rect.y + (rect.h - dh) / 2, dw, dh);
}

function drawCover(ctx: CanvasRenderingContext2D, img: Drawable, rect: Rect) {
  const ir = img.width / img.height;
  const r = rect.w / rect.h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > r) {
    sw = img.height * r;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / r;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
}

function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  min: number,
  weight: number,
  family: string,
) {
  let next = size;
  ctx.font = `${weight} ${next}px ${family}`;
  while (next > min && ctx.measureText(text).width > maxWidth) {
    next -= 2;
    ctx.font = `${weight} ${next}px ${family}`;
  }
  return next;
}

