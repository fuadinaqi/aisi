'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import {
  FIELD_TYPE_LABELS,
  INPUT_SCOPE_LABELS,
  type MutabaahFieldType,
  type MutabaahInputScope,
  type MutabaahItemMaster,
} from '@/lib/mutabaah';
import { invalidateMutabaahQueries } from '@/lib/queryInvalidation';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSkeleton } from '@/components/shared/Badges';
import {
  MutabaahOptionsEditor,
  normalizeMutabaahOptions,
  optionsToFormState,
  type MutabaahOptionsFormState,
} from '@/components/mutabaah/MutabaahOptionsEditor';
import { MUTABAAH_OTHER_DEFAULT_LABEL } from '@/lib/mutabaah';

type FormState = {
  title: string;
  description: string;
  target: string;
  fieldType: MutabaahFieldType;
  inputScope: MutabaahInputScope;
  selectOptions: MutabaahOptionsFormState;
  minValue: string;
  maxValue: string;
  sortOrder: string;
  isRequired: boolean;
};

const emptySelectOptions: MutabaahOptionsFormState = {
  options: [{ label: '', value: '' }],
  allowOther: false,
  otherLabel: MUTABAAH_OTHER_DEFAULT_LABEL,
};

const emptyForm: FormState = {
  title: '',
  description: '',
  target: '',
  fieldType: 'CHECKBOX',
  inputScope: 'WEEKLY',
  selectOptions: emptySelectOptions,
  minValue: '',
  maxValue: '',
  sortOrder: '0',
  isRequired: true,
};

