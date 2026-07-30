import { useEffect, useState, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleBadge } from '@/components/shared/Badges';
import { getRoleLabel } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';

interface InviteInfo {
  name: string;
  email: string;
  role: string;
  existingUser: boolean;
}

function AcceptRoleForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const updateRoles = useAuthStore((s) => s.updateRoles);
  const setActiveRole = useAuthStore((s) => s.setActiveRole);

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token tidak ditemukan');
      return;
    }
    api
      .get<ApiResponse<InviteInfo>>(`/auth/invitation/${token}`)
      .then((res) => {
        const info = res.data.data;
        setInviteInfo(info);
        if (!info.existingUser) {
          navigate(`/set-password?token=${encodeURIComponent(token)}`, { replace: true });
        }
      })
      .catch((err) => setError(err.response?.data?.message || 'Token tidak valid'));
  }, [token, navigate]);

  const handleAccept = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<
        ApiResponse<{ roles: string[]; addedRole: string; accessToken?: string }>
      >('/auth/accept-role', { token });
      const data = res.data.data;
      if (user && data.accessToken) {
        setAuth(
          { ...user, roles: data.roles },
          data.accessToken,
        );
        setActiveRole(data.addedRole);
      } else if (user) {
        updateRoles(data.roles);
        setActiveRole(data.addedRole);
      }
      setDone(true);
      toastSuccess(res.data.message || 'Peran berhasil ditambahkan');
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Gagal menerima peran');
      toastError(err, 'Gagal menerima peran');
    } finally {
      setLoading(false);
    }
  };

  const loggedIn = !!accessToken && !!user;
  const emailMatch = loggedIn && inviteInfo && user.email === inviteInfo.email;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Terima Peran Tambahan</CardTitle>
        {inviteInfo && (
          <div className="mt-2 space-y-1">
            <p className="text-sm">
              Assalamu&apos;alaikum, <strong>{inviteInfo.name}</strong>
            </p>
            <p className="text-sm text-muted-foreground">{inviteInfo.email}</p>
            <RoleBadge role={inviteInfo.role} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {done ? (
          <p className="text-center text-green-600">
            Peran {inviteInfo ? getRoleLabel(inviteInfo.role) : ''} berhasil ditambahkan.
          </p>
        ) : (
          <>
            {inviteInfo && (
              <p className="text-sm text-muted-foreground">
                Anda diundang menambahkan peran <strong>{getRoleLabel(inviteInfo.role)}</strong> ke
                akun yang sudah ada.
              </p>
            )}

            {!loggedIn && inviteInfo && (
              <div className="space-y-3 rounded-xl bg-muted/50 p-4 text-sm">
                <p>Login terlebih dahulu dengan email undangan untuk menerima peran.</p>
                <Button asChild className="w-full">
                  <Link
                    to={`/login?redirect=${encodeURIComponent(`/accept-role?token=${token}`)}`}
                  >
                    Login dulu
                  </Link>
                </Button>
              </div>
            )}

            {loggedIn && inviteInfo && !emailMatch && (
              <p className="text-sm text-red-500">
                Anda login sebagai {user.email}. Undangan ini untuk {inviteInfo.email}. Logout lalu
                login dengan akun yang diundang.
              </p>
            )}

            {emailMatch && (
              <Button className="w-full" disabled={loading || !inviteInfo} onClick={handleAccept}>
                {loading ? 'Memproses...' : 'Terima peran'}
              </Button>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AcceptRolePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-sky-50 p-4">
      <Suspense fallback={<p>Memuat...</p>}>
        <AcceptRoleForm />
      </Suspense>
    </div>
  );
}
