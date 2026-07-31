const API_URL = process.env.E2E_API_URL || 'http://localhost:4000';

type ApiEnvelope<T> = { success: boolean; data: T; message?: string };

const tokenCache = new Map<string, string>();

export function clearApiTokenCache(email?: string): void {
  if (email) tokenCache.delete(email);
  else tokenCache.clear();
}

export async function apiLogin(email: string, password: string): Promise<string> {
  const cached = tokenCache.get(email);
  if (cached) return cached;

  let lastErr = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    if (!res.ok) {
      lastErr = await res.text();
      throw new Error(`API login gagal (${res.status}): ${lastErr}`);
    }
    const json = (await res.json()) as ApiEnvelope<{ accessToken: string }>;
    tokenCache.set(email, json.data.accessToken);
    return json.data.accessToken;
  }
  throw new Error(`API login rate-limited: ${lastErr || '429'}`);
}

export async function apiGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`API GET ${path} gagal (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

export async function apiPost<T>(
  token: string,
  path: string,
  body: unknown,
): Promise<{ status: number; data: T; message?: string }> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok) {
    throw new Error(`API POST ${path} gagal (${res.status}): ${json.message || (await res.text())}`);
  }
  return { status: res.status, data: json.data, message: json.message };
}

export async function apiPut<T>(
  token: string,
  path: string,
  body: unknown,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok) {
    throw new Error(`API PUT ${path} gagal (${res.status}): ${json.message || ''}`);
  }
  return { status: res.status, data: json.data };
}

export async function assertApiHealthy(): Promise<void> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) {
    throw new Error(
      `API tidak sehat di ${API_URL}/health (${res.status}). Jalankan api-go di :4000.`,
    );
  }
}

export async function findSchoolId(token: string, name: string): Promise<string> {
  const schools = await apiGet<{ id: string; name: string }[]>(token, '/schools');
  const school = schools.find((s) => s.name === name);
  if (!school) throw new Error(`Sekolah "${name}" tidak ditemukan`);
  return school.id;
}

export async function createOngoingEvent(
  token: string,
  opts: { title: string; schoolId?: string; pointValue?: number },
): Promise<{ id: string }> {
  const now = Date.now();
  const startAt = new Date(now - 60 * 60 * 1000).toISOString();
  const endAt = new Date(now + 2 * 60 * 60 * 1000).toISOString();
  const { data } = await apiPost<{ id: string }>(token, '/events', {
    title: opts.title,
    description: 'Event E2E otomatis',
    location: 'Depok',
    startAt,
    endAt,
    pointValue: opts.pointValue ?? 10,
    schoolId: opts.schoolId ?? null,
    targetLevels: ['LEVEL_1', 'LEVEL_2'],
    isPublished: true,
  });
  return data;
}

export { API_URL };
