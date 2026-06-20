'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { MutabaahOption } from '@/lib/mutabaah';
import { MUTABAAH_OTHER_DEFAULT_LABEL } from '@/lib/mutabaah';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type OptionRow = { label: string; value: string };

export type MutabaahOptionsFormState = {
  options: OptionRow[];
  allowOther: boolean;
  otherLabel: string;
};

type Props = {
  value: MutabaahOptionsFormState;
  onChange: (value: MutabaahOptionsFormState) => void;
};

function slugifyValue(label: string) {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '') || 'opsi'
  );
}

export function normalizeMutabaahOptions(rows: OptionRow[]): MutabaahOption[] {
  return rows
    .filter((row) => row.label.trim())
    .map((row) => ({
      label: row.label.trim(),
      value: row.value.trim() || slugifyValue(row.label),
    }));
}

export function optionsToFormState(
  options?: MutabaahOption[] | null,
  allowOther?: boolean,
  otherLabel?: string | null,
): MutabaahOptionsFormState {
  return {
    options: options?.length ? options.map((o) => ({ label: o.label, value: o.value })) : [{ label: '', value: '' }],
    allowOther: allowOther ?? false,
    otherLabel: otherLabel?.trim() || MUTABAAH_OTHER_DEFAULT_LABEL,
  };
}

export function MutabaahOptionsEditor({ value, onChange }: Props) {
  const { options, allowOther, otherLabel } = value;

  const patch = (partial: Partial<MutabaahOptionsFormState>) => {
    onChange({ ...value, ...partial });
  };

  const updateRow = (index: number, rowPatch: Partial<OptionRow>) => {
    patch({
      options: options.map((row, i) => (i === index ? { ...row, ...rowPatch } : row)),
    });
  };

  const addRow = () => {
    patch({ options: [...options, { label: '', value: '' }] });
  };

  const removeRow = (index: number) => {
    if (options.length <= 1) {
      patch({ options: [{ label: '', value: '' }] });
      return;
    }
    patch({ options: options.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Daftar pilihan</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Isi teks yang dilihat anggota. Kode internal opsional — kosongkan agar otomatis dari label.
        </p>
      </div>

      <div className="space-y-2">
        {options.map((row, index) => (
          <div key={index} className="flex gap-2">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <Input
                placeholder="Teks pilihan, mis. Baik"
                value={row.label}
                onChange={(e) => updateRow(index, { label: e.target.value })}
              />
              <Input
                placeholder="Kode (opsional)"
                value={row.value}
                onChange={(e) => updateRow(index, { value: e.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(index)}
              aria-label="Hapus pilihan"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={addRow}>
        <Plus className="mr-1 h-4 w-4" />
        Tambah pilihan
      </Button>

      <div className="rounded-xl border border-border/60 p-4 space-y-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={allowOther}
            onChange={(e) => patch({ allowOther: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <div>
            <span className="text-sm font-medium">Sertakan opsi &quot;Lainnya&quot;</span>
            <p className="text-xs text-muted-foreground">
              Anggota bisa memilih Lainnya lalu mengetik jawaban bebas.
            </p>
          </div>
        </label>
        {allowOther && (
          <div className="space-y-2 pl-7">
            <Label className="text-xs">Label opsi Lainnya</Label>
            <Input
              value={otherLabel}
              onChange={(e) => patch({ otherLabel: e.target.value })}
              placeholder={MUTABAAH_OTHER_DEFAULT_LABEL}
            />
          </div>
        )}
      </div>
    </div>
  );
}
