export const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const;

export const MUTABAAH_OTHER_VALUE = '__other__';
export const MUTABAAH_OTHER_DEFAULT_LABEL = 'Lainnya';

export type MutabaahFieldType = 'CHECKBOX' | 'NUMBER' | 'TEXT' | 'SELECT';
export type MutabaahInputScope = 'WEEKLY' | 'DAILY';

export type MutabaahOption = { value: string; label: string };

export type MutabaahItemMaster = {
  id: string;
  level: string;
  title: string;
  description?: string | null;
  target?: string | null;
  fieldType: MutabaahFieldType;
  inputScope: MutabaahInputScope;
  options?: MutabaahOption[] | null;
  minValue?: number | null;
  maxValue?: number | null;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
  allowOther?: boolean;
  otherLabel?: string;
};

export type MutabaahSelectAnswer = { value: string; otherText?: string };

export type MutabaahAnswerValue =
  | { checked: boolean }
  | { days: (boolean | number | null)[] }
  | { value: number }
  | { text: string }
  | MutabaahSelectAnswer;

export type MutabaahFormItem = MutabaahItemMaster & {
  value: MutabaahAnswerValue | null;
  displayValue?: string;
};

export type MutabaahEntryData = {
  id: string | null;
  weekDate: string | null;
  isSubmitted: boolean;
  submittedAt?: string | null;
  items: MutabaahFormItem[];
};

export const FIELD_TYPE_LABELS: Record<MutabaahFieldType, string> = {
  CHECKBOX: 'Checkbox',
  NUMBER: 'Angka',
  TEXT: 'Teks bebas',
  SELECT: 'Pilihan',
};

export const INPUT_SCOPE_LABELS: Record<MutabaahInputScope, string> = {
  WEEKLY: 'Sekali per pekan',
  DAILY: 'Per hari (7 hari)',
};

export function emptyValueForItem(item: Pick<MutabaahItemMaster, 'fieldType' | 'inputScope'>): MutabaahAnswerValue {
  if (item.inputScope === 'DAILY') {
    if (item.fieldType === 'NUMBER') return { days: Array(7).fill(0) };
    return { days: Array(7).fill(false) };
  }
  switch (item.fieldType) {
    case 'CHECKBOX':
      return { checked: false };
    case 'NUMBER':
      return { value: 0 };
    case 'TEXT':
      return { text: '' };
    case 'SELECT':
      return { value: '', otherText: '' };
    default:
      return { text: '' };
  }
}

export function getDailyDays(
  item: Pick<MutabaahFormItem, 'fieldType'>,
  value: MutabaahAnswerValue | null | undefined,
): (boolean | number)[] {
  const isNumber = item.fieldType === 'NUMBER';
  const empty = isNumber ? Array<number>(7).fill(0) : Array<boolean>(7).fill(false);
  if (!value || typeof value !== 'object' || !('days' in value) || !Array.isArray(value.days)) {
    return empty;
  }
  return value.days.map((d) => (isNumber ? Number(d) || 0 : Boolean(d)));
}

/** Apakah satu jawaban mutabaah berisi data (bukan nilai kosong/default)? */
export function hasMutabaahAnswerValue(
  item: Pick<MutabaahItemMaster, 'fieldType' | 'inputScope'>,
  value: MutabaahAnswerValue | null | undefined,
): boolean {
  if (value == null || typeof value !== 'object') return false;

  if (item.inputScope === 'DAILY') {
    const days = getDailyDays(item, value);
    if (item.fieldType === 'NUMBER') return days.some((d) => Number(d) > 0);
    return days.some(Boolean);
  }

  switch (item.fieldType) {
    case 'CHECKBOX':
      return Boolean((value as { checked?: boolean }).checked);
    case 'NUMBER':
      return Number((value as { value?: number }).value ?? 0) !== 0;
    case 'TEXT':
      return Boolean(String((value as { text?: string }).text ?? '').trim());
    case 'SELECT':
      return Boolean(String((value as MutabaahSelectAnswer).value ?? '').trim());
    default:
      return false;
  }
}

export function hasMutabaahContent(
  items: Pick<MutabaahFormItem, 'fieldType' | 'inputScope' | 'value'>[],
): boolean {
  return items.some((item) => hasMutabaahAnswerValue(item, item.value));
}

export function formatAnswerDisplay(
  item: Pick<MutabaahItemMaster, 'fieldType' | 'inputScope' | 'options' | 'otherLabel'>,
  value: MutabaahAnswerValue | null | undefined,
): string {
  if (value == null || typeof value !== 'object') return '—';

  if (item.inputScope === 'DAILY' && 'days' in value && Array.isArray(value.days)) {
    const days = getDailyDays(item, value);
    if (item.fieldType === 'NUMBER') {
      const total = days.reduce((sum: number, d) => sum + (Number(d) || 0), 0);
      return String(total);
    }
    return `${days.filter(Boolean).length}/7`;
  }

  switch (item.fieldType) {
    case 'CHECKBOX':
      return (value as { checked?: boolean }).checked ? 'Ya' : 'Tidak';
    case 'NUMBER':
      return String((value as { value?: number }).value ?? 0);
    case 'TEXT':
      return String((value as { text?: string }).text || '—');
    case 'SELECT': {
      const raw = value as MutabaahSelectAnswer;
      const selected = String(raw?.value ?? '');
      if (selected === MUTABAAH_OTHER_VALUE) {
        const label = item.otherLabel || MUTABAAH_OTHER_DEFAULT_LABEL;
        return raw.otherText ? `${label}: ${raw.otherText}` : label;
      }
      const option = parseMutabaahOptions(item.options).find((o) => o.value === selected);
      return option?.label || selected || '—';
    }
    default:
      return '—';
  }
}

export function parseMutabaahOptions(raw: unknown): MutabaahOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (o): o is MutabaahOption =>
      typeof o === 'object' &&
      o !== null &&
      typeof (o as MutabaahOption).value === 'string' &&
      typeof (o as MutabaahOption).label === 'string',
  );
}
