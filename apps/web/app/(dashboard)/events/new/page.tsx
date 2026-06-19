'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPrimaryRole, toDateTimeLocalValue } from '@/lib/utils';
import type { SchoolItem } from '@/lib/types';

export default function NewEventPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : '';
  const canPickSchool = role === 'SUPERADMIN' || role === 'ADMIN';

  const defaultStart = toDateTimeLocalValue();
  const defaultEndDate = new Date();
  defaultEndDate.setHours(defaultEndDate.getHours() + 2);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(toDateTimeLocalValue(defaultEndDate));
  const [pointValue, setPointValue] = useState('0');
  const [schoolId, setSchoolId] = useState('all');
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: schools = [] } = useQuery<SchoolItem[]>({
    queryKey: ['schools'],
    queryFn: async () => (await api.get<ApiResponse<SchoolItem[]>>('/schools')).data.data,
    enabled: canPickSchool,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (location.trim()) formData.append('location', location.trim());
      formData.append('startAt', new Date(startAt).toISOString());
      formData.append('endAt', new Date(endAt).toISOString());
      formData.append('pointValue', pointValue);
      formData.append('isPublished', 'true');
      if (canPickSchool) formData.append('schoolId', schoolId);
      if (image) formData.append('image', image);

      await api.post('/events', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      router.push('/events');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal membuat event',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight className="max-w-lg">
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link href="/events">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Link>
        </Button>

        <PageHeader title="Tambah event" compact />

        <ListGroup className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image">Gambar event</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                className="rounded-xl"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Judul</Label>
              <Input id="title" className="rounded-xl" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <textarea
                id="description"
                className="flex min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Lokasi</Label>
              <Input id="location" className="rounded-xl" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startAt">Mulai</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  className="rounded-xl"
                  required
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endAt">Berakhir</Label>
                <Input
                  id="endAt"
                  type="datetime-local"
                  className="rounded-xl"
                  required
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pointValue">Poin check-in (setelah disetujui pembina)</Label>
              <Input
                id="pointValue"
                type="number"
                min={0}
                className="rounded-xl"
                value={pointValue}
                onChange={(e) => setPointValue(e.target.value)}
              />
            </div>

            {canPickSchool ? (
              <div className="space-y-2">
                <Label htmlFor="schoolId">Cakupan</Label>
                <select
                  id="schoolId"
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                >
                  <option value="all">Semua sekolah</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Event ini hanya untuk anggota di sekolah Anda.
              </p>
            )}

            {error && (
              <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={loading} className="w-full rounded-xl">
              {loading ? 'Menyimpan...' : 'Buat event'}
            </Button>
          </form>
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
