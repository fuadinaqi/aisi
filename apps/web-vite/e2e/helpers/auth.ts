import type { Page } from '@playwright/test';
import type { SeedUser } from '../fixtures/users';
import { API_URL } from './api';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  totalPoints: number;
};

async function loginPayload(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 15_000));
    return loginPayload(email, password);
  }
  if (!res.ok) {
    throw new Error(`API login gagal (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as {
    data: { accessToken: string; user: AuthUser };
  };
  return json.data;
}

const sessionCache = new Map<string, { accessToken: string; user: AuthUser }>();

/** Hapus cache sesi (mis. setelah role user diubah di DB). */
export function clearAuthSessionCache(email?: string): void {
  if (email) sessionCache.delete(email);
  else sessionCache.clear();
}

/** Login via API (hindari rate limit berlebih) lalu inject Zustand persist. */
export async function loginAs(page: Page, user: SeedUser): Promise<void> {
  let session = sessionCache.get(user.email);
  if (!session) {
    session = await loginPayload(user.email, user.password);
    // Pastikan roles string[]
    if (session.user.roles?.length && typeof session.user.roles[0] !== 'string') {
      session.user.roles = (session.user.roles as unknown as { role: string }[]).map((r) =>
        typeof r === 'string' ? r : r.role,
      );
    }
    sessionCache.set(user.email, session);
  }

  const priority = ['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA', 'ANGGOTA'];
  const activeRole =
    priority.find((r) => session.user.roles.includes(r)) || session.user.roles[0] || user.role;

  await page.goto('/login');
  await page.evaluate(
    ({ token, authUser, activeRole: role }) => {
      localStorage.setItem('accessToken', token);
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { user: authUser, accessToken: token, activeRole: role },
          version: 0,
        }),
      );
    },
    { token: session.accessToken, authUser: session.user, activeRole },
  );
  await page.goto('/dashboard');
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  // Tunggu hydrate Zustand + RoleGuard
  await expectVisibleShell(page);
}

async function expectVisibleShell(page: Page): Promise<void> {
  await page.waitForFunction(() => document.body?.innerText?.trim().length > 20, null, {
    timeout: 15_000,
  });
}

export async function logout(page: Page): Promise<void> {
  // Prefer clear storage (stabil di viewport mobile/desktop)
  await page.evaluate(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('auth-storage');
  });
  await page.goto('/login');
  await page.waitForURL(/\/login/, { timeout: 15_000 });
}

export async function ensureLoggedOut(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('auth-storage');
  });
  await page.goto('/login');
}

/** UI login — hanya untuk tes auth form. */
export async function loginViaUi(page: Page, user: SeedUser): Promise<void> {
  await ensureLoggedOut(page);
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await expectVisibleShell(page);
}
