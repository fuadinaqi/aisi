import { expect, type Page } from '@playwright/test';
import { NAV_BY_ROLE, type SeedUser } from '../fixtures/users';

export async function assertMainContentVisible(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  // Tunggu shell auth selesai (RoleGuard mounting)
  await page.waitForTimeout(300);
  const text = (await page.locator('body').innerText()).trim();
  expect(text.length, `Halaman kosong di ${page.url()}`).toBeGreaterThan(10);
  await expect(page).not.toHaveURL(/\/login/);
}


export async function visitNavPaths(page: Page, role: SeedUser['role']): Promise<void> {
  const items = NAV_BY_ROLE[role];
  for (const item of items) {
    await page.goto(item.href);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
    // RoleGuard redirect ke dashboard jika tidak berhak — untuk nav items seharusnya OK
    if (item.href !== '/dashboard') {
      await expect(page).toHaveURL(new RegExp(item.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    await assertMainContentVisible(page);
  }
}

export async function openSchoolDetail(page: Page, schoolName: string): Promise<void> {
  await page.goto('/schools');
  await page.waitForLoadState('domcontentloaded');
  const link = page.getByRole('link', { name: new RegExp(schoolName, 'i') }).first();
  if (await link.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await link.click();
  } else {
    // Fallback: klik teks nama sekolah (ListRow)
    await page.getByText(schoolName, { exact: true }).first().click({ timeout: 8_000 });
  }
  await page.waitForURL(/\/schools\/[^/]+$/, { timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: schoolName }).or(page.getByText(schoolName).first()),
  ).toBeVisible({ timeout: 10_000 });
}
