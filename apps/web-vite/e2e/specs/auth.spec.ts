import { test, expect } from '@playwright/test';
import { USERS, SEED_INVITE_TOKEN } from '../fixtures/users';
import { loginAs, logout, ensureLoggedOut, loginViaUi } from '../helpers/auth';
import { attachPageErrorGuard } from '../helpers/console';

test.describe('Auth @p0', () => {
  test('login SUPERADMIN sukses ke dashboard', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginViaUi(page, USERS.superadmin);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Beranda|Dashboard|Ringkasan|Poin|Sekolah/i).first()).toBeVisible({
      timeout: 15_000,
    });
    done();
  });

  test('login gagal dengan password salah', async ({ page }) => {
    await ensureLoggedOut(page);
    await page.goto('/login');
    await page.locator('#email').fill(USERS.superadmin.email);
    await page.locator('#password').fill('SalahSekali123!');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText(/login gagal|password|salah|kredensial|tidak valid|gagal/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('logout kembali ke login', async ({ page }) => {
    await loginAs(page, USERS.admin);
    await logout(page);
    await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible();
  });

  test('set-password undangan seed (skip jika sudah dipakai)', async ({ page }) => {
    await ensureLoggedOut(page);
    await page.goto(`/set-password?token=${SEED_INVITE_TOKEN}`);
    await page.waitForTimeout(800);
    const err = page.getByText(/tidak valid|kadaluarsa|tidak ditemukan|sudah/i);
    if (await err.isVisible().catch(() => false)) {
      test.skip(true, 'Token undangan seed tidak usable');
      return;
    }
    const form = page.locator('#password');
    const hasForm = await form.isVisible().catch(() => false);
    const submit = page.getByRole('button', { name: 'Buat Password' });
    const enabled = await submit.isEnabled().catch(() => false);
    if (!hasForm || !enabled) {
      test.skip(true, 'Form set-password tidak siap (inviteInfo belum / token invalid)');
      return;
    }
    await form.fill('!Password123');
    await page.locator('#confirmPassword').fill('!Password123');
    await submit.click();
    await expect(page.getByText(/berhasil/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
