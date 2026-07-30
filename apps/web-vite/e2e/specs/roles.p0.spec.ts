import { test, expect } from '@playwright/test';
import { USERS, SEED_SCHOOL_NAME, NAV_BY_ROLE } from '../fixtures/users';
import { loginAs } from '../helpers/auth';
import { visitNavPaths, openSchoolDetail, assertMainContentVisible } from '../helpers/nav';
import { attachPageErrorGuard } from '../helpers/console';

const roles = [
  USERS.superadmin,
  USERS.admin,
  USERS.pj,
  USERS.pembina,
  USERS.anggota,
] as const;

for (const user of roles) {
  test.describe(`P0 smoke ${user.role} @p0`, () => {
    test(`nav loop ${user.role}`, async ({ page }) => {
      const done = attachPageErrorGuard(page);
      await loginAs(page, user);
      await visitNavPaths(page, user.role);
      expect(NAV_BY_ROLE[user.role].length).toBeGreaterThan(0);
      done();
    });
  });
}

test.describe('P0 nested sekolah → kelompok → anggota @p0', () => {
  test('SUPERADMIN drill-down SMAN 1', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.superadmin);
    await openSchoolDetail(page, SEED_SCHOOL_NAME);

    // PJ dan kelompok harus ada dari seed
    await expect(page.getByText(/Penanggung Jawab|PJ/i).first()).toBeVisible();
    await expect(page.getByText(/Usamah|PJ terdaftar|Undang PJ/i).first()).toBeVisible();
    await expect(page.getByText(/Kelompok/i).first()).toBeVisible();

    // Klik kelompok pertama (hindari empty state)
    const groupLink = page.locator('a[href^="/kelompok/"]').first();
    await expect(groupLink).toBeVisible({ timeout: 15_000 });
    await groupLink.click();
    await page.waitForURL(/\/kelompok\/[^/]+$/);
    await assertMainContentVisible(page);

    const memberLink = page.locator('a[href*="/anggota/"]').first();
    if (await memberLink.isVisible().catch(() => false)) {
      await memberLink.click();
      await page.waitForURL(/\/anggota\//);
      await assertMainContentVisible(page);
      await expect(page.getByText(/anggota|email|kelompok|poin|bergabung/i).first()).toBeVisible({
        timeout: 15_000,
      });
    }
    done();
  });

  test('PEMBINA buka evaluasi nested', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.pembina);
    await page.goto('/evaluasi');
    await assertMainContentVisible(page);
    const isi = page.getByRole('link', { name: /Isi evaluasi|Tambah|Evaluasi baru/i }).first();
    if (await isi.isVisible().catch(() => false)) {
      await isi.click();
      await page.waitForURL(/\/evaluasi/);
      await assertMainContentVisible(page);
    }
    done();
  });

  test('SUPERADMIN config nested', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.superadmin);
    await page.goto('/config');
    await assertMainContentVisible(page);
    await page.goto('/config/mutabaah');
    await assertMainContentVisible(page);
    await page.goto('/config/ic');
    await assertMainContentVisible(page);
    done();
  });

  test('events dan materi detail jika ada data', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.superadmin);

    await page.goto('/events');
    await assertMainContentVisible(page);
    const eventLink = page.locator('a[href^="/events/"]').filter({ hasNotText: /new|check-ins|baru/i }).first();
    if (await eventLink.isVisible().catch(() => false)) {
      await eventLink.click();
      await page.waitForURL(/\/events\/[^/]+/);
      await assertMainContentVisible(page);
    }

    await page.goto('/materi');
    await assertMainContentVisible(page);
    const materiLink = page.locator('a[href^="/materi/"]').filter({ hasNotText: /new|baru/i }).first();
    if (await materiLink.isVisible().catch(() => false)) {
      await materiLink.click();
      await page.waitForURL(/\/materi\/[^/]+/);
      await assertMainContentVisible(page);
    }
    done();
  });
});
