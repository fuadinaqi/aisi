export const IC_CATEGORIES = [
  'MANA_ASY_SYAHADAH',
  'MARIFATULLAH',
  'MARIFATUR_RASUL',
  'MARIFATUL_ISLAM',
  'MARIFATUL_INSAN',
  'MARIFATUL_QURAN',
  'FIQIH_USHUL_FIQIH',
  'KETATANEGARAAN',
  'LIFESKILLS',
  'ALQURAN_ULUMUL_QURAN',
  'HADITS_ULUMUL_HADITS',
  'AQIDAH_AKHLAK',
  'AL_HAQ_WAL_BATHIL',
  'QADHAYA_TAKWINUL_UMMAH',
  'DAKWAH_FIKRAH',
] as const;

export const IC_TYPES = ['PRIMER', 'SEKUNDER'] as const;

export type ICCategory = (typeof IC_CATEGORIES)[number];
export type ICType = (typeof IC_TYPES)[number];

export const IC_CATEGORIES_LEVEL_1 = [
  'MANA_ASY_SYAHADAH',
  'MARIFATULLAH',
  'MARIFATUR_RASUL',
  'MARIFATUL_ISLAM',
  'MARIFATUL_INSAN',
  'MARIFATUL_QURAN',
  'FIQIH_USHUL_FIQIH',
  'KETATANEGARAAN',
  'LIFESKILLS',
] as const satisfies readonly ICCategory[];

export const IC_CATEGORIES_LEVEL_2 = [
  'ALQURAN_ULUMUL_QURAN',
  'HADITS_ULUMUL_HADITS',
  'AQIDAH_AKHLAK',
  'FIQIH_USHUL_FIQIH',
  'AL_HAQ_WAL_BATHIL',
  'QADHAYA_TAKWINUL_UMMAH',
  'DAKWAH_FIKRAH',
  'KETATANEGARAAN',
  'LIFESKILLS',
] as const satisfies readonly ICCategory[];

export const IC_CATEGORIES_BY_LEVEL: Record<'LEVEL_1' | 'LEVEL_2', readonly ICCategory[]> = {
  LEVEL_1: IC_CATEGORIES_LEVEL_1,
  LEVEL_2: IC_CATEGORIES_LEVEL_2,
};

export const IC_CATEGORY_LABELS: Record<ICCategory, string> = {
  MANA_ASY_SYAHADAH: "A. Ma'na Asy-Syahadah",
  MARIFATULLAH: "B. Ma'rifatullah",
  MARIFATUR_RASUL: "C. Ma'rifatur Rasul",
  MARIFATUL_ISLAM: "D. Ma'rifatul Islam",
  MARIFATUL_INSAN: "E. Ma'rifatul Insan",
  MARIFATUL_QURAN: "F. Ma'rifatul Qur'an",
  FIQIH_USHUL_FIQIH: 'G. Fiqih dan Ushul Fiqih',
  KETATANEGARAAN: 'H. Ketatanegaraan',
  LIFESKILLS: 'I. Lifeskills',
  ALQURAN_ULUMUL_QURAN: "A. Al-Qur'an dan Ulumul Qur'an",
  HADITS_ULUMUL_HADITS: 'B. Hadits dan Ulumul Hadits',
  AQIDAH_AKHLAK: 'C. Aqidah dan Akhlak',
  AL_HAQ_WAL_BATHIL: 'E. Al-Haq wal-Bathil',
  QADHAYA_TAKWINUL_UMMAH: 'F. Qadhaya dan Takwinul Ummah',
  DAKWAH_FIKRAH: 'G. Dakwah dan Fikrah',
};

export const IC_CATEGORY_LABELS_BY_LEVEL: Record<'LEVEL_1' | 'LEVEL_2', Partial<Record<ICCategory, string>>> = {
  LEVEL_1: {
    MANA_ASY_SYAHADAH: "A. Ma'na Asy-Syahadah",
    MARIFATULLAH: "B. Ma'rifatullah",
    MARIFATUR_RASUL: "C. Ma'rifatur Rasul",
    MARIFATUL_ISLAM: "D. Ma'rifatul Islam",
    MARIFATUL_INSAN: "E. Ma'rifatul Insan",
    MARIFATUL_QURAN: "F. Ma'rifatul Qur'an",
    FIQIH_USHUL_FIQIH: 'G. Fiqih dan Ushul Fiqih',
    KETATANEGARAAN: 'H. Ketatanegaraan',
    LIFESKILLS: 'I. Lifeskills',
  },
  LEVEL_2: {
    ALQURAN_ULUMUL_QURAN: "A. Al-Qur'an dan Ulumul Qur'an",
    HADITS_ULUMUL_HADITS: 'B. Hadits dan Ulumul Hadits',
    AQIDAH_AKHLAK: 'C. Aqidah dan Akhlak',
    FIQIH_USHUL_FIQIH: 'D. Fiqih dan Ushul Fiqih',
    AL_HAQ_WAL_BATHIL: 'E. Al-Haq wal-Bathil',
    QADHAYA_TAKWINUL_UMMAH: 'F. Qadhaya dan Takwinul Ummah',
    DAKWAH_FIKRAH: 'G. Dakwah dan Fikrah',
    KETATANEGARAAN: 'H. Ketatanegaraan',
    LIFESKILLS: 'I. Lifeskills',
  },
};

export const IC_TYPE_LABELS: Record<ICType, string> = {
  PRIMER: 'IC Primer',
  SEKUNDER: 'IC Sekunder',
};

export function getICCategoriesForLevel(level: 'LEVEL_1' | 'LEVEL_2'): readonly ICCategory[] {
  return IC_CATEGORIES_BY_LEVEL[level] ?? IC_CATEGORIES;
}

export function getICCategoryLabel(category: string, level?: 'LEVEL_1' | 'LEVEL_2'): string {
  if (level && IC_CATEGORY_LABELS_BY_LEVEL[level]?.[category as ICCategory]) {
    return IC_CATEGORY_LABELS_BY_LEVEL[level][category as ICCategory]!;
  }
  return IC_CATEGORY_LABELS[category as ICCategory] ?? category;
}

export type IndikatorCapaianMaster = {
  id: string;
  level: 'LEVEL_1' | 'LEVEL_2';
  category: ICCategory;
  type: ICType;
  number: number;
  title: string;
  materi: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type ICItemProgress = {
  id: string;
  number: number;
  title: string;
  materi: string | null;
  sortOrder: number;
  isAchieved: boolean;
  checkedAt: string | null;
  checkedByName: string | null;
};

export type MemberICResponse = {
  user: { id: string; name: string };
  group: { id: string; name: string; level: string };
  summary: {
    total: number;
    achieved: number;
    primerTotal: number;
    primerAchieved: number;
    sekunderTotal: number;
    sekunderAchieved: number;
  };
  categories: {
    category: ICCategory;
    label: string;
    types: {
      type: ICType;
      label: string;
      items: ICItemProgress[];
    }[];
  }[];
};

export function icProgressPercent(achieved: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((achieved / total) * 100);
}
