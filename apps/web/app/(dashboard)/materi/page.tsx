'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BookOpen, ChevronRight, ExternalLink, FileText, Link2, Plus } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { AppSectionHeader, ListDivider, ListGroup } from '@/components/layout/AppUI';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { formatDate, getPrimaryRole } from '@/lib/utils';
import type { MateriItem } from '@/lib/types';

const typeLabels: Record<string, string> = {
  FILE: 'File',
  LINK: 'Link',
  RICH_TEXT: 'Artikel',
};

const typeIcons = {
  FILE: FileText,
  LINK: Link2,
  RICH_TEXT: BookOpen,
};

export default function MateriPage() {
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : '';
  const canCreate = role === 'SUPERADMIN' || role === 'ADMIN';

  const { data, isLoading } = useQuery<MateriItem[]>({
    queryKey: ['materi'],
    queryFn: async () => (await api.get<ApiResponse<MateriItem[]>>('/materi')).data.data,
  });

  return (
    <PageContainer tight>
      <PageHeader
        title="Materi Pekan"
        compact
        action={
          canCreate ? (
            <Button asChild size="sm" className="rounded-xl">
              <Link href="/materi/new">
                <Plus className="mr-1 h-4 w-4" />
                Tambah
              </Link>
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingSkeleton className="h-64 rounded-2xl" />
      ) : !data?.length ? (
        <EmptyState title="Belum ada materi" description="Materi pembinaan pekan ini akan muncul di sini" />
      ) : (
        <section className="space-y-3">
          <AppSectionHeader title={`${data.length} materi`} />
          <ListGroup>
            {data.map((m, i) => {
              const Icon = typeIcons[m.contentType] || BookOpen;
              return (
                <div key={m.id}>
                  {i > 0 && <ListDivider />}
                  <Link
                    href={`/materi/${m.id}`}
                    className="group/link block px-4 py-4 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring md:px-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium group-hover/link:text-primary">{m.title}</p>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover/link:text-primary" />
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">Pekan {formatDate(m.weekDate)}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {typeLabels[m.contentType] || m.contentType}
                          </span>
                          {m.contentType === 'LINK' && m.linkUrl && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <ExternalLink className="h-3 w-3" />
                              Link eksternal
                            </span>
                          )}
                          {m.contentType === 'FILE' && m.fileUrls?.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {m.fileUrls.length} file
                            </span>
                          )}
                        </div>
                        {m.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </ListGroup>
        </section>
      )}
    </PageContainer>
  );
}
