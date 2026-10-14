import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Link2 } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toastError, toastSuccess } from '@/lib/toast';
import type { MentorNeedItem } from '@/lib/types';

async function copySchoolPublicLink(schoolId: string) {
  const url = `${window.location.origin}/calon-mentor/${schoolId}`;
  try {
    await navigator.clipboard.writeText(url);
    toastSuccess('Link formulir disalin');
  } catch {
    toastError(undefined, 'Gagal menyalin link');
  }
}

type FormData = {
  description: string;
  needIkhwan: number;
  needAkhwat: number;
  isPublished: boolean;
};

export default function KebutuhanMentorEditPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<MentorNeedItem>({
    queryKey: ['mentor-need', schoolId],
    queryFn: async () =>
      (await api.get<ApiResponse<MentorNeedItem>>(`/mentor-needs/schools/${schoolId}`)).data.data,
    enabled: !!schoolId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      description: '',
      needIkhwan: 0,
      needAkhwat: 0,
      isPublished: false,
    },
  });

  useEffect(() => {
    if (!data) return;
    reset({
      description: data.description || '',
      needIkhwan: data.needIkhwan ?? data.quota?.ikhwan.need ?? 0,
      needAkhwat: data.needAkhwat ?? data.quota?.akhwat.need ?? 0,
      isPublished: !!data.isPublished,
    });
  }, [data, reset]);

  const onSubmit = async (form: FormData) => {
    try {
      await api.put(`/mentor-needs/schools/${schoolId}`, {
        description: form.description.trim(),
        needIkhwan: Number(form.needIkhwan) || 0,
        needAkhwat: Number(form.needAkhwat) || 0,
        isPublished: form.isPublished,
      });
      await queryClient.invalidateQueries({ queryKey: ['mentor-needs'] });
      await queryClient.invalidateQueries({ queryKey: ['mentor-need', schoolId] });
      toastSuccess('Kebutuhan mentor disimpan');
    } catch (err) {
      toastError(err, 'Gagal menyimpan kebutuhan mentor');
    }
  };

  if (isLoading) {
    return (
      <PageContainer tight>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </PageContainer>
    );
  }

  if (!data) return null;

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight className="max-w-lg">
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link to="/kebutuhan-mentor">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Link>
        </Button>

        <PageHeader
          title={data.schoolName}
          compact
          description="Atur deskripsi, kuota, dan status publish."
          action={
            data.isPublished ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => schoolId && copySchoolPublicLink(schoolId)}
              >
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                Salin link form
              </Button>
            ) : undefined
          }
        />

        <ListGroup className="space-y-3 p-5">
          <div className="space-y-1 text-sm">
            <p className="font-medium">Alamat PGM</p>
            {data.address ? (
              <p className="text-muted-foreground">{data.address}</p>
            ) : (
              <p className="text-amber-700">Belum diisi — lengkapi di halaman PGM.</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {data.mapsUrl ? (
                <a
                  href={data.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Buka Google Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <Link to={`/schools/${schoolId}`} className="text-sm text-primary hover:underline">
                Edit alamat PGM
              </Link>
            </div>
          </div>

          {data.quota ? (
            <p className="text-xs text-muted-foreground">
              Terisi saat ini — Ikhwan {data.quota.ikhwan.filled}/{data.quota.ikhwan.need}, Akhwat{' '}
              {data.quota.akhwat.filled}/{data.quota.akhwat.need}
            </p>
          ) : null}
        </ListGroup>

        <ListGroup className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi / jadwal</Label>
              <textarea
                id="description"
                rows={3}
                placeholder="(Senin-Rabu 11.30-12.00)"
                className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('description', { required: true })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="needIkhwan">Kebutuhan Ikhwan</Label>
                <Input
                  id="needIkhwan"
                  type="number"
                  min={0}
                  className="rounded-xl"
                  {...register('needIkhwan', { valueAsNumber: true, min: 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="needAkhwat">Kebutuhan Akhwat</Label>
                <Input
                  id="needAkhwat"
                  type="number"
                  min={0}
                  className="rounded-xl"
                  {...register('needAkhwat', { valueAsNumber: true, min: 0 })}
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
              <input type="checkbox" className="mt-1" {...register('isPublished')} />
              <span className="text-sm">
                <span className="font-medium">Publish ke halaman calon mentor</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Tampil di /calon-mentor. Butuh minimal 1 kuota ikhwan atau akhwat.
                </span>
              </span>
            </label>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl">
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </Button>
              {data.id ? (
                <Button asChild type="button" variant="outline" className="rounded-xl">
                  <Link to={`/kebutuhan-mentor/${schoolId}/pendaftar`}>Pendaftar</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
