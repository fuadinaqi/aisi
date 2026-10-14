import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { api, type ApiResponse } from '@/lib/api';
import { compressImage, isImageFile } from '@/lib/compressImage';
import { toastError, toastSuccess } from '@/lib/toast';

type PosterTemplateFieldProps = {
  schoolId: string;
  onChange?: () => void;
};

export function PosterTemplateField({ schoolId, onChange }: PosterTemplateFieldProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['school-poster-template', schoolId],
    queryFn: async () =>
      (await api.get<ApiResponse<{ hasTemplate: boolean }>>(`/schools/${schoolId}/template-info`)).data.data,
  });
  const hasTemplate = Boolean(data?.hasTemplate);

  useEffect(() => {
    let cancelled = false;
    let created = '';
    setPreview(null);
    if (!hasTemplate) return;
    (async () => {
      const file = await api.get<Blob>(`/schools/${schoolId}/template`, { responseType: 'blob' });
      if (cancelled) return;
      created = URL.createObjectURL(file.data);
      if (cancelled) {
        URL.revokeObjectURL(created);
        return;
      }
      setPreview(created);
    })().catch((err: unknown) => {
      if (!cancelled) toastError(err, 'Gagal memuat template');
    });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [schoolId, hasTemplate]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['school-poster-template', schoolId] });
    onChange?.();
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const optimized = await compressImage(file);
      const form = new FormData();
      form.append('template', optimized);
      await api.post(`/schools/${schoolId}/template`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toastSuccess('Template berhasil disimpan');
      await refresh();
    } catch (err) {
      toastError(err, 'Gagal menyimpan template');
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    await api.delete(`/schools/${schoolId}/template`);
    toastSuccess('Template dihapus');
    await refresh();
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">Template poster</p>
        <p className="text-xs text-muted-foreground">
          Gambar A4 milik PGM ini. Logo dan nama sudah ada di gambar. Bulan, tahun, dan pekan ditambahkan otomatis.
          Kosongkan untuk latar putih.
        </p>
      </div>
      <div className="flex items-start gap-3">
        {preview ? (
          <div className="relative">
            <img src={preview} alt="Template poster A4" className="h-36 w-auto rounded-md border object-cover" />
            <button
              type="button"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
              aria-label="Hapus template"
              disabled={uploading}
              onClick={() => setConfirmDelete(true)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="flex h-36 w-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input text-xs text-muted-foreground hover:bg-muted"
            disabled={uploading || isLoading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-5 w-5" />
            {uploading ? 'Menyimpan...' : 'Unggah'}
          </button>
        )}
        {preview && (
          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Menyimpan...' : 'Ganti template'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (!isImageFile(file)) {
            toastError(new Error('File harus berupa gambar'));
            return;
          }
          void upload(file);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Hapus template ini?"
        description="Poster kembali memakai latar putih. Bulan dan pekan tetap ditulis."
        confirmLabel="Hapus"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
