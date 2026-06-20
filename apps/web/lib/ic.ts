export const IC_CATEGORIES = [
  'KEAGAMAAN',
  'KEBANGSAAN',
  'KEMASYARAKATAN',
  'KEORGANISASIAN',
  'KEPEMIMPINAN_KEWIRAUSAHAAN',
] as const;

export const IC_TYPES = ['PRIMER', 'SEKUNDER'] as const;

export type ICCategory = (typeof IC_CATEGORIES)[number];
export type ICType = (typeof IC_TYPES)[number];

export const IC_CATEGORY_LABELS: Record<ICCategory, string> = {
  KEAGAMAAN: 'A. Keagamaan',
  KEBANGSAAN: 'B. Kebangsaan',
  KEMASYARAKATAN: 'C. Kemasyarakatan',
  KEORGANISASIAN: 'D. Keorganisasian',
  KEPEMIMPINAN_KEWIRAUSAHAAN: 'E. Kepemimpinan Kewirausahaan',
};

export const IC_TYPE_LABELS: Record<ICType, string> = {
  PRIMER: 'IC Primer',
  SEKUNDER: 'IC Sekunder',
};

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
