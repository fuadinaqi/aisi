export const IC_CATEGORIES = [
  'KEAGAMAAN',
  'KEBANGSAAN',
  'KEMASYARAKATAN',
  'KEORGANISASIAN',
  'KEPEMIMPINAN_KEWIRAUSAHAAN',
] as const;

export const IC_TYPES = ['PRIMER', 'SEKUNDER'] as const;

export const IC_CATEGORY_LABELS: Record<(typeof IC_CATEGORIES)[number], string> = {
  KEAGAMAAN: 'A. Keagamaan',
  KEBANGSAAN: 'B. Kebangsaan',
  KEMASYARAKATAN: 'C. Kemasyarakatan',
  KEORGANISASIAN: 'D. Keorganisasian',
  KEPEMIMPINAN_KEWIRAUSAHAAN: 'E. Kepemimpinan Kewirausahaan',
};

export const IC_TYPE_LABELS: Record<(typeof IC_TYPES)[number], string> = {
  PRIMER: 'IC Primer',
  SEKUNDER: 'IC Sekunder',
};
