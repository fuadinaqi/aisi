import type { MutabaahFieldType, MutabaahInputScope, MutabaahItem } from '@prisma/client';
import { MUTABAAH_OTHER_DEFAULT_LABEL, MUTABAAH_OTHER_VALUE } from '@dakwah/shared';
import { AppError } from '../../utils/AppError.js';

export const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const;

export type MutabaahSelectAnswer = { value: string; otherText?: string };

export type MutabaahAnswerValue =
  | { checked: boolean }
  | { days: (boolean | number | null)[] }
  | { value: number }
  | { text: string }
  | MutabaahSelectAnswer;

type MutabaahItemFields = Pick<
  MutabaahItem,
  | 'fieldType'
  | 'inputScope'
  | 'options'
  | 'minValue'
  | 'maxValue'
  | 'isRequired'
  | 'title'
  | 'allowOther'
  | 'otherLabel'
>;

export function emptyValueForItem(item: Pick<MutabaahItem, 'fieldType' | 'inputScope'>): MutabaahAnswerValue {
  if (item.inputScope === 'DAILY') {
    if (item.fieldType === 'NUMBER') {
      return { days: Array(7).fill(0) };
    }
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

export function validateAnswerValue(item: MutabaahItemFields, value: unknown): MutabaahAnswerValue {
  if (item.inputScope === 'DAILY') {
    if (!value || typeof value !== 'object' || !('days' in value) || !Array.isArray((value as { days: unknown }).days)) {
      throw new AppError(400, `Format jawaban harian tidak valid untuk "${item.title}"`);
    }
    const days = (value as { days: unknown[] }).days;
    if (days.length !== 7) {
      throw new AppError(400, `Jawaban harian harus 7 hari untuk "${item.title}"`);
    }

    if (item.fieldType === 'NUMBER') {
      const parsed = days.map((d) => {
        if (d === null || d === '') return 0;
        const n = Number(d);
        if (Number.isNaN(n)) throw new AppError(400, `Nilai harian tidak valid untuk "${item.title}"`);
        return n;
      });
      for (const n of parsed) {
        if (item.minValue !== null && item.minValue !== undefined && n < item.minValue) {
          throw new AppError(400, `Nilai minimum ${item.minValue} untuk "${item.title}"`);
        }
        if (item.maxValue !== null && item.maxValue !== undefined && n > item.maxValue) {
          throw new AppError(400, `Nilai maksimum ${item.maxValue} untuk "${item.title}"`);
        }
      }
      if (item.isRequired && parsed.every((n) => n === 0)) {
        throw new AppError(400, `"${item.title}" wajib diisi`);
      }
      return { days: parsed };
    }

    const parsed = days.map((d) => Boolean(d));
    if (item.isRequired && parsed.every((d) => !d)) {
      throw new AppError(400, `"${item.title}" wajib diisi`);
    }
    return { days: parsed };
  }

  switch (item.fieldType) {
    case 'CHECKBOX': {
      const checked = Boolean((value as { checked?: boolean })?.checked);
      if (item.isRequired && !checked) {
        throw new AppError(400, `"${item.title}" wajib dicentang`);
      }
      return { checked };
    }
    case 'NUMBER': {
      const num = Number((value as { value?: unknown })?.value);
      if (Number.isNaN(num)) throw new AppError(400, `Nilai angka tidak valid untuk "${item.title}"`);
      if (item.minValue !== null && item.minValue !== undefined && num < item.minValue) {
        throw new AppError(400, `Nilai minimum ${item.minValue} untuk "${item.title}"`);
      }
      if (item.maxValue !== null && item.maxValue !== undefined && num > item.maxValue) {
        throw new AppError(400, `Nilai maksimum ${item.maxValue} untuk "${item.title}"`);
      }
      if (item.isRequired && num === 0) {
        throw new AppError(400, `"${item.title}" wajib diisi`);
      }
      return { value: num };
    }
    case 'TEXT': {
      const text = String((value as { text?: unknown })?.text ?? '').trim();
      if (item.isRequired && !text) {
        throw new AppError(400, `"${item.title}" wajib diisi`);
      }
      return { text };
    }
    case 'SELECT': {
      const raw = value as MutabaahSelectAnswer;
      const selected = String(raw?.value ?? '');
      const otherText = String(raw?.otherText ?? '').trim();
      const options = parseOptions(item.options);
      const validValues = new Set(options.map((o) => o.value));
      if (item.allowOther) validValues.add(MUTABAAH_OTHER_VALUE);

      if (item.isRequired && !selected) {
        throw new AppError(400, `"${item.title}" wajib dipilih`);
      }
      if (selected && !validValues.has(selected)) {
        throw new AppError(400, `Pilihan tidak valid untuk "${item.title}"`);
      }
      if (selected === MUTABAAH_OTHER_VALUE) {
        if (item.isRequired && !otherText) {
          throw new AppError(400, `"${item.title}": isian Lainnya wajib diisi`);
        }
        return { value: MUTABAAH_OTHER_VALUE, ...(otherText ? { otherText } : {}) };
      }
      return { value: selected };
    }
    default:
      throw new AppError(400, 'Tipe field tidak dikenal');
  }
}

export function formatAnswerDisplay(
  item: Pick<MutabaahItem, 'fieldType' | 'inputScope' | 'options' | 'allowOther' | 'otherLabel'>,
  value: unknown,
): string {
  if (!value || typeof value !== 'object') return '—';

  if (item.inputScope === 'DAILY' && 'days' in value && Array.isArray((value as { days: unknown[] }).days)) {
    const days = (value as { days: (boolean | number | null)[] }).days;
    if (item.fieldType === 'NUMBER') {
      const total = days.reduce((sum: number, d) => sum + (Number(d) || 0), 0);
      const daily = days.map((d, i) => `${DAY_LABELS[i]}:${Number(d) || 0}`).join(' ');
      return `${total} total (${daily})`;
    }
    const count = days.filter(Boolean).length;
    const daily = days.map((d, i) => `${DAY_LABELS[i]}:${d ? '✓' : '—'}`).join(' ');
    return `${count}/7 hari (${daily})`;
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
      const option = parseOptions(item.options).find((o) => o.value === selected);
      return option?.label || selected || '—';
    }
    default:
      return '—';
  }
}

export function parseOptions(raw: unknown): { value: string; label: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (o): o is { value: string; label: string } =>
        typeof o === 'object' &&
        o !== null &&
        'value' in o &&
        'label' in o &&
        typeof (o as { value: unknown }).value === 'string' &&
        typeof (o as { label: unknown }).label === 'string',
    )
    .map((o) => ({ value: o.value, label: o.label }));
}

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
