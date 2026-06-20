'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createKksSchema, type CreateKksInput } from '@dakwah/shared';
import { api, type ApiResponse } from '@/lib/api';
import { invalidateKksQueries } from '@/lib/queryInvalidation';
import type { KksListData } from '@/lib/types';
import { PageContainer, PageHeader, Section } from '@/components/layout/PageShell';
import { EmptyState, KksStatusBadge, KksTypeBadge, LoadingSkeleton } from '@/components/shared/Badges';
import { RoleGuard, usePrimaryRole } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatDate } from '@/lib/utils';
import { MessageSquarePlus } from 'lucide-react';

const KKS_TYPES = [
  { value: 'KELUHAN', label: 'Keluhan' },
  { value: 'KRITIK', label: 'Kritik' },
  { value: 'SARAN', label: 'Saran' },
] as const;

const STATUS_FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'READ', label: 'Dibaca' },
  { value: 'RESOLVED', label: 'Selesai' },
];

export default function KksPage() {
  const queryClient = useQueryClient();
  const role = usePrimaryRole();
  const isAdmin = role === 'SUPERADMIN' || role === 'ADMIN';

  const [showForm, setShowForm] = useState(!isAdmin);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState<CreateKksInput>({ type: 'SARAN', subject: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set('status', statusFilter);
  if (typeFilter) queryParams.set('type', typeFilter);

  const { data, isLoading } = useQuery<KksListData>({
    queryKey: ['kks', statusFilter, typeFilter, isAdmin],
    queryFn: async () => {
      const qs = queryParams.toString();
      return (await api.get<ApiResponse<KksListData>>(`/kks${qs ? `?${qs}` : ''}`)).data.data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitSuccess(false);

    const parsed = createKksSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const key = err.path[0]?.toString();
        if (key) fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/kks', parsed.data);
      setForm({ type: 'SARAN', subject: '', message: '' });
      setSubmitSuccess(true);
      setShowForm(false);
      await invalidateKksQueries(queryClient);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setErrors({ form: msg || 'Gagal mengirim KKS' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RoleGuard>
      <PageContainer>
        <PageHeader
          title={isAdmin ? 'KKS — Kotak Masuk' : 'Keluhan, Kritik & Saran'}
          description={
            isAdmin
              ? 'Kelola masukan dari pengguna di seluruh sistem'
              : 'Sampaikan keluhan, kritik, atau saran kepada admin'
          }
          action={
            !isAdmin || showForm ? null : (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Kirim KKS
              </Button>
            )
          }
        />

        {submitSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            KKS berhasil dikirim. Admin akan segera meninjau masukan Anda.
          </div>
        )}

        {(showForm || !isAdmin) && (
          <Section title={isAdmin ? 'Kirim KKS' : 'Formulir'}>
            <Card className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Jenis</Label>
                  <div className="flex flex-wrap gap-2">
                    {KKS_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                        className={cn(
                          'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                          form.type === t.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subjek</Label>
                  <Input
                    id="subject"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder="Ringkasan singkat masukan Anda"
                  />
                  {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Pesan</Label>
                  <textarea
                    id="message"
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder="Jelaskan keluhan, kritik, atau saran Anda secara detail..."
                    className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
                </div>

                {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}

                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Mengirim...' : 'Kirim'}
                  </Button>
                  {isAdmin && showForm && (
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      Batal
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          </Section>
        )}

        <Section
          title={isAdmin ? 'Daftar Masukan' : 'Riwayat Saya'}
          action={
            isAdmin && data?.pendingCount ? (
              <span className="text-xs font-medium text-amber-700">
                {data.pendingCount} menunggu
              </span>
            ) : undefined
          }
        >
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value || 'all'}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    statusFilter === f.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
              <span className="mx-1 self-center text-muted-foreground">·</span>
              <button
                type="button"
                onClick={() => setTypeFilter('')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium',
                  !typeFilter ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                Semua jenis
              </button>
              {KKS_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTypeFilter(t.value)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium',
                    typeFilter === t.value
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {isLoading ? (
            <LoadingSkeleton className="h-48" />
          ) : !data?.items.length ? (
            <EmptyState
              title={isAdmin ? 'Belum ada masukan' : 'Belum ada riwayat'}
              description={
                isAdmin
                  ? 'Masukan dari pengguna akan muncul di sini'
                  : 'Kirim keluhan, kritik, atau saran pertama Anda'
              }
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y">
                {data.items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/kks/${item.id}`}
                    className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <KksTypeBadge type={item.type} />
                        <KksStatusBadge status={item.status} />
                      </div>
                      <p className="mt-1.5 font-medium">{item.subject}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.message}</p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {isAdmin ? (
                          <>
                            {item.user.name} · {formatDate(item.createdAt)}
                          </>
                        ) : (
                          formatDate(item.createdAt)
                        )}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </Section>
      </PageContainer>
    </RoleGuard>
  );
}
