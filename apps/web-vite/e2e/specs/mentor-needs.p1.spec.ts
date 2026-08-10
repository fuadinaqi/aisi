import { test, expect } from '@playwright/test';
import { USERS, SEED_SCHOOL_NAME } from '../fixtures/users';
import { loginAs, ensureLoggedOut } from '../helpers/auth';
import { attachPageErrorGuard } from '../helpers/console';
import { assertMainContentVisible } from '../helpers/nav';
import { apiLogin, apiGet, apiPut, findSchoolId } from '../helpers/api';

const stamp = () => Date.now();

test.describe('Kebutuhan mentor @p1', () => {
  test('PJ publish → publik list/apply → pendaftar + notifikasi', async ({ page, request }) => {
    const done = attachPageErrorGuard(page);
    const pjToken = await apiLogin(USERS.pj.email, USERS.pj.password);
    const schoolId = await findSchoolId(pjToken, SEED_SCHOOL_NAME);

    await apiPut(pjToken, `/schools/${schoolId}`, {
      address: `Jl. E2E Mentor ${stamp()}`,
      mapsUrl: 'https://maps.google.com/?q=SMAN+1',
    });

    await apiPut(pjToken, `/mentor-needs/schools/${schoolId}`, {
      description: `E2E Senin-Rabu ${stamp()}`,
      needIkhwan: 2,
      needAkhwat: 1,
      isPublished: true,
    });

    // Kuota tidak boleh di bawah filled (0 filled → boleh 1)
    await apiPut(pjToken, `/mentor-needs/schools/${schoolId}`, {
      description: `E2E Senin-Rabu ${stamp()}`,
      needIkhwan: 1,
      needAkhwat: 1,
      isPublished: true,
    });

    const pub = await request.get(
      `${process.env.E2E_API_URL || 'http://localhost:4000'}/api/v1/calon-mentor`,
    );
    expect(pub.ok()).toBeTruthy();
    const pubJson = await pub.json();
    expect(pubJson.data.some((x: { schoolId: string }) => x.schoolId === schoolId)).toBeTruthy();

    await ensureLoggedOut(page);
    await page.goto('/calon-mentor');
    await expect(page.getByText(SEED_SCHOOL_NAME).first()).toBeVisible({ timeout: 15_000 });

    await page.goto(`/calon-mentor/${schoolId}`);
    await assertMainContentVisible(page);
    await page.locator('#name').fill(`Calon E2E ${stamp()}`);
    await page.locator('#whatsapp').fill('081234567890');
    await page.locator('#age').fill('20');
    await page.getByText(/Ikhwan/i).first().click();
    await page.locator('#address').fill('Jl. Melati E2E');
    await page.locator('#asalSma').fill('SMAN 99');
    await page.locator('#murobbiName').fill('Ustadz E2E');
    await page.locator('#murobbiWhatsapp').fill('081111111111');
    await page.getByRole('button', { name: /Kirim pendaftaran/i }).click();
    await expect(page.getByText(/terkirim|berhasil/i).first()).toBeVisible({ timeout: 15_000 });

    // WA invalid ditolak API
    const bad = await request.post(
      `${process.env.E2E_API_URL || 'http://localhost:4000'}/api/v1/calon-mentor/${schoolId}/apply`,
      {
        data: {
          name: 'Bad WA',
          whatsapp: '123',
          age: 20,
          gender: 'IKHWAN',
          address: 'x',
          asalSma: 'y',
          murobbiName: 'z',
          murobbiWhatsapp: '081234567890',
        },
      },
    );
    expect(bad.status()).toBe(400);

    const apps = await apiGet<{ id: string; status: string }[]>(
      pjToken,
      `/mentor-needs/schools/${schoolId}/applications`,
    );
    expect(apps.length).toBeGreaterThan(0);

    const notifs = await apiGet<{ items: { type: string; title: string }[]; unreadCount: number }>(
      pjToken,
      '/notifications?limit=20',
    );
    expect(notifs.items.some((n) => n.type === 'NEW_MENTOR_APPLICATION')).toBeTruthy();

    await loginAs(page, USERS.pj);
    await page.goto('/kebutuhan-mentor');
    await assertMainContentVisible(page);
    await expect(page.getByRole('button', { name: /Salin link publik/i })).toBeVisible();
    await expect(page.getByText(SEED_SCHOOL_NAME).first()).toBeVisible();

    done();
  });

  test('dashboard kebutuhan mentor visible for PJ', async ({ page }) => {
    const done = attachPageErrorGuard(page);
    await loginAs(page, USERS.pj);
    await page.goto('/kebutuhan-mentor');
    await assertMainContentVisible(page);
    await expect(page.getByText(/Kebutuhan Mentor/i).first()).toBeVisible();
    done();
  });
});
