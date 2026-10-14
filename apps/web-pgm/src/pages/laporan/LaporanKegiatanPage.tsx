import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, ImageIcon } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { formatWeekRange, toDateInputValue, toWeekDateParam } from '@/lib/utils';
import { buildLaporanPoster, posterFileName, weekPosterMeta } from '@/lib/laporanPoster';
import { PosterTemplateField } from '@/components/laporan/PosterTemplateField';
import { toastError, toastInfo } from '@/lib/toast';
import type { SchoolItem } from '@/lib/types';

type LaporanPhoto = {
  evaluationId: string;
  groupName: string;
  index: number;
};

type LaporanData = {
  school: { id: string; name: string };
  photos: LaporanPhoto[] | null;
  missingPhotos: string[] | null;
  pendingGroups: string[] | null;
};

async function loadPosterTemplate(schoolId: string): Promise<ImageBitmap | null> {
  try {
    const file = await api.get<Blob>(`/schools/${schoolId}/template`, { responseType: 'blob' });
    return await createImageBitmap(file.data);
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
}

export default function LaporanKegiatanPage() {
  const [searchParams] = useSearchParams();
  const todayMax = toDateInputValue();
  const [schoolId, setSchoolId] = useState(searchParams.get('schoolId') || '');
  const [weekDate, setWeekDate] = useState(searchParams.get('weekDate') || todayMax);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('laporan-pgm.png');
  const [summary, setSummary] = useState('');

  const { data: schools } = useQuery<SchoolItem[]>({
    queryKey: ['schools'],
    queryFn: async () => (await api.get<ApiResponse<SchoolItem[]>>('/schools?limit=100')).data.data,
  });

  useEffect(() => {
    if (!schoolId && schools?.length) setSchoolId(schools[0].id);
  }, [schoolId, schools]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSummary('');
  }, [schoolId, weekDate]);

  const school = schools?.find((item) => item.id === schoolId);
  const meta = weekPosterMeta(weekDate);

  const handleWeekChange = (value: string) => {
    if (!value || value > todayMax) return;
    setWeekDate(value);
  };

  const generate = async (download: boolean) => {
    if (!schoolId) {
      toastError(new Error('Pilih PGM terlebih dahulu'));
      return;
    }
    try {
      setLoading(true);
      const res = await api.get<ApiResponse<LaporanData>>('/evaluations/laporan', {
        params: { schoolId, weekDate: toWeekDateParam(weekDate) },
      });
      const data = res.data.data;
      const photos = data.photos ?? [];
      const missing = data.missingPhotos ?? [];
      const pending = data.pendingGroups ?? [];
      const notes = [
        missing.length ? `Terkirim tanpa foto: ${missing.join(', ')}` : '',
        pending.length ? `Belum mengirim evaluasi: ${pending.join(', ')}` : '',
      ].filter(Boolean);
      if (!photos.length) {
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setSummary(notes.length ? `${notes.join('. ')}.` : 'Belum ada evaluasi terkirim pada pekan ini.');
        return;
      }

      const loaded = (
        await Promise.all(
          photos.map(async (photo) => {
            try {
              const file = await api.get<Blob>(`/evaluations/${photo.evaluationId}/agenda-photo`, {
                params: { index: photo.index },
                responseType: 'blob',
              });
              return await createImageBitmap(file.data);
            } catch {
              return null;
            }
          }),
        )
      ).filter((item): item is ImageBitmap => item !== null);

      if (!loaded.length) {
        throw new Error('Foto agenda tidak bisa dimuat');
      }

      let template: ImageBitmap | null = null;
      try {
        template = await loadPosterTemplate(schoolId);
      } catch {
        loaded.forEach((item) => item.close());
        throw new Error('Template poster tidak bisa dimuat');
      }

      const blob = await buildLaporanPoster({
        schoolName: data.school?.name || school?.name || 'PGM',
        monthLabel: meta.monthLabel,
        weekLabel: meta.weekLabel,
        photos: loaded,
        template,
      });
      loaded.forEach((item) => item.close());
      template?.close();

      const nextName = posterFileName(data.school?.name || school?.name || 'PGM', meta.monthLabel, meta.weekLabel);
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setFileName(nextName);
      const skipped = photos.length - loaded.length;
      const parts = [`${loaded.length} foto masuk poster`];
      if (missing.length) parts.push(`Terkirim tanpa foto: ${missing.join(', ')}`);
      if (pending.length) parts.push(`Belum mengirim evaluasi: ${pending.join(', ')}`);
      if (skipped) parts.push(`${skipped} foto gagal dimuat`);
      setSummary(`${parts.join('. ')}.`);
      if (skipped) toastInfo(`${skipped} foto tidak bisa dimuat dan dilewati`);
      if (download) saveBlob(blob, nextName);
    } catch (err) {
      toastError(err, 'Gagal membuat laporan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer className="max-w-3xl">
        <PageHeader
          title="Laporan kegiatan"
          description="Poster A4 dari foto agenda liqo. Latarnya template PGM, atau putih jika belum diunggah"
        />

        <Card>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>PGM</Label>
                <SearchableSelect
                  value={schoolId}
                  onChange={setSchoolId}
                  placeholder="Pilih PGM"
                  searchPlaceholder="Cari PGM..."
                  options={(schools || []).map((item) => ({ value: item.id, label: item.name }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Pekan</Label>
                <Input
                  type="date"
                  value={weekDate}
                  max={todayMax}
                  onChange={(e) => handleWeekChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Pekan {formatWeekRange(weekDate)}</p>
              </div>
            </div>

            {schoolId && (
              <PosterTemplateField
                key={schoolId}
                schoolId={schoolId}
                onChange={() => {
                  setPreviewUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                  });
                }}
              />
            )}

            <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm">
              <p className="font-medium">PGM {meta.monthLabel}</p>
              <p className="text-muted-foreground">
                {school?.name || 'Nama PGM'} · {meta.weekLabel}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="flex-1" disabled={loading || !schoolId} onClick={() => generate(true)}>
                <Download className="mr-2 h-4 w-4" />
                {loading ? 'Menyusun poster...' : 'Unduh poster A4'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={loading || !schoolId}
                onClick={() => generate(false)}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Pratinjau
              </Button>
            </div>

            {summary && <p className="text-sm text-muted-foreground">{summary}</p>}

            {previewUrl && (
              <div className="mx-auto max-w-md">
                <img
                  src={previewUrl}
                  alt="Pratinjau poster laporan kegiatan ukuran A4"
                  className="w-full rounded-xl shadow-md"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => triggerDownload(previewUrl, fileName)}
                >
                  Unduh lagi
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </RoleGuard>
  );
}

function triggerDownload(url: string, name: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, name);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
