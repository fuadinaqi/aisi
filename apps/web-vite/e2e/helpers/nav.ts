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
  await page.getByText(schoolName, { exact: true }).first().click();
  await page.waitForURL(/\/schools\/[^/]+$/);
  await expect(page.getByRole('heading', { name: schoolName }).or(page.getByText(schoolName).first())).toBeVisible();
}
