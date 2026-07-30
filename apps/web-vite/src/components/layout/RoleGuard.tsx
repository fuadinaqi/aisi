
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!accessToken) {
      navigate('/login', { replace: true });
      return;
    }

    if (allowedRoles && user) {
      const hasAccess = user.roles.some((r) => allowedRoles.includes(r));
      if (!hasAccess) navigate('/dashboard', { replace: true });
    }
  }, [mounted, accessToken, user, allowedRoles, navigate]);

  if (!mounted) {
    return <AuthLoadingShell />;
  }

  if (!accessToken) return null;

  if (allowedRoles && user && !user.roles.some((r) => allowedRoles.includes(r))) {
    return null;
  }

  return <>{children}</>;
}

export function usePrimaryRole() {
  const user = useAuthStore((s) => s.user);
  return user ? getPrimaryRole(user.roles) : null;
}
