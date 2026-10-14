import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format tanggal lokal untuk input type="date" (YYYY-MM-DD) */
export function toDateInputValue(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Ambil komponen tanggal kalender WIB (selaras dengan API) */
function getWibCalendarParts(input: Date | string): { year: number; month: number; day: number } {
  let instant: number;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    instant = Date.UTC(y, m - 1, d) - WIB_OFFSET_MS;
  } else {
    instant = new Date(input).getTime();
  }
  const wib = new Date(instant + WIB_OFFSET_MS);
  return {
    year: wib.getUTCFullYear(),
    month: wib.getUTCMonth() + 1,
    day: wib.getUTCDate(),
  };
}

/** Normalisasi weekDate ke YYYY-MM-DD (Senin pekan, WIB) untuk query API */
export function toWeekDateParam(date: string | Date): string {
  const { year, month, day } = getWibCalendarParts(date);
  const wib = new Date(Date.UTC(year, month - 1, day));
  const dow = wib.getUTCDay();
  const mondayDay = day - dow + (dow === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(year, month - 1, mondayDay));
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Label rentang pekan (Sen–Min) dalam WIB */
export function formatWeekRange(date: string | Date): string {
  const mondayParam = toWeekDateParam(date);
  const [y, m, d] = mondayParam.split('-').map(Number);
  const monday = new Date(Date.UTC(y, m - 1, d) - WIB_OFFSET_MS);
  const sunday = new Date(Date.UTC(y, m - 1, d + 6) - WIB_OFFSET_MS);
  const startOpts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  };
  const endOpts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  };
  return `${monday.toLocaleDateString('id-ID', startOpts)} – ${sunday.toLocaleDateString('id-ID', endOpts)}`;
}

export function toDateTimeLocalValue(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function getMediaUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:4001/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

const UUID_FILENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[^.]+)?$/i;

function extFromName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
}

/** Nama file untuk ditampilkan. Fallback jika storage hanya menyimpan UUID. */
export function fileDisplayName(url: string, originalName?: string | null, index = 0): string {
  const trimmed = originalName?.trim() || '';
  let raw = url.split('?')[0]?.split('/').pop() || '';
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* pakai raw */
  }
  if (trimmed && !UUID_FILENAME.test(trimmed)) return trimmed;
  if (raw && !UUID_FILENAME.test(raw)) return raw;
  const ext = extFromName(trimmed) || extFromName(raw);
  return `File ${index + 1}${ext}`;
}

/** Tambah query filename untuk unduhan lokal (/uploads) agar nama asli dipakai. */
export function withDownloadFilename(url: string | null, filename: string): string | null {
  if (!url) return null;
  if (!url.includes('/uploads/') || !filename.trim()) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}filename=${encodeURIComponent(filename)}`;
}

export function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    SUPERADMIN: 'Super Admin',
    ADMIN: 'Admin',
    PJ_SEKOLAH: 'Pengurus PGM',
    PEMBINA: 'Pembina',
    ANGGOTA: 'Anggota',
  };
  return labels[role] || role;
}

export function getGenderLabel(gender: string) {
  return gender === 'AKHWAT' ? 'Akhwat' : 'Ikhwan';
}

export function pembinaSchoolHint(p: { inSchool?: boolean; hasAnySchool?: boolean }) {
  if (p.inSchool) return '';
  if (p.hasAnySchool) return ' · dari PGM lain';
  return ' · belum terikat PGM';
}

export function getPrimaryRole(roles: string[]): string {
  const priority = ['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA', 'ANGGOTA'];
  for (const r of priority) {
    if (roles.includes(r)) return r;
  }
  return roles[0] || 'ANGGOTA';
}

export function isPointEligibleRole(roles: string[]): boolean {
  return roles.some((r) => r === 'PEMBINA' || r === 'ANGGOTA');
}

export function formatEventTargetLevels(
  targetLevels: string[] | undefined,
  labels: Record<string, string>,
  forAnggota = false,
) {
  if (!targetLevels?.length) return forAnggota ? 'Semua kelompok' : 'Semua level';
  return targetLevels.map((level) => labels[level] || level).join(', ');
}

export function formatEventTargetGender(targetGender?: string | null) {
  if (targetGender === 'AKHWAT') return 'Akhwat saja';
  if (targetGender === 'IKHWAN') return 'Ikhwan saja';
  return 'Ikhwan & Akhwat';
}

/** Normalisasi nomor HP ke format wa.me (62...) */
/** Normalisasi ke 628… ; null jika bukan nomor HP Indonesia yang valid. */
export function formatWhatsAppPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  else if (!digits.startsWith('62')) return null;
  // 628xxxxxxxxx — total 11–15 digit
  if (digits.length < 11 || digits.length > 15) return null;
  if (!digits.startsWith('628')) return null;
  return digits;
}

export function isValidWhatsAppPhone(phone?: string | null): boolean {
  return !!phone && !!formatWhatsAppPhone(phone);
}

export function getWhatsAppUrl(phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  const formatted = formatWhatsAppPhone(phone);
  return formatted ? `https://wa.me/${formatted}` : null;
}
