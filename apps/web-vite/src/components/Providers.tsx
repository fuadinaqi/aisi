import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { Sentry, setSentryUser } from '@/lib/sentry';
import { useAuthStore } from '@/store/authStore';

function SentryFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold">Terjadi kesalahan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tim sudah mendapat laporan otomatis. Muat ulang halaman atau coba lagi nanti.
        </p>
        <button
          type="button"
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground"
          onClick={() => window.location.reload()}
        >
          Muat ulang
        </button>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            retry: 1,
          },
        },
      }),
  );

  const user = useAuthStore((s) => s.user);
  const activeRole = useAuthStore((s) => s.activeRole);
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  const previousRole = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (user) setSentryUser({ id: user.id, email: user.email, name: user.name });
    else setSentryUser(null);
  }, [user]);

  useEffect(() => {
    if (!hydrated) return;
    if (previousRole.current === undefined) {
      previousRole.current = activeRole;
      return;
    }
    if (previousRole.current !== activeRole) {
      previousRole.current = activeRole;
      void queryClient.resetQueries();
    }
  }, [activeRole, hydrated, queryClient]);

  return (
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <QueryClientProvider client={queryClient}>
        {hydrated ? children : <div className="min-h-screen bg-[hsl(var(--surface))]" aria-busy="true" aria-label="Memuat" />}
        <Toaster
          position="top-center"
          richColors
          closeButton
          duration={3500}
          toastOptions={{
            classNames: {
              toast: 'font-sans',
            },
          }}
        />
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}
