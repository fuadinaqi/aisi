import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { getPrimaryRole } from '@/lib/utils';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

function AuthLoadingShell() {
  return <div className="min-h-screen bg-[hsl(var(--surface))]" aria-busy="true" aria-label="Memuat" />;
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeRole = useAuthStore((s) => s.activeRole);
  const [mounted, setMounted] = useState(false);

  const effectiveRole = activeRole || (user ? getPrimaryRole(user.roles) : null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!accessToken) {
      navigate('/login', { replace: true });
      return;
    }

    if (allowedRoles && effectiveRole && !allowedRoles.includes(effectiveRole)) {
      navigate('/dashboard', { replace: true });
    }
  }, [mounted, accessToken, effectiveRole, allowedRoles, navigate]);

  if (!mounted) {
    return <AuthLoadingShell />;
  }

  if (!accessToken) return null;

  if (allowedRoles && effectiveRole && !allowedRoles.includes(effectiveRole)) {
    return null;
  }

  return <>{children}</>;
}

/** Role aktif untuk UI (persona). Fallback ke primary jika belum ter-set. */
export function useActiveRole(): string | null {
  const user = useAuthStore((s) => s.user);
  const activeRole = useAuthStore((s) => s.activeRole);
  if (!user) return null;
  if (activeRole && user.roles.includes(activeRole)) return activeRole;
  return getPrimaryRole(user.roles);
}

/** @deprecated Gunakan useActiveRole */
export function usePrimaryRole() {
  return useActiveRole();
}
