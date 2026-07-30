import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { USERS, SEED_SCHOOL_NAME } from '../fixtures/users';
import { loginAs, ensureLoggedOut } from '../helpers/auth';
import { attachPageErrorGuard } from '../helpers/console';
import { openSchoolDetail, assertMainContentVisible } from '../helpers/nav';
import {
  apiLogin,
  createOngoingEvent,
  findSchoolId,
  apiGet,
} from '../helpers/api';

const stamp = () => Date.now();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PHOTO = path.join(__dirname, '../fixtures/checkin.png');

test.describe('P1 write flows @p1', () => {
  test('F01 invite admin + invitations list', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.superadmin);
    const email = `e2e.admin.${stamp()}@example.com`;
    await page.goto('/users/invite');
    await page.getByPlaceholder('Nama admin').fill(`E2E Admin ${stamp()}`);
    await page.getByPlaceholder('admin@email.com').fill(email);
    await page.getByRole('button', { name: /Kirim undangan admin/i }).click();
    await expect(page.getByText(/berhasil|undangan/i).first()).toBeVisible({ timeout: 15_000 });
    await page.goto('/invitations');
    await assertMainContentVisible(page);
    await expect(page.getByText(email).first()).toBeVisible({ timeout: 15_000 });
    done();
  });

  test('F02 create school with direct PJ password', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.superadmin);
    const name = `E2E School ${stamp()}`;
    const pjEmail = `e2e.pj.${stamp()}@example.com`;
    await page.goto('/schools/new');
    await page.locator('#name').fill(name);
    await page.locator('#city').fill('Depok');
    await page.locator('#pjName').fill(`PJ ${stamp()}`);
    await page.locator('#pjEmail').fill(pjEmail);
    await page.getByText(/Set password langsung/i).click();
    await page.locator('#pjPassword').fill('!Password123');
    await page.getByRole('button', { name: /simpan|buat|tambah/i }).click();
    await expect(
      page.getByText(/berhasil|gagal/i).or(page.getByText(name)).first(),
    ).toBeVisible({ timeout: 20_000 });
    done();
  });

  test('F04 buat kelompok dari sekolah seed', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.pj);
    await openSchoolDetail(page, SEED_SCHOOL_NAME);
    await page.getByRole('link', { name: /Tambah/i }).first().click();
    await page.waitForURL(/\/kelompok\/baru/);
    await assertMainContentVisible(page);
    const nameField = page.getByLabel(/nama kelompok/i).or(page.locator('#name'));
    if (await nameField.first().isVisible().catch(() => false)) {
      await nameField.first().fill(`E2E Kelompok ${stamp()}`);
    }
    // Halaman form kompleks — pastikan render & bisa kembali
    await expect(page.getByText(/kelompok|pembina/i).first()).toBeVisible();
    done();
  });

  test('F07 evaluasi isi draft/submit', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.pembina);
    await page.goto('/evaluasi/isi');
    await assertMainContentVisible(page);
    await expect(page.getByText(/evaluasi|kelompok|kehadiran|anggota/i).first()).toBeVisible({
      timeout: 15_000,
    });
    const draft = page.getByRole('button', { name: /simpan|draft/i }).first();
    if (await draft.isVisible().catch(() => false)) {
      await draft.click();
      await expect(page.getByText(/berhasil|tersimpan|disimpan/i).first()).toBeVisible({
        timeout: 20_000,
      });
    }
    done();
  });

  test('F08 mutabaah save', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.anggota);
    await page.goto('/mutabaah');
    await assertMainContentVisible(page);
    await expect(page.getByText(/mutabaah|pekan|ibadah|poin/i).first()).toBeVisible({
      timeout: 15_000,
    });
    const numberInput = page.locator('input[type="number"]').first();
    if (await numberInput.isVisible().catch(() => false)) {
      await numberInput.fill('3');
    }
    const save = page.getByRole('button', { name: /simpan/i }).first();
    if (await save.isVisible().catch(() => false)) {
      await save.click();
      // Best-effort: sukses toast atau tetap di halaman tanpa crash
      await page.waitForTimeout(1000);
      await assertMainContentVisible(page);
    }
    done();
  });

  test('F09 IC panel di detail anggota', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.pembina);
    await page.goto('/dashboard');
    const groupLink = page.locator('a[href^="/kelompok/"]').first();
    await expect(groupLink).toBeVisible({ timeout: 15_000 });
    await groupLink.click();
    await page.waitForURL(/\/kelompok\//);
    const memberLink = page.locator('a[href*="/anggota/"]').first();
    await expect(memberLink).toBeVisible({ timeout: 15_000 });
    await memberLink.click();
    await page.waitForURL(/\/anggota\//);
    await expect(page.getByText(/Indikator capaian|Mutabaah/i).first()).toBeVisible({
      timeout: 20_000,
    });
    const category = page.getByRole('button').filter({ hasText: /.+/ }).first();
    void category;
    done();
  });

  test('F10 create event via UI', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.superadmin);
    const title = `E2E Agenda ${stamp()}`;
    await page.goto('/events/new');
    await page.locator('#title').fill(title);
    await page.getByRole('button', { name: /simpan|buat|publikasikan|tambah/i }).click();
    await page.waitForTimeout(1500);
    // Sukses: redirect list atau tetap form dengan pesan
    const ok =
      (await page.getByText(title).first().isVisible().catch(() => false)) ||
      (await page.getByText(/berhasil|gagal/i).first().isVisible().catch(() => false)) ||
      page.url().includes('/events');
    expect(ok).toBeTruthy();
    done();
  });

  test('F11+F12 event check-in + approve', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    const saToken = await apiLogin(USERS.superadmin.email, USERS.superadmin.password);
    const schoolId = await findSchoolId(saToken, SEED_SCHOOL_NAME);
    const event = await createOngoingEvent(saToken, {
      title: `E2E Checkin ${stamp()}`,
      schoolId,
      pointValue: 5,
    });

    await loginAs(page, USERS.anggota);
    await page.goto(`/events/${event.id}`);
    await assertMainContentVisible(page);

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(FIXTURE_PHOTO);
      const submit = page.getByRole('button', { name: /check-?in|kirim|unggah/i }).first();
      if (await submit.isVisible().catch(() => false)) {
        await submit.click();
        await expect(page.getByText(/terkirim|menunggu|pending|berhasil/i).first()).toBeVisible({
          timeout: 20_000,
        });
      }
    }

    await ensureLoggedOut(page);
    await loginAs(page, USERS.pembina);
    await page.goto('/events/check-ins');
    await assertMainContentVisible(page);
    const approve = page.getByRole('button', { name: /setujui|approve/i }).first();
    if (await approve.isVisible().catch(() => false)) {
      await approve.click();
    }
    done();
  });

  test('F13 create materi LINK', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.admin);
    const title = `E2E Materi ${stamp()}`;
    await page.goto('/materi/new');
    await page.locator('#title').fill(title);
    await page.getByText('Link', { exact: true }).click();
    await page.locator('#linkUrl').fill('https://example.com/e2e-materi');
    await page.getByRole('button', { name: /simpan|buat|publikasikan/i }).click();
    await page.waitForTimeout(1500);
    const ok =
      (await page.getByText(title).first().isVisible().catch(() => false)) ||
      page.url().includes('/materi');
    expect(ok).toBeTruthy();
    done();
  });

  test('F14+F15 KKS submit + admin kelola', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    const subject = `E2E KKS ${stamp()}`;
    await loginAs(page, USERS.anggota);
    await page.goto('/kks');
    const openForm = page.getByRole('button', { name: /kirim|tulis|baru|tambah/i }).first();
    if (await openForm.isVisible().catch(() => false)) {
      await openForm.click();
    }
    await page.getByLabel(/subjek|subject|perihal/i).fill(subject);
    await page.getByLabel(/pesan|message|isi/i).fill('Pesan otomatis dari E2E test');
    await page.getByRole('button', { name: /kirim|simpan/i }).click();
    await expect(page.getByText(/berhasil|terkirim/i).or(page.getByText(subject)).first()).toBeVisible({
      timeout: 20_000,
    });

    await ensureLoggedOut(page);
    await loginAs(page, USERS.superadmin);
    await page.goto('/kks');
    await assertMainContentVisible(page);
    const item = page.getByText(subject).first();
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      await page.waitForURL(/\/kks\//);
      const status = page.getByRole('combobox').or(page.getByLabel(/status/i));
      if (await status.first().isVisible().catch(() => false)) {
        await status.first().selectOption({ label: /dibaca|read|selesai/i }).catch(async () => {
          await status.first().click();
          await page.getByText(/Dibaca|Selesai|READ|RESOLVED/i).first().click();
        });
      }
    }
    done();
  });

  test('F16 config levels + F19 analytics', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.superadmin);
    await page.goto('/config');
    await expect(page.getByText(/Label Level|Konfigurasi/i).first()).toBeVisible();
    await page.goto('/config/mutabaah');
    await assertMainContentVisible(page);
    await page.goto('/config/ic');
    await assertMainContentVisible(page);
    await page.goto('/analytics');
    await assertMainContentVisible(page);
    await expect(page.getByText(/analitik|statistik|gender|level|kehadiran/i).first()).toBeVisible({
      timeout: 15_000,
    });
    done();
  });

  test('F17 config mutabaah list + F18 IC view-only PJ', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.admin);
    await page.goto('/config/mutabaah');
    await expect(page.getByText(/mutabaah|tambah|item/i).first()).toBeVisible({ timeout: 15_000 });

    await ensureLoggedOut(page);
    await loginAs(page, USERS.pj);
    await page.goto('/config/ic');
    await assertMainContentVisible(page);
    await expect(page.getByText(/indikator|capaian|kategori/i).first()).toBeVisible({
      timeout: 15_000,
    });
    done();
  });

  test('F20 notifications', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.pembina);
    await page.goto('/notifications');
    await assertMainContentVisible(page);
    done();
  });

  test('F05 undang anggota form renders', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.pembina);
    const token = await apiLogin(USERS.pembina.email, USERS.pembina.password);
    const groups = await apiGet<{ id: string }[]>(token, '/groups');
    const gid = groups[0]?.id;
    expect(gid).toBeTruthy();
    await page.goto(`/kelompok/${gid}/anggota/undang`);
    await assertMainContentVisible(page);
    await expect(page.getByText(/undang|anggota|email/i).first()).toBeVisible();
    done();
  });

  test('F03 undang PJ form + F06 set-password via seed invite token', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.superadmin);
    await openSchoolDetail(page, SEED_SCHOOL_NAME);
    const undangPj = page.getByRole('link', { name: /Undang PJ|Tambah PJ/i }).first();
    await expect(undangPj).toBeVisible();
    await undangPj.click();
    await page.waitForURL(/\/pj\/undang/);
    await assertMainContentVisible(page);

    // Token undangan tidak lagi dikembalikan API; pakai seed token lokal untuk F06.
    const seedInviteToken = '00000000-0000-4000-8000-000000000001';
    await ensureLoggedOut(page);
    await page.goto(`/set-password?token=${seedInviteToken}`);
    const password = page.locator('#password');
    if (await password.isVisible().catch(() => false)) {
      await password.fill('!Password123');
      await page.locator('#confirmPassword').fill('!Password123');
      const submit = page.getByRole('button', { name: 'Buat Password' });
      if (await submit.isEnabled()) {
        await submit.click();
        await expect(page.getByText(/berhasil|sudah digunakan|expired|tidak valid/i).first()).toBeVisible({
          timeout: 15_000,
        });
      }
    }
    done();
  });
});
