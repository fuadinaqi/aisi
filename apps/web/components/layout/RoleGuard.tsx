'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getPrimaryRole } from '@/lib/utils';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    if (allowedRoles && user) {
      const hasAccess = user.roles.some((r) => allowedRoles.includes(r));
      if (!hasAccess) router.replace('/dashboard');
    }
  }, [user, isAuthenticated, allowedRoles, router]);

  if (!isAuthenticated()) return null;
  return <>{children}</>;
}

export function usePrimaryRole() {
  const user = useAuthStore((s) => s.user);
  return user ? getPrimaryRole(user.roles) : null;
}
