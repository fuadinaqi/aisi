'use client';

import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, MapPin, Star } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { formatDate, formatEventTargetLevels, getMediaUrl, getPrimaryRole } from '@/lib/utils';
import { invalidateEventQueries } from '@/lib/queryInvalidation';
import type { EventItem } from '@/lib/types';

const statusLabels: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Menunggu persetujuan pembina', className: 'bg-amber-50 text-amber-800' },
  APPROVED: { label: 'Check-in disetujui', className: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Check-in ditolak', className: 'bg-rose-50 text-rose-700' },
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : '';
  const isAnggota = role === 'ANGGOTA';

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: event, isLoading } = useQuery<EventItem>({
    queryKey: ['event', id],
    queryFn: async () => (await api.get<ApiResponse<EventItem>>(`/events/${id}`)).data.data,
    enabled: !!id,
  });

  const { data: levelConfigs = [] } = useQuery<{ level: string; label: string }[]>({
    queryKey: ['group-levels'],
    queryFn: async () =>
      (await api.get<ApiResponse<{ level: string; label: string }[]>>('/config/group-levels')).data.data,
  });

  const levelLabels = Object.fromEntries(levelConfigs.map((cfg) => [cfg.level, cfg.label]));

  const handlePhotoChange = (file: File | null) => {
    setPhoto(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleCheckIn = async () => {
    if (!photo) {
      setError('Foto check-in wajib diunggah');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const formData = new FormData();
      formData.append('photo', photo);
      await api.post(`/events/${id}/check-in`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await invalidateEventQueries(queryClient, id);
      setPhoto(null);
      handlePhotoChange(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal check-in',
      );
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer tight>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </PageContainer>
    );
  }

  if (!event) return null;

  const imageUrl = getMediaUrl(event.imageUrl);
  const checkInPhoto = getMediaUrl(event.myCheckIn?.photoUrl);
  const canCheckIn =
    isAnggota &&
    event.isOngoing &&
    (!event.myCheckIn ||
      event.myCheckIn.status === 'REJECTED');
  const statusInfo = event.myCheckIn ? statusLabels[event.myCheckIn.status] : null;

  return (
    <PageContainer tight>
      <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
        <Link href="/events">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Kembali
        </Link>
      </Button>

      <PageHeader title={event.title} compact />

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="mb-4 h-48 w-full rounded-2xl object-cover" />
      )}

      <ListGroup className="divide-y divide-border/60">
        <div className="px-4 py-4 md:px-5">
          <p className="text-xs text-muted-foreground">Waktu</p>
          <p className="mt-1 font-medium">
            {formatDate(event.startAt)} – {formatDate(event.endAt)}
          </p>
          {!event.hasStarted && (
            <p className="mt-1 text-sm text-amber-700">Event belum dimulai</p>
          )}
          {event.isOngoing && <p className="mt-1 text-sm text-emerald-700">Sedang berlangsung</p>}
        </div>

        {event.location && (
          <div className="flex items-start gap-2 px-4 py-4 md:px-5">
            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Lokasi</p>
              <p className="font-medium">{event.location}</p>
            </div>
          </div>
        )}

        <div className="px-4 py-4 md:px-5">
          <p className="text-xs text-muted-foreground">Cakupan</p>
          <p className="mt-1 font-medium">{event.school?.name || 'Semua sekolah'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatEventTargetLevels(event.targetLevels, levelLabels, isAnggota)}
          </p>
        </div>

        {event.pointValue > 0 && (
          <div className="flex items-center gap-2 px-4 py-4 md:px-5">
            <Star className="h-4 w-4 text-amber-500" fill="currentColor" />
            <span className="font-medium">{event.pointValue} poin setelah disetujui pembina</span>
          </div>
        )}

        {event.description && (
          <div className="px-4 py-4 md:px-5">
            <p className="text-xs text-muted-foreground">Deskripsi</p>
            <p className="mt-1 text-sm leading-relaxed">{event.description}</p>
          </div>
        )}
      </ListGroup>

      {statusInfo && (
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${statusInfo.className}`}>
          {statusInfo.label}
          {event.myCheckIn?.rejectionNote && (
            <p className="mt-1 font-normal opacity-90">{event.myCheckIn.rejectionNote}</p>
          )}
        </div>
      )}

      {checkInPhoto && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Foto check-in Anda</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={checkInPhoto} alt="Foto check-in" className="max-h-64 rounded-2xl object-cover" />
        </div>
      )}

      {canCheckIn && (
        <ListGroup className="mt-4 p-5">
          <p className="mb-3 text-sm font-semibold">Check-in event</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Unggah foto kehadiran Anda. Check-in akan dikonfirmasi oleh pembina kelompok.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
          />

          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview" className="mb-4 max-h-64 w-full rounded-2xl object-cover" />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mb-4 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-10 text-muted-foreground"
            >
              <Camera className="h-8 w-8" />
              <span className="text-sm font-medium">Ambil / pilih foto</span>
            </button>
          )}

          <div className="flex gap-2">
            {preview && (
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => fileRef.current?.click()}>
                Ganti foto
              </Button>
            )}
            <Button type="button" className="flex-1 rounded-xl" disabled={loading || !photo} onClick={handleCheckIn}>
              {loading ? 'Mengirim...' : 'Kirim check-in'}
            </Button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}
        </ListGroup>
      )}

      {isAnggota && event.hasEnded && !event.myCheckIn && (
        <p className="mt-4 text-sm text-muted-foreground">Event sudah berakhir.</p>
      )}
    </PageContainer>
  );
}
