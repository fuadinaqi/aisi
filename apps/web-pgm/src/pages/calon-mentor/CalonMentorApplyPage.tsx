import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { AppLogo } from '@/components/layout/AppLogo';
import { PageContainer } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toastError, toastSuccess } from '@/lib/toast';
import { isValidWhatsAppPhone } from '@/lib/utils';
import type { MentorNeedItem } from '@/lib/types';

type FormData = {
  name: string;
  whatsapp: string;
  age: number;
  gender: 'IKHWAN' | 'AKHWAT' | '';
  address: string;
  asalSma: string;
  murobbiName: string;
  murobbiWhatsapp: string;
};

export default function CalonMentorApplyPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<MentorNeedItem>({
    queryKey: ['calon-mentor', schoolId],
    queryFn: async () =>
      (await api.get<ApiResponse<MentorNeedItem>>(`/calon-mentor/${schoolId}`)).data.data,
    enabled: !!schoolId,
    retry: false,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      whatsapp: '',
      age: 18,
      gender: '',
      address: '',
      asalSma: '',
      murobbiName: '',
      murobbiWhatsapp: '',
    },
  });

  const gender = watch('gender');

  const onSubmit = async (form: FormData) => {
    try {
      await api.post(`/calon-mentor/${schoolId}/apply`, {
        name: form.name.trim(),
        whatsapp: form.whatsapp.trim(),
        age: Number(form.age),
        gender: form.gender,
        address: form.address.trim(),
        asalSma: form.asalSma.trim(),
        murobbiName: form.murobbiName.trim(),
        murobbiWhatsapp: form.murobbiWhatsapp.trim(),
      });
      setSubmitted(true);
      toastSuccess('Pendaftaran berhasil dikirim');
      await refetch();
    } catch (err) {
      toastError(err, 'Gagal mengirim pendaftaran');
    }
  };

  const remI = data?.quota.ikhwan.remaining ?? 0;
  const remA = data?.quota.akhwat.remaining ?? 0;
  const pjLabel = Array.isArray(data?.pjNames) ? data.pjNames.join(', ') : '';

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60 px-4 py-4">
        <div className="mx-auto max-w-lg">
          <AppLogo href="/calon-mentor" />
        </div>
      </header>

      <main className="px-4 py-6">
        <PageContainer tight className="max-w-lg">
          <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
            <Link to="/calon-mentor">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Kembali ke daftar
            </Link>
          </Button>

          {isLoading ? (
            <LoadingSkeleton className="h-64 rounded-2xl" />
          ) : error || !data ? (
            <ListGroup>
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Kebutuhan mentor tidak ditemukan atau belum dipublish.
              </div>
            </ListGroup>
          ) : (
            <>
              <div className="space-y-2 px-0.5">
                <h1 className="text-xl font-bold tracking-tight">Daftar Mentor</h1>
                <p className="text-lg font-medium">{data.schoolName}</p>
                {pjLabel ? <p className="text-sm text-muted-foreground">Pengurus: {pjLabel}</p> : null}
                {data.description ? (
                  <p className="text-sm text-muted-foreground">{data.description}</p>
                ) : null}
                {(data.address || data.mapsUrl) && (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {data.address ? (
                      <p className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{data.address}</span>
                      </p>
                    ) : null}
                    {data.mapsUrl ? (
                      <a
                        href={data.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Buka Google Maps
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Ikhwan {data.quota.ikhwan.filled}/{data.quota.ikhwan.need} · Sisa {remI}
                  </span>
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Akhwat {data.quota.akhwat.filled}/{data.quota.akhwat.need} · Sisa {remA}
                  </span>
                </div>
              </div>

              {submitted ? (
                <ListGroup className="p-5 text-center">
                  <p className="font-medium">Pendaftaran terkirim</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tim pengurus PGM akan menghubungi Anda melalui WhatsApp.
                  </p>
                  <Button asChild className="mt-4 rounded-xl">
                    <Link to="/calon-mentor">Kembali ke daftar</Link>
                  </Button>
                </ListGroup>
              ) : (
                <ListGroup className="p-5">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nama lengkap *</Label>
                      <Input
                        id="name"
                        className="rounded-xl"
                        {...register('name', { required: true })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">Nomor WhatsApp *</Label>
                      <Input
                        id="whatsapp"
                        placeholder="08xxxxxxxxxx"
                        className="rounded-xl"
                        {...register('whatsapp', {
                          required: true,
                          validate: (v) => isValidWhatsAppPhone(v) || 'Nomor WhatsApp tidak valid',
                        })}
                      />
                      {errors.whatsapp && (
                        <p className="text-sm text-destructive">{errors.whatsapp.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="age">Usia *</Label>
                      <Input
                        id="age"
                        type="number"
                        min={15}
                        max={80}
                        className="w-28 rounded-xl"
                        {...register('age', { required: true, valueAsNumber: true, min: 15, max: 80 })}
                      />
                    </div>

                    <fieldset className="space-y-2">
                      <LegendLike>Jenis kelamin *</LegendLike>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                          <input
                            type="radio"
                            value="IKHWAN"
                            disabled={remI <= 0}
                            {...register('gender', { required: 'Pilih jenis kelamin' })}
                          />
                          <span className="text-sm">
                            Ikhwan {remI > 0 ? `(Sisa ${remI})` : '(Penuh)'}
                          </span>
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                          <input
                            type="radio"
                            value="AKHWAT"
                            disabled={remA <= 0}
                            {...register('gender', { required: 'Pilih jenis kelamin' })}
                          />
                          <span className="text-sm">
                            Akhwat {remA > 0 ? `(Sisa ${remA})` : '(Penuh)'}
                          </span>
                        </label>
                      </div>
                      {errors.gender && (
                        <p className="text-sm text-destructive">{errors.gender.message}</p>
                      )}
                    </fieldset>

                    <div className="space-y-2">
                      <Label htmlFor="address">Alamat lengkap *</Label>
                      <textarea
                        id="address"
                        rows={3}
                        className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        {...register('address', { required: true })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="asalSma">Asal SMA / SMK *</Label>
                      <Input id="asalSma" className="rounded-xl" {...register('asalSma', { required: true })} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="murobbiName">Nama Murobbi/ah *</Label>
                      <Input
                        id="murobbiName"
                        className="rounded-xl"
                        {...register('murobbiName', { required: true })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="murobbiWhatsapp">Nomor WhatsApp Murobbi/ah *</Label>
                      <Input
                        id="murobbiWhatsapp"
                        placeholder="08xxxxxxxxxx"
                        className="rounded-xl"
                        {...register('murobbiWhatsapp', {
                          required: true,
                          validate: (v) => isValidWhatsAppPhone(v) || 'Nomor WhatsApp tidak valid',
                        })}
                      />
                      {errors.murobbiWhatsapp && (
                        <p className="text-sm text-destructive">{errors.murobbiWhatsapp.message}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting || (!remI && !remA) || (gender === 'IKHWAN' && remI <= 0) || (gender === 'AKHWAT' && remA <= 0)}
                      className="w-full rounded-xl"
                    >
                      {isSubmitting ? 'Mengirim...' : 'Kirim pendaftaran'}
                    </Button>
                  </form>
                </ListGroup>
              )}
            </>
          )}
        </PageContainer>
      </main>
    </div>
  );
}

function LegendLike({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{children}</div>;
}
