'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import {
  IC_CATEGORIES,
  IC_CATEGORY_LABELS,
  IC_TYPE_LABELS,
  type ICCategory,
  type IndikatorCapaianMaster,
} from '@/lib/ic';
import { invalidateICQueries } from '@/lib/queryInvalidation';
import { useAuthStore } from '@/store/authStore';
import { getPrimaryRole } from '@/lib/utils';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSkeleton } from '@/components/shared/Badges';

type FormState = {
  category: ICCategory;
  type: 'PRIMER' | 'SEKUNDER';
  number: string;
  title: string;
  materi: string;
  sortOrder: string;
};

const emptyForm: FormState = {
  category: 'KEAGAMAAN',
  type: 'PRIMER',
  number: '',
  title: '',
  materi: '',
  sortOrder: '0',
};

export default function ICConfigPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : '';
  const canEdit = role === 'SUPERADMIN' || role === 'ADMIN';

  const [level, setLevel] = useState<'LEVEL_1' | 'LEVEL_2'>('LEVEL_1');
  const [filterCategory, setFilterCategory] = useState<ICCategory | 'ALL'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: items = [], isLoading } = useQuery<IndikatorCapaianMaster[]>({
    queryKey: ['ic-items', level],
    queryFn: async () =>
      (await api.get<ApiResponse<IndikatorCapaianMaster[]>>(`/ic/items?level=${level}`)).data.data,
  });

  const filteredItems = useMemo(() => {
    const active = items.filter((i) => i.isActive);
    if (filterCategory === 'ALL') return active;
    return active.filter((i) => i.category === filterCategory);
  }, [items, filterCategory]);

  const groupedItems = useMemo(() => {
    return IC_CATEGORIES.map((category) => {
      const categoryItems = filteredItems.filter((i) => i.category === category);
      if (!categoryItems.length) return null;

      const primer = categoryItems
        .filter((i) => i.type === 'PRIMER')
        .sort((a, b) => a.sortOrder - b.sortOrder || a.number - b.number);
      const sekunder = categoryItems
        .filter((i) => i.type === 'SEKUNDER')
        .sort((a, b) => a.sortOrder - b.sortOrder || a.number - b.number);

      return { category, primer, sekunder };
    }).filter(Boolean) as {
      category: ICCategory;
      primer: IndikatorCapaianMaster[];
      sekunder: IndikatorCapaianMaster[];
    }[];
  }, [filteredItems]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const startEdit = (item: IndikatorCapaianMaster) => {
    setEditingId(item.id);
    setForm({
      category: item.category,
      type: item.type,
      number: String(item.number),
      title: item.title,
      materi: item.materi || '',
      sortOrder: String(item.sortOrder),
    });
  };

  const save = async () => {
    try {
      setLoading(true);
      setError('');
      const payload = {
        level,
        category: form.category,
        type: form.type,
        number: Number(form.number),
        title: form.title.trim(),
        materi: form.materi.trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: true,
      };
      if (!payload.title) throw new Error('Indikator capaian wajib diisi');
      if (!payload.number || payload.number < 1) throw new Error('Nomor IC wajib diisi');

      if (editingId) {
        await api.put(`/ic/items/${editingId}`, payload);
      } else {
        await api.post('/ic/items', payload);
      }
      await invalidateICQueries(queryClient);
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
    await api.delete(`/ic/items/${id}`);
    await invalidateICQueries(queryClient);
    if (editingId === id) resetForm();
  };

  const renderItemList = (list: IndikatorCapaianMaster[]) =>
    list.map((item) => (
      <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 md:px-5">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => canEdit && startEdit(item)}
          disabled={!canEdit}
        >
          <p className="font-medium">
            <span className="mr-2 text-muted-foreground">#{item.number}</span>
            {item.title}
          </p>
          {item.materi && (
            <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{item.materi}</p>
          )}
        </button>
        {canEdit && (
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
        )}
      </div>
    ));

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA']}>
      <PageContainer tight className="max-w-3xl">
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link href={canEdit ? '/config' : '/dashboard'}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {canEdit ? 'Kembali ke pengaturan' : 'Kembali'}
          </Link>
        </Button>

        <PageHeader
          title="Indikator Capaian"
          compact
          description={canEdit ? 'Kelola master IC per level kelompok' : 'Daftar master IC (hanya lihat)'}
        />

        <div className="mb-4 flex flex-wrap gap-2">
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

        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={filterCategory === 'ALL' ? 'secondary' : 'outline'}
            className="rounded-xl"
            onClick={() => setFilterCategory('ALL')}
          >
            Semua
          </Button>
          {IC_CATEGORIES.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={filterCategory === cat ? 'secondary' : 'outline'}
              className="rounded-xl"
              onClick={() => setFilterCategory(cat)}
            >
              {IC_CATEGORY_LABELS[cat].replace(/^[A-Z]\.\s/, '')}
            </Button>
          ))}
        </div>

        {canEdit && (
          <ListGroup className="mb-4 p-5">
            <p className="mb-4 text-sm font-medium">{editingId ? 'Edit IC' : 'Tambah IC baru'}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ICCategory }))}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {IC_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {IC_CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Tipe</Label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value as 'PRIMER' | 'SEKUNDER' }))
                  }
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="PRIMER">{IC_TYPE_LABELS.PRIMER}</option>
                  <option value="SEKUNDER">{IC_TYPE_LABELS.SEKUNDER}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Nomor IC</Label>
                <Input
                  type="number"
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Urutan tampilan</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Indikator capaian</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Materi (opsional)</Label>
                <Input value={form.materi} onChange={(e) => setForm((f) => ({ ...f, materi: e.target.value }))} />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <div className="mt-4 flex gap-2">
              <Button className="rounded-xl" disabled={loading} onClick={save}>
                {editingId ? 'Simpan perubahan' : 'Tambah IC'}
              </Button>
              {editingId && (
                <Button variant="outline" className="rounded-xl" onClick={resetForm}>
                  Batal
                </Button>
              )}
            </div>
          </ListGroup>
        )}

        {isLoading ? (
          <LoadingSkeleton className="h-48 rounded-2xl" />
        ) : (
          <div className="space-y-4">
            {groupedItems.map(({ category, primer, sekunder }) => (
              <ListGroup key={category} className="overflow-hidden">
                <div className="border-b border-border/60 px-4 py-3 md:px-5">
                  <p className="font-semibold">{IC_CATEGORY_LABELS[category]}</p>
                </div>
                {primer.length > 0 && (
                  <>
                    <div className="bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:px-5">
                      {IC_TYPE_LABELS.PRIMER}
                    </div>
                    <div className="divide-y divide-border/60">{renderItemList(primer)}</div>
                  </>
                )}
                {sekunder.length > 0 && (
                  <>
                    <div className="bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:px-5">
                      {IC_TYPE_LABELS.SEKUNDER}
                    </div>
                    <div className="divide-y divide-border/60">{renderItemList(sekunder)}</div>
                  </>
                )}
              </ListGroup>
            ))}
            {!groupedItems.length && (
              <ListGroup className="p-8 text-center text-sm text-muted-foreground">
                Belum ada indikator capaian untuk level ini
              </ListGroup>
            )}
          </div>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
