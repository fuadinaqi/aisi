import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getPrimaryRole } from '@/lib/utils';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  totalPoints: number;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  activeRole: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  setActiveRole: (role: string) => void;
  updateRoles: (roles: string[]) => void;
  updateTotalPoints: (totalPoints: number) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

function resolveActiveRole(roles: string[], current: string | null): string {
  if (current && roles.includes(current)) return current;
  return getPrimaryRole(roles);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      activeRole: null,
      setAuth: (user, token) => {
        localStorage.setItem('accessToken', token);
        const activeRole = resolveActiveRole(user.roles, get().activeRole);
        set({ user, accessToken: token, activeRole });
      },
      setActiveRole: (role) => {
        const user = get().user;
        if (!user || !user.roles.includes(role)) return;
        set({ activeRole: role });
      },
      updateRoles: (roles) => {
        set((state) => {
          if (!state.user) return {};
          const activeRole = resolveActiveRole(roles, state.activeRole);
          return { user: { ...state.user, roles }, activeRole };
        });
      },
      updateTotalPoints: (totalPoints) =>
        set((state) =>
          state.user ? { user: { ...state.user, totalPoints } } : {},
        ),
      logout: () => {
        localStorage.removeItem('accessToken');
        set({ user: null, accessToken: null, activeRole: null });
      },
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        activeRole: s.activeRole,
      }),
    },
  ),
);
