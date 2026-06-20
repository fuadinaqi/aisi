'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { invalidateMateriQueries } from '@/lib/queryInvalidation';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, toDateInputValue } from '@/lib/utils';

type ContentType = 'FILE' | 'LINK' | 'RICH_TEXT';

const contentTypes: { value: ContentType; label: string; hint: string }[] = [
  { value: 'FILE', label: 'Upload file', hint: 'PDF, Word, PPT, Excel, gambar, ZIP' },
  { value: 'LINK', label: 'Link', hint: 'Arahkan ke URL eksternal' },
  { value: 'RICH_TEXT', label: 'Tulis langsung', hint: 'Editor teks kaya' },
];

export default function NewMateriPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weekDate, setWeekDate] = useState(toDateInputValue());
  const [contentType, setContentType] = useState<ContentType>('RICH_TEXT');
  const [linkUrl, setLinkUrl] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      formData.append('weekDate', weekDate);
      formData.append('contentType', contentType);
      formData.append('isPublished', 'true');

      if (contentType === 'LINK') {
        formData.append('linkUrl', linkUrl.trim());
      }
      if (contentType === 'RICH_TEXT') {
        formData.append('contentHtml', contentHtml);
      }
      if (contentType === 'FILE') {
        files.forEach((file) => formData.append('files', file));
      }

      await api.post('/materi', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await invalidateMateriQueries(queryClient);
      router.push('/materi');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal membuat materi',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN']}>
      <PageContainer tight className="max-w-2xl">
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link href="/materi">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Link>
        </Button>

        <PageHeader title="Tambah materi" compact />

        <ListGroup className="p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Judul</Label>
              <Input
                id="title"
                className="rounded-xl"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Ringkasan (opsional)</Label>
              <Input
                id="description"
                className="rounded-xl"
                placeholder="Deskripsi singkat untuk list"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weekDate">Pekan (Senin)</Label>
              <Input
                id="weekDate"
                type="date"
                className="rounded-xl"
                required
                value={weekDate}
                onChange={(e) => setWeekDate(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Jenis konten</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {contentTypes.map((type) => (
                  <label
                    key={type.value}
                    className={cn(
                      'cursor-pointer rounded-xl border p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5',
                    )}
                  >
                    <input
                      type="radio"
                      name="contentType"
                      value={type.value}
                      checked={contentType === type.value}
                      onChange={() => setContentType(type.value)}
                      className="sr-only"
                    />
                    <p className="text-sm font-medium">{type.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{type.hint}</p>
                  </label>
                ))}
              </div>
            </div>

            {contentType === 'FILE' && (
              <div className="space-y-2">
                <Label htmlFor="files">File materi</Label>
                <Input
                  id="files"
                  type="file"
                  multiple
                  className="rounded-xl"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,image/*"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
                {files.length > 0 && (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {files.map((f) => (
                      <li key={f.name}>{f.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {contentType === 'LINK' && (
              <div className="space-y-2">
                <Label htmlFor="linkUrl">URL materi</Label>
                <Input
                  id="linkUrl"
                  type="url"
                  className="rounded-xl"
                  placeholder="https://..."
                  required
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </div>
            )}

            {contentType === 'RICH_TEXT' && (
              <div className="space-y-2">
                <Label>Konten materi</Label>
                <RichTextEditor value={contentHtml} onChange={setContentHtml} />
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={loading} className="w-full rounded-xl">
              {loading ? 'Menyimpan...' : 'Publikasikan materi'}
            </Button>
          </form>
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