export default function MutabaahConfigPage() {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<'LEVEL_1' | 'LEVEL_2'>('LEVEL_1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: items = [], isLoading } = useQuery<MutabaahItemMaster[]>({
    queryKey: ['mutabaah-items', level],
    queryFn: async () =>
      (await api.get<ApiResponse<MutabaahItemMaster[]>>(`/mutabaah/items?level=${level}`)).data.data,
  });

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const startEdit = (item: MutabaahItemMaster) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description || '',
      target: item.target || '',
      fieldType: item.fieldType,
      inputScope: item.inputScope,
      selectOptions: optionsToFormState(item.options, item.allowOther, item.otherLabel),
      minValue: item.minValue != null ? String(item.minValue) : '',
      maxValue: item.maxValue != null ? String(item.maxValue) : '',
      sortOrder: String(item.sortOrder),
      isRequired: item.isRequired,
    });
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      level,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      target: form.target.trim() || undefined,
      fieldType: form.fieldType,
      inputScope: form.inputScope,
      sortOrder: Number(form.sortOrder) || 0,
      isRequired: form.isRequired,
      isActive: true,
    };

    if (form.fieldType === 'SELECT') {
      const options = normalizeMutabaahOptions(form.selectOptions.options);
      if (!options.length) {
        throw new Error('Minimal satu pilihan wajib diisi');
      }
      payload.options = options;
      payload.allowOther = form.selectOptions.allowOther;
      payload.otherLabel = form.selectOptions.otherLabel.trim() || MUTABAAH_OTHER_DEFAULT_LABEL;
    }
    if (form.fieldType === 'NUMBER') {
      if (form.minValue) payload.minValue = Number(form.minValue);
      if (form.maxValue) payload.maxValue = Number(form.maxValue);
    }

    return payload;
  };

  const save = async () => {
    try {
      setLoading(true);
      setError('');
      const payload = buildPayload();
      if (editingId) {
        await api.put(`/mutabaah/items/${editingId}`, payload);
      } else {
        await api.post('/mutabaah/items', payload);
      }
      await invalidateMutabaahQueries(queryClient);
      resetForm();
    } catch (err: unknown) {
      setError(
        (err as Error)?.message ||
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal menyimpan',
      );
    } finally {
      setLoading(false);
    }
  };

  const deactivate = async (id: string) => {
    await api.delete(`/mutabaah/items/${id}`);
    await invalidateMutabaahQueries(queryClient);
    if (editingId === id) resetForm();
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN']}>
      <PageContainer tight className="max-w-3xl">
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link href="/config">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali ke pengaturan
          </Link>
        </Button>

        <PageHeader title="Master Mutabaah Yaumiyah" compact />

        <div className="mb-4 flex gap-2">
          {(['LEVEL_1', 'LEVEL_2'] as const).map((lv) => (
            <Button
              key={lv}
              size="sm"
              variant={level === lv ? 'default' : 'outline'}
              className="rounded-xl"
              onClick={() => {
                setLevel(lv);
                resetForm();
              }}
            >
              {lv === 'LEVEL_1' ? 'Level Muda' : 'Level Pratama'}
            </Button>
          ))}
        </div>

        <ListGroup className="mb-4 p-5">
          <p className="mb-4 text-sm font-medium">{editingId ? 'Edit poin' : 'Tambah poin baru'}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Judul</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Deskripsi (opsional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Target (opsional)</Label>
              <Input
                placeholder="Contoh: 5 kali/minggu"
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Urutan</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipe input</Label>
              <select
                value={form.fieldType}
                onChange={(e) => {
                  const fieldType = e.target.value as MutabaahFieldType;
                  setForm((f) => ({
                    ...f,
                    fieldType,
                    ...(fieldType === 'SELECT' &&
                    f.selectOptions.options.every((o) => !o.label.trim())
                      ? { selectOptions: emptySelectOptions }
                      : {}),
                  }));
                }}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Cakupan waktu</Label>
              <select
                value={form.inputScope}
                onChange={(e) => setForm((f) => ({ ...f, inputScope: e.target.value as MutabaahInputScope }))}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                {Object.entries(INPUT_SCOPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {form.fieldType === 'SELECT' && (
              <div className="sm:col-span-2">
                <MutabaahOptionsEditor
                  value={form.selectOptions}
                  onChange={(selectOptions) => setForm((f) => ({ ...f, selectOptions }))}
                />
              </div>
            )}
            {form.fieldType === 'NUMBER' && (
              <>
                <div className="space-y-2">
                  <Label>Min (opsional)</Label>
                  <Input
                    type="number"
                    value={form.minValue}
                    onChange={(e) => setForm((f) => ({ ...f, minValue: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max (opsional)</Label>
                  <Input
                    type="number"
                    value={form.maxValue}
                    onChange={(e) => setForm((f) => ({ ...f, maxValue: e.target.value }))}
                  />
                </div>
              </>
            )}
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.isRequired}
                onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))}
              />
              <span className="text-sm">Wajib diisi</span>
            </label>
          </div>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <div className="mt-4 flex gap-2">
            <Button className="rounded-xl" disabled={loading} onClick={save}>
              {editingId ? 'Simpan perubahan' : 'Tambah poin'}
            </Button>
            {editingId && (
              <Button variant="outline" className="rounded-xl" onClick={resetForm}>
                Batal
              </Button>
            )}
          </div>
        </ListGroup>

        {isLoading ? (
          <LoadingSkeleton className="h-48 rounded-2xl" />
        ) : (
          <ListGroup className="divide-y divide-border/60">
            {items.filter((i) => i.isActive).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-4 md:px-5">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => startEdit(item)}>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {FIELD_TYPE_LABELS[item.fieldType]} · {INPUT_SCOPE_LABELS[item.inputScope]}
                    {item.target ? ` · Target: ${item.target}` : ''}
                    {item.fieldType === 'SELECT' && item.options?.length
                      ? ` · ${item.options.map((o) => o.label).join(', ')}${item.allowOther ? `, ${item.otherLabel || MUTABAAH_OTHER_DEFAULT_LABEL} (freetext)` : ''}`
                      : ''}
                  </p>
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => startEdit(item)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-lg text-destructive"
                    onClick={() => deactivate(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {!items.filter((i) => i.isActive).length && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Belum ada poin mutabaah untuk level ini
              </p>
            )}
          </ListGroup>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
