'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DAY_LABELS,
  MUTABAAH_OTHER_DEFAULT_LABEL,
  MUTABAAH_OTHER_VALUE,
  getDailyDays,
  type MutabaahAnswerValue,
  type MutabaahFormItem,
  type MutabaahSelectAnswer,
  parseMutabaahOptions,
} from '@/lib/mutabaah';
import { cn } from '@/lib/utils';

type Props = {
  item: MutabaahFormItem;
  value: MutabaahAnswerValue;
  disabled?: boolean;
  onChange: (value: MutabaahAnswerValue) => void;
};

function formatNumberInputValue(raw: number | null | undefined) {
  if (raw === null || raw === undefined) return '';
  if (raw === 0) return '';
  return String(raw);
}

function parseNumberInputValue(raw: string) {
  if (raw.trim() === '') return 0;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function asSelectValue(value: MutabaahAnswerValue): MutabaahSelectAnswer {
  if ('value' in value && typeof (value as MutabaahSelectAnswer).value === 'string') {
    return {
      value: (value as MutabaahSelectAnswer).value,
      otherText: (value as MutabaahSelectAnswer).otherText ?? '',
    };
  }
  return { value: '', otherText: '' };
}

export function MutabaahFieldInput({ item, value, disabled, onChange }: Props) {
  if (item.inputScope === 'DAILY') {
    const days = getDailyDays(item, value);

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((label, index) => (
            <div key={label} className="text-center">
              <p className="mb-1 text-[10px] font-medium text-muted-foreground">{label}</p>
              {item.fieldType === 'NUMBER' ? (
                <Input
                  type="number"
                  min={item.minValue ?? 0}
                  max={item.maxValue ?? undefined}
                  disabled={disabled}
                  className="h-9 px-1 text-center text-sm"
                  value={formatNumberInputValue(days[index] as number)}
                  onChange={(e) => {
                    const next = [...days];
                    next[index] = parseNumberInputValue(e.target.value);
                    onChange({ days: next });
                  }}
                />
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const next = [...days];
                    next[index] = !Boolean(days[index]);
                    onChange({ days: next });
                  }}
                  className={cn(
                    'flex h-9 w-full items-center justify-center rounded-lg border text-sm transition-colors',
                    days[index]
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground',
                    disabled && 'opacity-60',
                  )}
                >
                  {days[index] ? '✓' : '—'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  switch (item.fieldType) {
    case 'CHECKBOX':
      return (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3">
          <input
            type="checkbox"
            disabled={disabled}
            checked={Boolean((value as { checked?: boolean }).checked)}
            onChange={(e) => onChange({ checked: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm">Ya, target pekan ini tercapai</span>
        </label>
      );
    case 'NUMBER':
      return (
        <Input
          type="number"
          min={item.minValue ?? 0}
          max={item.maxValue ?? undefined}
          disabled={disabled}
          placeholder="0"
          value={formatNumberInputValue((value as { value?: number }).value)}
          onChange={(e) => onChange({ value: parseNumberInputValue(e.target.value) })}
        />
      );
    case 'TEXT':
      return (
        <textarea
          disabled={disabled}
          rows={3}
          value={String((value as { text?: string }).text ?? '')}
          onChange={(e) => onChange({ text: e.target.value })}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          placeholder="Tulis catatan..."
        />
      );
    case 'SELECT': {
      const options = parseMutabaahOptions(item.options);
      const selectValue = asSelectValue(value);
      const otherLabel = item.otherLabel?.trim() || MUTABAAH_OTHER_DEFAULT_LABEL;
      const showOtherInput = item.allowOther && selectValue.value === MUTABAAH_OTHER_VALUE;

      return (
        <div className="space-y-3">
          <select
            disabled={disabled}
            value={selectValue.value}
            onChange={(e) => {
              const next = e.target.value;
              onChange({
                value: next,
                otherText: next === MUTABAAH_OTHER_VALUE ? selectValue.otherText ?? '' : undefined,
              });
            }}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Pilih...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {item.allowOther && (
              <option value={MUTABAAH_OTHER_VALUE}>{otherLabel}</option>
            )}
          </select>
          {showOtherInput && (
            <Input
              disabled={disabled}
              value={selectValue.otherText ?? ''}
              onChange={(e) =>
                onChange({ value: MUTABAAH_OTHER_VALUE, otherText: e.target.value })
              }
              placeholder={`Tulis ${otherLabel.toLowerCase()}...`}
            />
          )}
        </div>
      );
    }
    default:
      return null;
  }
}

export function MutabaahFieldLabel({ item }: { item: MutabaahFormItem }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">
        {item.title}
        {item.isRequired && <span className="text-destructive"> *</span>}
      </Label>
      {item.target && <p className="text-xs text-muted-foreground">Target: {item.target}</p>}
      {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
    </div>
  );
}
