export type SeedUser = {
  role: 'SUPERADMIN' | 'ADMIN' | 'PJ_SEKOLAH' | 'PEMBINA' | 'ANGGOTA';
  email: string;
  password: string;
  label: string;
};

/** Akun dari packages/shared/prisma/seed.ts */
export const USERS = {
  superadmin: {
    role: 'SUPERADMIN',
    email: 'fuadinaqi@gmail.com',
    password: '!Superadmin123',
    label: 'Superadmin',
  },
  admin: {
    role: 'ADMIN',
    email: 'fuadiproject@gmail.com',
    password: '!Admin123',
    label: 'Admin',
  },
  pj: {
    role: 'PJ_SEKOLAH',
    email: 'usamah_sman1@gmail.com',
    password: '!Password123',
    label: 'PJ Sekolah',
  },
  pembina: {
    role: 'PEMBINA',
    email: 'budi.santoso.sman1.pembina@gmail.com',
    password: '!Password123',
    label: 'Pembina',
  },
  anggota: {
    role: 'ANGGOTA',
    email: 'ahmad.fauzi.sman1.g1@gmail.com',
    password: '!Password123',
    label: 'Anggota',
  },
  /** Default activeRole = PEMBINA (prioritas lebih tinggi) */
  multiRole: {
    role: 'PEMBINA',
    email: 'multi.role.sman1@gmail.com',
    password: '!Password123',
    label: 'Multi-role PEMBINA+ANGGOTA',
  },
} as const satisfies Record<string, SeedUser>;

export const SEED_INVITE_TOKEN = '00000000-0000-4000-8000-000000000001';
export const SEED_ACCEPT_ROLE_TOKEN = '00000000-0000-4000-8000-000000000002';
export const SEED_SCHOOL_NAME = 'SMAN 1';

export const NAV_BY_ROLE: Record<SeedUser['role'], { href: string; label: string }[]> = {
  SUPERADMIN: [
    { href: '/dashboard', label: 'Beranda' },
    { href: '/schools', label: 'Sekolah' },
    { href: '/users', label: 'Pengguna' },
    { href: '/invitations', label: 'Undangan' },
    { href: '/events', label: 'Agenda' },
    { href: '/materi', label: 'Materi' },
    { href: '/analytics', label: 'Analitik' },
    { href: '/kks', label: 'KKS' },
    { href: '/config', label: 'Pengaturan' },
    { href: '/notifications', label: 'Notifikasi' },
    { href: '/profile', label: 'Profil' },
  ],
  ADMIN: [
    { href: '/dashboard', label: 'Beranda' },
    { href: '/schools', label: 'Sekolah' },
    { href: '/events', label: 'Agenda' },
    { href: '/materi', label: 'Materi' },
    { href: '/analytics', label: 'Analitik' },
    { href: '/kks', label: 'KKS' },
    { href: '/config', label: 'Pengaturan' },
    { href: '/notifications', label: 'Notifikasi' },
    { href: '/profile', label: 'Profil' },
  ],
  PJ_SEKOLAH: [
    { href: '/dashboard', label: 'Beranda' },
    { href: '/schools', label: 'Sekolah' },
    { href: '/pembina', label: 'Pembina' },
    { href: '/config/ic', label: 'Indikator Capaian' },
    { href: '/events', label: 'Agenda' },
    { href: '/materi', label: 'Materi' },
    { href: '/analytics', label: 'Analitik' },
    { href: '/kks', label: 'KKS' },
    { href: '/notifications', label: 'Notifikasi' },
    { href: '/profile', label: 'Profil' },
  ],
  PEMBINA: [
    { href: '/dashboard', label: 'Beranda' },
    { href: '/evaluasi', label: 'Evaluasi' },
    { href: '/config/ic', label: 'Indikator Capaian' },
    { href: '/events', label: 'Agenda' },
    { href: '/materi', label: 'Materi' },
    { href: '/kks', label: 'KKS' },
    { href: '/notifications', label: 'Notifikasi' },
    { href: '/profile', label: 'Profil' },
  ],
  ANGGOTA: [
    { href: '/dashboard', label: 'Beranda' },
    { href: '/mutabaah', label: 'Mutabaah' },
    { href: '/events', label: 'Agenda' },
    { href: '/kks', label: 'KKS' },
    { href: '/notifications', label: 'Notifikasi' },
    { href: '/profile', label: 'Profil' },
  ],
};
