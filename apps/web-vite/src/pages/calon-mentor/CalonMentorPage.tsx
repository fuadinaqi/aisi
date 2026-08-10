import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, MapPin, RefreshCw } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { AppLogo } from '@/components/layout/AppLogo';
import { PageContainer } from '@/components/layout/PageShell';
import { ListDivider, ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import type { MentorNeedItem } from '@/lib/types';

function QuotaLine({ label, side }: { label: string; side: { filled: number; need: number; remaining: number } }) {
  const full = side.need > 0 && side.remaining === 0;
  return (
    <span
      className={
        full
          ? 'rounded-md bg-destructive/10 px-2 py-0.5 text-xs text-destructive'
          : 'rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800'
      }
    >
      {label}: {side.filled}/{side.need}
      {side.need > 0 ? ` · Sisa ${side.remaining}` : ''}
    </span>
  );
}

export default function CalonMentorPage() {
  const { data, isLoading, isFetching, refetch } = useQuery<MentorNeedItem[]>({
    queryKey: ['calon-mentor'],
    queryFn: async () => (await api.get<ApiResponse<MentorNeedItem[]>>('/calon-mentor')).data.data,
  });

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <AppLogo href="/calon-mentor" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh kuota
          </Button>
        </div>
      </header>

      <main className="px-4 py-6">
        <PageContainer tight className="max-w-2xl">
          <div className="space-y-1 px-0.5">
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">Kuota Mentor</h1>
            <p className="text-sm text-muted-foreground">
              Pilih sekolah dan daftar sesuai kebutuhan Ikhwan/Akhwat.
            </p>
          </div>

          {isLoading ? (
            <LoadingSkeleton className="h-64 rounded-2xl" />
          ) : !data?.length ? (
            <ListGroup>
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Belum ada sekolah yang membuka kebutuhan mentor.
              </div>
            </ListGroup>
          ) : (
            <ListGroup>
              {data.map((item, i) => {
                const totalFilled = item.quota.ikhwan.filled + item.quota.akhwat.filled;
                const totalNeed = item.quota.ikhwan.need + item.quota.akhwat.need;
                const canApply =
                  item.quota.ikhwan.remaining > 0 || item.quota.akhwat.remaining > 0;
                const pjLabel = Array.isArray(item.pjNames) ? item.pjNames.join(', ') : '';

                return (
                  <div key={item.schoolId}>
                    {i > 0 && <ListDivider />}
                    <div className="space-y-3 px-4 py-4 md:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{item.schoolName}</p>
                          <p className="text-sm text-muted-foreground">{item.city}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {totalFilled}/{totalNeed}
                        </span>
                      </div>

                      {item.description ? (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      ) : null}

                      {pjLabel ? (
                        <p className="text-sm text-muted-foreground">PJ: {pjLabel}</p>
                      ) : null}

                      {(item.address || item.mapsUrl) && (
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {item.address ? (
                            <p className="flex items-start gap-1.5">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{item.address}</span>
                            </p>
                          ) : null}
                          {item.mapsUrl ? (
                            <a
                              href={item.mapsUrl}
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

                      <div className="flex flex-wrap gap-1.5">
                        <QuotaLine label="Ikhwan" side={item.quota.ikhwan} />
                        <QuotaLine label="Akhwat" side={item.quota.akhwat} />
                      </div>

                      {canApply ? (
                        <Button asChild className="w-full rounded-xl">
                          <Link to={`/calon-mentor/${item.schoolId}`}>Daftar di sini</Link>
                        </Button>
                      ) : (
                        <Button disabled className="w-full rounded-xl">
                          Kuota penuh
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </ListGroup>
          )}
        </PageContainer>
      </main>
    </div>
  );
}
