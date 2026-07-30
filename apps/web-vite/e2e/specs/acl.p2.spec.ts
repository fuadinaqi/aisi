import { test, expect } from '@playwright/test';
import { USERS } from '../fixtures/users';
import { loginAs } from '../helpers/auth';
import { attachPageErrorGuard } from '../helpers/console';
import { assertMainContentVisible } from '../helpers/nav';
import { apiGet, apiLogin, API_URL } from '../helpers/api';

/** Hanya URL yang dilindungi RoleGuard di page component. */
const denied: { as: keyof typeof USERS; url: string }[] = [
  { as: 'anggota', url: '/users' },
  { as: 'anggota', url: '/users/invite' },
  { as: 'anggota', url: '/schools/new' },
  { as: 'anggota', url: '/config' },
  { as: 'anggota', url: '/config/mutabaah' },
  { as: 'anggota', url: '/analytics' },
  { as: 'anggota', url: '/events/new' },
  { as: 'anggota', url: '/materi/new' },
  { as: 'anggota', url: '/pembina' },
  { as: 'pembina', url: '/users' },
  { as: 'pembina', url: '/schools/new' },
  { as: 'pembina', url: '/config' },
  { as: 'pembina', url: '/config/mutabaah' },
  { as: 'pembina', url: '/analytics' },
  { as: 'pembina', url: '/mutabaah' },
  { as: 'pembina', url: '/events/new' },
  { as: 'pembina', url: '/materi/new' },
  { as: 'pj', url: '/users' },
  { as: 'pj', url: '/config' },
  { as: 'pj', url: '/config/mutabaah' },
  { as: 'pj', url: '/mutabaah' },
  { as: 'pj', url: '/events/check-ins' },
  { as: 'pj', url: '/materi/new' },
  { as: 'admin', url: '/users' },
  { as: 'admin', url: '/users/invite' },
  { as: 'admin', url: '/pembina' },
  { as: 'admin', url: '/mutabaah' },
  { as: 'admin', url: '/events/check-ins' },
];

test.describe('P2 ACL negatif @p2', () => {
  for (const c of denied) {
    test(`${c.as} ditolak dari ${c.url}`, async ({ page }) => {
      const done = attachPageErrorGuard(page);
      await loginAs(page, USERS[c.as]);
      await page.goto(c.url);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
      done();
    });
  }

  test('ANGGOTA tidak punya menu Evaluasi di nav', async ({ page }) => {
    await loginAs(page, USERS.anggota);
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Evaluasi' })).toHaveCount(0);
  });
});

test.describe('P2 orphan + edge @p2', () => {
  test('orphan /leaderboard tidak blank', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.superadmin);
    await page.goto('/leaderboard');
    await assertMainContentVisible(page);
    done();
  });

  test('school detail seed tidak kosong PJ/kelompok', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.superadmin);
    await page.goto('/schools');
    await page.getByText('SMAN 1', { exact: true }).first().click();
    await page.waitForURL(/\/schools\//);
    await expect(page.getByText(/0 kelompok · 0 anggota/)).toHaveCount(0);
    await expect(page.getByText(/Usamah|PJ terdaftar/i).first()).toBeVisible();
    await expect(page.locator('a[href^="/kelompok/"]').first()).toBeVisible();
    done();
  });

  test('detail anggota + mutabaah panel tidak crash', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.superadmin);
    await page.goto('/schools');
    await page.getByText('SMAN 1', { exact: true }).first().click();
    await page.locator('a[href^="/kelompok/"]').first().click();
    await page.locator('a[href*="/anggota/"]').first().click();
    await page.waitForURL(/\/anggota\//);
    await expect(page.getByText(/Detail anggota|Mutabaah|Kehadiran/i).first()).toBeVisible({
      timeout: 20_000,
    });
    done();
  });

  test('invitations deep-link untuk PEMBINA', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.pembina);
    await page.goto('/invitations');
    await expect(page).not.toHaveURL(/\/login/);
    await assertMainContentVisible(page);
    done();
  });

  test('ANGGOTA list groups hanya kelompok sendiri + tidak bisa add member', async () => {
    const anggotaToken = await apiLogin(USERS.anggota.email, USERS.anggota.password);
    const saToken = await apiLogin(USERS.superadmin.email, USERS.superadmin.password);
    const allGroups = await apiGet<{ id: string }[]>(saToken, '/groups');
    expect(allGroups.length).toBeGreaterThan(1);

    const mine = await apiGet<{ id: string }[]>(anggotaToken, '/groups');
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.length).toBeLessThan(allGroups.length);

    const foreign = allGroups.find((g) => !mine.some((m) => m.id === g.id));
    expect(foreign).toBeTruthy();

    const res = await fetch(`${API_URL}/api/v1/groups/${foreign!.id}/members`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anggotaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000099' }),
    });
    expect(res.status).toBe(403);
  });
});
