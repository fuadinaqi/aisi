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
