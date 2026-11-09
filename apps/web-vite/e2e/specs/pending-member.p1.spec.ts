import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { USERS } from '../fixtures/users';
import {
  API_URL,
  apiGet,
  apiLogin,
  apiPost,
  apiPostRaw,
  assertApiHealthy,
} from '../helpers/api';

const execFileAsync = promisify(execFile);
const stamp = () => Date.now();

type GroupRef = { id: string };
type MemberRow = {
  userId: string;
  user: { id: string; name: string; hasAccount?: boolean; email?: string | null };
};
type AddMemberResult = {
  mode: string;
  userId: string;
  user?: { hasAccount?: boolean };
  invitation?: { id: string };
};
type MemberDetail = { user: { hasAccount?: boolean; email?: string | null; name: string } };
type InvitationRow = { id: string; email: string; status: string };

async function invitationTokenFromDB(email: string): Promise<string | null> {
  const dbUrl = process.env.E2E_DATABASE_URL;
  if (!dbUrl) return null;
  try {
    const { stdout } = await execFileAsync(
      'psql',
      [dbUrl, '-t', '-A', '-c', `SELECT "token" FROM "UserInvitation" WHERE LOWER("email")='${email.toLowerCase()}' AND "status"='PENDING' ORDER BY "createdAt" DESC LIMIT 1`],
      { timeout: 10_000 },
    );
    const token = stdout.trim();
    return token || null;
  } catch {
    return null;
  }
}

async function apiPutExpectFail(token: string, path: string, body: unknown): Promise<number> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.status;
}

test.describe('Pending anggota @p1', () => {
  test.beforeAll(async () => {
    await assertApiHealthy();
  });

  test('PM01 API: tambah pending → hasAccount false → blokir PUT email → aktivasi direct → login', async () => {
    const pembinaToken = await apiLogin(USERS.pembina.email, USERS.pembina.password);
    const groups = await apiGet<GroupRef[]>(pembinaToken, '/groups');
    expect(groups.length).toBeGreaterThan(0);
    const groupId = groups[0].id;
    const name = `E2E Pending ${stamp()}`;

    const created = await apiPost<AddMemberResult>(pembinaToken, `/groups/${groupId}/members`, {
      name,
      phone: '08111222333',
    });
    expect(created.data.mode).toBe('pending');
    expect(created.data.user?.hasAccount).toBe(false);
    const userId = created.data.userId;

    const members = await apiGet<MemberRow[]>(pembinaToken, `/groups/${groupId}/members`);
    const row = members.find((m) => m.userId === userId);
    expect(row?.user.hasAccount).toBe(false);

    const putStatus = await apiPutExpectFail(pembinaToken, `/groups/${groupId}/members/${userId}`, {
      name,
      email: `blocked.${stamp()}@example.com`,
    });
    expect(putStatus).toBe(400);

    const email = `e2e.pending.${stamp()}@example.com`;
    const password = '!Password123';
    await apiPost(pembinaToken, `/groups/${groupId}/members/${userId}/activate-account`, {
      email,
      mode: 'direct',
      password,
    });

    const detail = await apiGet<MemberDetail>(pembinaToken, `/groups/${groupId}/members/${userId}`);
    expect(detail.user.hasAccount).toBe(true);
    expect(detail.user.email).toBe(email);

    await apiLogin(email, password);
  });

  test('PM02 API: aktivasi invite → set-password (existingUser false)', async () => {
    const pembinaToken = await apiLogin(USERS.pembina.email, USERS.pembina.password);
    const groups = await apiGet<GroupRef[]>(pembinaToken, '/groups');
    const groupId = groups[0].id;
    const name = `E2E InviteAct ${stamp()}`;

    const created = await apiPost<AddMemberResult>(pembinaToken, `/groups/${groupId}/members`, { name });
    const userId = created.data.userId;
    const email = `e2e.inviteact.${stamp()}@example.com`;
    const password = '!Password123';

    const invited = await apiPost<AddMemberResult>(
      pembinaToken,
      `/groups/${groupId}/members/${userId}/activate-account`,
      { email, mode: 'invite' },
    );
    expect(invited.data.mode).toBe('invite');
    expect(invited.data.invitation?.id).toBeTruthy();

    let inviteToken = await invitationTokenFromDB(email);
    test.skip(
      !inviteToken,
      'Butuh E2E_DATABASE_URL + psql di PATH untuk mengambil token undangan (alur invite)',
    );

    const metaRes = await fetch(`${API_URL}/api/v1/auth/invitation/${inviteToken}`);
    const metaJson = (await metaRes.json()) as { data: { existingUser?: boolean } };
    expect(metaJson.data.existingUser).toBe(false);

    const setPw = await apiPostRaw(null, '/auth/set-password', {
      token: inviteToken,
      password,
    });
    expect(setPw.status).toBe(200);

    await apiLogin(email, password);

    const detail = await apiGet<MemberDetail>(pembinaToken, `/groups/${groupId}/members/${userId}`);
    expect(detail.user.hasAccount).toBe(true);

    const invitations = await apiGet<InvitationRow[]>(pembinaToken, '/invitations?limit=100');
    const used = invitations.find((i) => i.email === email);
    expect(used?.status).toBe('USED');
  });

  test('PM03 UI: mode tambah data saja di form undang', async ({ page }) => {
    const { loginAs } = await import('../helpers/auth');
    await loginAs(page, USERS.pembina);
    await page.goto('/dashboard');
    const groupLink = page.locator('a[href^="/kelompok/"]').first();
    await expect(groupLink).toBeVisible({ timeout: 15_000 });
    const href = await groupLink.getAttribute('href');
    await page.goto(`${href}/anggota/undang`);
    await expect(page.getByText(/Tambah data saja/i)).toBeVisible();
    await page.getByText(/Tambah data saja/i).click();
    await page.getByPlaceholder('Nama lengkap').fill(`UI Pending ${stamp()}`);
    await page.getByRole('button', { name: /Tambah anggota/i }).click();
    await expect(page).toHaveURL(new RegExp(`${href?.replace(/\//g, '\\/')}$`), { timeout: 15_000 });
  });
});
