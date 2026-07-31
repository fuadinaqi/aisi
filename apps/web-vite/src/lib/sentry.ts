import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (!dsn) return;

  const environment =
    (import.meta.env.VITE_APP_ENV as string | undefined) || import.meta.env.MODE;
  const isProd = environment === 'production';

  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    tracesSampleRate: isProd ? 0.1 : 1.0,
  });
}

export function setSentryUser(user: { id: string; email?: string; name?: string } | null) {
  if (!dsn) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, email: user.email, username: user.name });
}

export { Sentry };
