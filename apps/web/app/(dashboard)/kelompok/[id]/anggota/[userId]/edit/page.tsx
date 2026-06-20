'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invalidateGroupQueries } from '@/lib/queryInvalidation';
import type { GroupMemberDetail } from '@/lib/types';

type FormData = {
  name: string;
  email: string;
  phone: string;
};

export default function EditAnggotaPage() {
  const { id, userId } = useParams<{ id: string; userId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: member, isLoading } = useQuery<GroupMemberDetail>({
    queryKey: ['group-member', id, userId],
    queryFn: async () =>
      (await api.get<ApiResponse<GroupMemberDetail>>(`/groups/${id}/members/${userId}`)).data.data,
    enabled: !!id && !!userId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>();

  useEffect(() => {
    if (!member) return;
    reset({
      name: member.user.name,
      email: member.user.email,
      phone: member.user.phone || '',
    });
  }, [member, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      await api.put(`/groups/${id}/members/${userId}`, {
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['group-member', id, userId] });
      await invalidateGroupQueries(queryClient, { groupId: id });
      router.push(`/kelompok/${id}/anggota/${userId}`);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal memperbarui data anggota',
      );
    }
  };

  if (isLoading) {
    return (
      <PageContainer tight>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </PageContainer>
    );
  }

  if (!member) return null;

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA']}>
      <PageContainer tight className="max-w-lg">
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link href={`/kelompok/${id}/anggota/${userId}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Link>
        </Button>

        <PageHeader title="Edit anggota" compact />

        <p className="mb-4 px-0.5 text-sm text-muted-foreground">
          {member.group.name} · {member.school.name}
        </p>

        <ListGroup className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama</Label>
              <Input id="name" className="rounded-xl" {...register('name', { required: true })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="rounded-xl"
                {...register('email', { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">No. telepon</Label>
              <Input id="phone" className="rounded-xl" placeholder="Opsional" {...register('phone')} />
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl">
              {isSubmitting ? 'Menyimpan...' : 'Simpan perubahan'}
            </Button>
          </form>
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
