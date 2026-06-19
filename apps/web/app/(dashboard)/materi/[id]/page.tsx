'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { RichTextContent } from '@/components/shared/RichTextEditor';
import { Button } from '@/components/ui/button';
import { formatDate, getMediaUrl } from '@/lib/utils';
import type { MateriItem } from '@/lib/types';

export default function MateriDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: materi, isLoading } = useQuery<MateriItem>({
    queryKey: ['materi', id],
    queryFn: async () => (await api.get<ApiResponse<MateriItem>>(`/materi/${id}`)).data.data,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <PageContainer tight>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </PageContainer>
    );
  }

  if (!materi) return null;

  return (
    <PageContainer tight className="max-w-2xl">
      <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
        <Link href="/materi">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Kembali
        </Link>
      </Button>

      <PageHeader title={materi.title} compact />

      <p className="mb-4 px-0.5 text-sm text-muted-foreground">Pekan {formatDate(materi.weekDate)}</p>

      {materi.description && (
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{materi.description}</p>
      )}

      <ListGroup className="p-5">
        {materi.contentType === 'RICH_TEXT' && materi.contentHtml && (
          <RichTextContent html={materi.contentHtml} />
        )}

        {materi.contentType === 'LINK' && materi.linkUrl && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">Materi tersedia di link berikut:</p>
            <Button asChild className="rounded-xl">
              <a href={materi.linkUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Buka materi
              </a>
            </Button>
          </div>
        )}

        {materi.contentType === 'FILE' && materi.fileUrls?.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">File materi</p>
            <ul className="space-y-2">
              {materi.fileUrls.map((url, i) => {
                const href = getMediaUrl(url);
                const name = url.split('/').pop() || `File ${i + 1}`;
                return (
                  <li key={url}>
                    <a
                      href={href || url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
                    >
                      <Download className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{decodeURIComponent(name)}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </ListGroup>
    </PageContainer>
  );
}
