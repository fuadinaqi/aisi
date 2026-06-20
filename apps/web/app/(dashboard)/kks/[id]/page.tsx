'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { invalidateKksQueries } from '@/lib/queryInvalidation';
import type { KksItem } from '@/lib/types';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { KksStatusBadge, KksTypeBadge, LoadingSkeleton, RoleBadge } from '@/components/shared/Badges';
import { RoleGuard, usePrimaryRole } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { formatDate, getPrimaryRole } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

export default function KksDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = usePrimaryRole();
  const isAdmin = role === 'SUPERADMIN' || role === 'ADMIN';
  const id = params.id as string;

  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: item, isLoading } = useQuery<KksItem>({
    queryKey: ['kks', id],
    queryFn: async () => (await api.get<ApiResponse<KksItem>>(`/kks/${id}`)).data.data,
    enabled: !!id,
  });

  useEffect(() => {
    if (item?.adminNotes) setAdminNotes(item.adminNotes);
  }, [item?.adminNotes]);

  const updateStatus = async (status: 'READ' | 'RESOLVED' | 'PENDING') => {
    setSaving(true);
    setError('');
    try {
      await api.put(`/kks/${id}`, {
        status,
        adminNotes: adminNotes || item?.adminNotes || null,
      });
      await invalidateKksQueries(queryClient);
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(msg || 'Gagal memperbarui status');
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    setSaving(true);
    setError('');
    try {
      await api.put(`/kks/${id}`, { adminNotes: adminNotes || null });
      await invalidateKksQueries(queryClient);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(msg || 'Gagal menyimpan catatan');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <RoleGuard>
        <PageContainer>
          <LoadingSkeleton className="h-64" />
        </PageContainer>
      </RoleGuard>
    );
  }

  if (!item) {
    return (
      <RoleGuard>
        <PageContainer>
          <p className="text-sm text-muted-foreground">KKS tidak ditemukan.</p>
          <Button variant="link" asChild className="mt-2 px-0">
            <Link href="/kks">Kembali</Link>
          </Button>
        </PageContainer>
      </RoleGuard>
    );
  }

  const primaryUserRole = item.user.roles?.[0]?.role
    ? getPrimaryRole(item.user.roles.map((r) => r.role))
    : null;
  const schoolName = item.user.schools?.[0]?.school.name;

  return (
    <RoleGuard>
      <PageContainer>
        <PageHeader
          title="Detail KKS"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/kks">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali
              </Link>
            </Button>
          }
        />

        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <KksTypeBadge type={item.type} />
            <KksStatusBadge status={item.status} />
            <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
          </div>

          <div>
            <h2 className="text-lg font-semibold">{item.subject}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.message}</p>
          </div>

          {isAdmin && (
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pengirim</p>
              <p className="mt-1 font-medium">{item.user.name}</p>
              <p className="text-sm text-muted-foreground">{item.user.email}</p>
              {item.user.phone && (
                <p className="text-sm text-muted-foreground">{item.user.phone}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {primaryUserRole && <RoleBadge role={primaryUserRole} />}
                {schoolName && (
                  <span className="text-xs text-muted-foreground">{schoolName}</span>
                )}
              </div>
            </div>
          )}

          {item.adminNotes && !isAdmin && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tanggapan Admin
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{item.adminNotes}</p>
            </div>
          )}

          {isAdmin && (
            <div className="space-y-4 border-t border-border/60 pt-5">
              <div className="space-y-2">
                <Label htmlFor="adminNotes">Catatan Admin</Label>
                <textarea
                  id="adminNotes"
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Catatan internal atau tanggapan untuk pengirim..."
                  className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={saving} onClick={saveNotes}>
                  Simpan Catatan
                </Button>
                {item.status === 'PENDING' && (
                  <Button size="sm" variant="secondary" disabled={saving} onClick={() => updateStatus('READ')}>
                    Tandai Dibaca
                  </Button>
                )}
                {item.status !== 'RESOLVED' && (
                  <Button size="sm" disabled={saving} onClick={() => updateStatus('RESOLVED')}>
                    Tandai Selesai
                  </Button>
                )}
                {item.status !== 'PENDING' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => updateStatus('PENDING')}
                  >
                    Kembalikan ke Menunggu
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </PageContainer>
    </RoleGuard>
  );
}
