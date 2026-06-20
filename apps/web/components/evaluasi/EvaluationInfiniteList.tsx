'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api, type ApiResponse } from '@/lib/api';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';
import { Card } from '@/components/ui/card';
import { formatDate, toDateInputValue } from '@/lib/utils';
import type { EvaluationItem } from '@/lib/types';

const PAGE_SIZE = 20;

type EvaluationInfiniteListProps = {
  queryKey: (string | undefined)[];
  params?: { groupId?: string; schoolId?: string };
  emptyTitle?: string;
  emptyDescription?: string;
  showGroupName?: boolean;
  compact?: boolean;
};

export function EvaluationInfiniteList({
  queryKey,
  params,
  emptyTitle = 'Belum ada evaluasi',
  emptyDescription = 'Riwayat evaluasi akan muncul di sini.',
  showGroupName = true,
  compact = false,
}: EvaluationInfiniteListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [...queryKey, params?.groupId, params?.schoolId],
    queryFn: async ({ pageParam }) => {
      const res = await api.get<ApiResponse<EvaluationItem[]>>('/evaluations', {
        params: {
          page: pageParam,
          limit: PAGE_SIZE,
          ...(params?.groupId ? { groupId: params.groupId } : {}),
          ...(params?.schoolId ? { schoolId: params.schoolId } : {}),
        },
      });
      return {
        items: res.data.data,
        pagination: res.data.pagination ?? { page: pageParam, limit: PAGE_SIZE, total: 0, totalPages: 1 },
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

  const evaluations = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.pagination.total;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '120px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return <LoadingSkeleton className={compact ? 'h-40 rounded-2xl' : 'h-64 rounded-2xl'} />;
  }

  if (!evaluations.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {total !== undefined && total > PAGE_SIZE && (
        <p className="mb-2 px-0.5 text-xs text-muted-foreground">
          Menampilkan {evaluations.length} dari {total} evaluasi
        </p>
      )}

      <Card className="overflow-hidden">
        <div className="divide-y">
          {evaluations.map((e) => {
            const href = e.isSubmitted
              ? `/evaluasi/${e.id}`
              : `/evaluasi/isi?groupId=${e.group.id}&weekDate=${toDateInputValue(new Date(e.weekDate))}`;

            return (
              <Link
                key={e.id}
                href={href}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/30"
              >
                <div>
                  {showGroupName && <p className="font-medium">{e.group.name}</p>}
                  <p className={`text-sm text-muted-foreground ${showGroupName ? '' : 'font-medium text-foreground'}`}>
                    Pekan {formatDate(e.weekDate)}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    e.isSubmitted
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {e.isSubmitted ? 'Terkirim' : 'Draft · Edit'}
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      <div ref={loadMoreRef} className="py-3 text-center text-sm text-muted-foreground">
        {isFetchingNextPage
          ? 'Memuat evaluasi...'
          : hasNextPage
            ? 'Gulir untuk memuat lebih banyak'
            : evaluations.length > PAGE_SIZE
              ? 'Semua evaluasi sudah dimuat'
              : null}
      </div>
    </>
  );
}
