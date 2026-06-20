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
