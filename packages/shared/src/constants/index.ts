export const POINT_RULES = {
  PEMBINA_SUBMIT_EVALUATION: 10,
  PEMBINA_SUBMIT_EVALUATION_LATE: 5,
  PEMBINA_ATTEND_EVENT: 15,
  ANGGOTA_HADIR_PEMBINAAN: 5,
  ANGGOTA_ATTEND_EVENT: 10,
} as const;

export const ROLES = [
  'SUPERADMIN',
  'ADMIN',
  'PJ_SEKOLAH',
  'PEMBINA',
  'ANGGOTA',
] as const;

export const INVITATION_EXPIRE_DAYS = 7;

export const PAGINATION_DEFAULT = {
  page: 1,
  limit: 20,
} as const;

export const INVITATION_RULES: Record<string, string[]> = {
  SUPERADMIN: ['ADMIN', 'PJ_SEKOLAH', 'PEMBINA', 'ANGGOTA'],
  ADMIN: ['PJ_SEKOLAH', 'PEMBINA', 'ANGGOTA'],
  PJ_SEKOLAH: ['PEMBINA'],
  PEMBINA: ['ANGGOTA'],
};

export const SCHOOLS_DEPOK = [
  'SMAN 1 Depok',
  'SMAN 2 Depok',
  'SMAN 3 Depok',
  'SMAN 4 Depok',
  'SMAN 5 Depok',
  'SMAN 6 Depok',
  'SMAN 7 Depok',
  'SMAN 8 Depok',
  'SMAN 9 Depok',
  'SMAN 10 Depok',
  'SMAN 11 Depok',
  'SMAN 12 Depok',
  'SMAN 13 Depok',
  'SMAN 14 Depok',
  'SMAN 15 Depok',
  'SMAN 16 Depok',
  'SMAN 17 Depok',
  'SMAN 18 Depok',
  'SMAN 19 Depok',
  'SMAN 20 Depok',
  'SMAN 21 Depok',
  'SMAN 22 Depok',
  'SMAN 23 Depok',
  'SMAN 24 Depok',
  'SMAN 25 Depok',
  'SMAN 26 Depok',
  'SMAN 27 Depok',
  'SMAN 28 Depok',
  'SMAN 29 Depok',
  'SMAN 30 Depok',
  'SMAN 31 Depok',
  'SMAN 32 Depok',
  'SMAN 33 Depok',
  'SMAN 34 Depok',
  'SMAN 35 Depok',
];
