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
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

export function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    SUPERADMIN: 'Super Admin',
    ADMIN: 'Admin',
    PJ_SEKOLAH: 'PJ Sekolah',
    PEMBINA: 'Pembina',
    ANGGOTA: 'Anggota',
  };
  return labels[role] || role;
}

export function getGenderLabel(gender: string) {
  return gender === 'AKHWAT' ? 'Akhwat' : 'Ikhwan';
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
) {
  if (!targetLevels?.length) return 'Semua level';
  return targetLevels.map((level) => labels[level] || level).join(', ');
}

/** Normalisasi nomor HP ke format wa.me (62...) */
export function formatWhatsAppPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  return digits;
}

export function getWhatsAppUrl(phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  const formatted = formatWhatsAppPhone(phone);
  return formatted ? `https://wa.me/${formatted}` : null;
}
