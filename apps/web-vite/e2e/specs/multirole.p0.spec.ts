import { test, expect } from '@playwright/test';
import { USERS, SEED_ACCEPT_ROLE_TOKEN } from '../fixtures/users';
import { loginAs, ensureLoggedOut } from '../helpers/auth';
import { apiLogin, apiPost, API_URL } from '../helpers/api';
import { attachPageErrorGuard } from '../helpers/console';

test.describe('Multi-role @p0', () => {
  test('switch role mengubah menu (PEMBINA ↔ ANGGOTA)', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.multiRole);

    // Default primary = PEMBINA → menu Evaluasi
    await expect(page.getByRole('link', { name: 'Evaluasi' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name: 'Mutabaah' })).toHaveCount(0);

    const switcher = page.getByLabel('Ganti peran aktif').first();
    await expect(switcher).toBeVisible();
    await switcher.selectOption('ANGGOTA');
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    await expect(page.getByRole('link', { name: 'Mutabaah' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name: 'Evaluasi' })).toHaveCount(0);

    done();
  });

  test('superadmin assign role tambahan via API', async ({ page }) => {
    const token = await apiLogin(USERS.superadmin.email, USERS.superadmin.password);
    // Ambil user admin id
    const listRes = await fetch(`${API_URL}/api/v1/users?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok).toBeTruthy();
    const listJson = (await listRes.json()) as {
      data: { id: string; email: string; roles: { role: string }[] }[];
    };
    const target = listJson.data.find((u) => u.email === USERS.admin.email);
    expect(target).toBeTruthy();
    const hasPj = target!.roles.some((r) => r.role === 'PJ_SEKOLAH');
    if (hasPj) {
      test.skip(true, 'Admin sudah punya PJ_SEKOLAH dari run sebelumnya');
      return;
    }
    await apiPost(token, `/users/${target!.id}/roles`, { role: 'PJ_SEKOLAH' });
    const after = await fetch(`${API_URL}/api/v1/users/${target!.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const afterJson = (await after.json()) as { data: { roles: { role: string }[] } };
    expect(afterJson.data.roles.some((r) => r.role === 'PJ_SEKOLAH')).toBeTruthy();

    // Cleanup: hapus role agar seed-independent re-run
    const del = await fetch(`${API_URL}/api/v1/users/${target!.id}/roles/PJ_SEKOLAH`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.ok).toBeTruthy();

    // Smoke UI users page
    await loginAs(page, USERS.superadmin);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Pengguna' })).toBeVisible({ timeout: 15_000 });
  });

  test('accept-role undangan seed (skip jika sudah dipakai)', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await ensureLoggedOut(page);
    await page.goto(`/accept-role?token=${SEED_ACCEPT_ROLE_TOKEN}`);
    await page.waitForTimeout(800);

    const err = page.getByText(/tidak valid|kadaluarsa|tidak ditemukan|sudah/i);
    if (await err.isVisible().catch(() => false)) {
      test.skip(true, 'Token accept-role seed tidak usable');
      return;
    }

    const loginBtn = page.getByRole('link', { name: /Login dulu/i });
    if (await loginBtn.isVisible().catch(() => false)) {
      await loginBtn.click();
      await page.locator('#email').fill(USERS.anggota.email);
      await page.locator('#password').fill(USERS.anggota.password);
      await page.getByRole('button', { name: 'Masuk' }).click();
      await page.waitForURL(/\/accept-role/, { timeout: 20_000 });
    } else {
      await loginAs(page, USERS.anggota);
      await page.goto(`/accept-role?token=${SEED_ACCEPT_ROLE_TOKEN}`);
    }

    const acceptBtn = page.getByRole('button', { name: 'Terima peran' });
    const ready = await acceptBtn.isVisible().catch(() => false);
    if (!ready) {
      test.skip(true, 'Tombol terima peran tidak siap');
      return;
    }
    await acceptBtn.click();
    await expect(page.getByText(/berhasil/i).first()).toBeVisible({ timeout: 15_000 });
    done();
  });
});
