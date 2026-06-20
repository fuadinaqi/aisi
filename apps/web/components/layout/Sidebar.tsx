'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  School,
  Mail,
  Calendar,
  BookOpen,
  Bell,
  Settings,
  ClipboardList,
  LogOut,
  User,
  BarChart3,
  LayoutGrid,
  BookHeart,
  ListChecks,
  MessageSquareText,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn, getPrimaryRole, getRoleLabel } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/layout/AppLogo';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navByRole: Record<string, NavItem[]> = {
  SUPERADMIN: [
    { href: '/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { href: '/schools', label: 'Sekolah', icon: School },
    { href: '/users', label: 'Pengguna', icon: Users },
    { href: '/invitations', label: 'Undangan', icon: Mail },
    { href: '/events', label: 'Agenda', icon: Calendar },
    { href: '/materi', label: 'Materi', icon: BookOpen },
    { href: '/analytics', label: 'Analitik', icon: BarChart3 },
    { href: '/kks', label: 'KKS', icon: MessageSquareText },
    { href: '/config', label: 'Pengaturan', icon: Settings },
    { href: '/notifications', label: 'Notifikasi', icon: Bell },
    { href: '/profile', label: 'Profil', icon: User },
  ],
  ADMIN: [
    { href: '/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { href: '/schools', label: 'Sekolah', icon: School },
    { href: '/events', label: 'Agenda', icon: Calendar },
    { href: '/materi', label: 'Materi', icon: BookOpen },
    { href: '/analytics', label: 'Analitik', icon: BarChart3 },
    { href: '/kks', label: 'KKS', icon: MessageSquareText },
    { href: '/config', label: 'Pengaturan', icon: Settings },
    { href: '/notifications', label: 'Notifikasi', icon: Bell },
    { href: '/profile', label: 'Profil', icon: User },
  ],
  PJ_SEKOLAH: [
    { href: '/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { href: '/schools', label: 'Sekolah', icon: School },
    { href: '/pembina', label: 'Pembina', icon: Users },
    { href: '/config/ic', label: 'Indikator Capaian', icon: ListChecks },
    { href: '/events', label: 'Agenda', icon: Calendar },
    { href: '/materi', label: 'Materi', icon: BookOpen },
    { href: '/analytics', label: 'Analitik', icon: BarChart3 },
    { href: '/kks', label: 'KKS', icon: MessageSquareText },
    { href: '/notifications', label: 'Notifikasi', icon: Bell },
    { href: '/profile', label: 'Profil', icon: User },
  ],
  PEMBINA: [
    { href: '/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { href: '/evaluasi', label: 'Evaluasi', icon: ClipboardList },
    { href: '/config/ic', label: 'Indikator Capaian', icon: ListChecks },
    { href: '/events', label: 'Agenda', icon: Calendar },
    { href: '/materi', label: 'Materi', icon: BookOpen },
    { href: '/kks', label: 'KKS', icon: MessageSquareText },
    { href: '/notifications', label: 'Notifikasi', icon: Bell },
    { href: '/profile', label: 'Profil', icon: User },
  ],
  ANGGOTA: [
    { href: '/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { href: '/mutabaah', label: 'Mutabaah', icon: BookHeart },
    { href: '/events', label: 'Agenda', icon: Calendar },
    { href: '/kks', label: 'KKS', icon: MessageSquareText },
    { href: '/notifications', label: 'Notifikasi', icon: Bell },
    { href: '/profile', label: 'Profil', icon: User },
  ],
};

/** Tab bar mobile — maks 4 item + Menu jika ada item lain */
const mobilePrimaryByRole: Record<string, string[]> = {
  SUPERADMIN: ['/dashboard', '/schools', '/notifications', '/profile'],
  ADMIN: ['/dashboard', '/schools', '/notifications', '/profile'],
  PJ_SEKOLAH: ['/dashboard', '/schools', '/notifications', '/profile'],
  PEMBINA: ['/dashboard', '/evaluasi', '/notifications', '/profile'],
  ANGGOTA: ['/dashboard', '/mutabaah', '/notifications', '/profile'],
};

function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/dashboard') return false;
  if (href === '/users') {
    return pathname.startsWith('/users/') && pathname !== '/users/invite';
  }
  if (href === '/schools') {
    return pathname.startsWith('/schools/');
  }
  return pathname.startsWith(`${href}/`);
}

function useNav(role: string) {
  return navByRole[role] || navByRole.ANGGOTA;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  if (!user) return null;
  const role = getPrimaryRole(user.roles);
  const nav = useNav(role);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    logout();
    router.push('/login');
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-card md:flex">
      <div className="flex h-16 items-center px-4">
        <AppLogo href="/dashboard" priority />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              )}
            >
              <item.icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-3">
        <div className="mb-2 rounded-xl bg-muted/50 px-3 py-3">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{getRoleLabel(role)}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 rounded-xl text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </Button>
      </div>
    </aside>
  );
}

function MobileMoreSheet({
  open,
  onClose,
  nav,
  pathname,
  userName,
  roleLabel,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  nav: NavItem[];
  pathname: string;
  userName: string;
  roleLabel: string;
  onLogout: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-3xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            <p className="font-semibold">Menu</p>
            <p className="text-xs text-muted-foreground">
              {userName} · {roleLabel}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            onClick={onClose}
            aria-label="Tutup menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {nav.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {nav.map((item) => {
                const active = isNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors active:bg-muted',
                      active && 'bg-primary/[0.06]',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-2xl transition-all',
                        active
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                          : 'bg-muted text-foreground',
                      )}
                    >
                      <item.icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} />
                    </div>
                    <span
                      className={cn(
                        'line-clamp-2 text-center text-[10px] leading-tight',
                        active ? 'font-semibold text-primary' : 'font-medium text-muted-foreground',
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              Semua menu ada di tab bawah.
            </p>
          )}
        </div>
        <div className="border-t border-border/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => {
              onClose();
              onLogout();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Keluar
          </Button>
        </div>
      </div>
    </div>
  );
}

function MobileTabItem({
  active,
  icon: Icon,
  label,
  href,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span
        className={cn(
          'flex h-8 w-14 items-center justify-center rounded-2xl transition-all duration-200',
          active
            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
            : 'bg-transparent text-muted-foreground',
        )}
      >
        <Icon className={cn('h-[22px] w-[22px]', active && 'stroke-[2.25]')} />
      </span>
      <span
        className={cn(
          'max-w-[4.5rem] truncate text-[10px] leading-none transition-colors',
          active ? 'font-semibold text-primary' : 'font-medium text-muted-foreground',
        )}
      >
        {label}
      </span>
    </>
  );

  const className = cn(
    'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-0.5 py-1.5 transition-transform active:scale-[0.97]',
    active && 'rounded-2xl bg-primary/[0.06]',
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-current={active ? 'page' : undefined}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-current={active ? 'page' : undefined}>
      {inner}
    </button>
  );
}

export function MobileNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [moreOpen, setMoreOpen] = useState(false);

  const role = user ? getPrimaryRole(user.roles) : 'ANGGOTA';
  const nav = useNav(role);
  const primaryHrefs = mobilePrimaryByRole[role] || mobilePrimaryByRole.ANGGOTA;

  const { primaryTabs, moreTabs } = useMemo(() => {
    const primary = primaryHrefs
      .map((href) => nav.find((n) => n.href === href))
      .filter(Boolean) as NavItem[];
    const primarySet = new Set(primaryHrefs);
    const more = nav.filter((n) => !primarySet.has(n.href));
    return {
      primaryTabs: primary,
      moreTabs: more,
    };
  }, [nav, primaryHrefs]);

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    logout();
    router.push('/login');
  };

  const moreActive = moreTabs.some((item) => isNavActive(pathname, item.href));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        <div className="mx-auto max-w-lg rounded-t-[1.25rem] border-t border-border/50 bg-card/98 shadow-[0_-10px_40px_rgba(15,23,42,0.1)] backdrop-blur-xl">
          <div className="flex items-end justify-around px-2 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-2">
            {primaryTabs.map((item) => (
              <MobileTabItem
                key={item.href}
                href={item.href}
                active={isNavActive(pathname, item.href)}
                icon={item.icon}
                label={item.label}
              />
            ))}
            <MobileTabItem
              active={moreActive || moreOpen}
              icon={LayoutGrid}
              label="Menu"
              onClick={() => setMoreOpen(true)}
            />
          </div>
        </div>
      </nav>

      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        nav={moreTabs}
        pathname={pathname}
        userName={user.name}
        roleLabel={getRoleLabel(role)}
        onLogout={handleLogout}
      />
    </>
  );
}

export { navByRole, mobilePrimaryByRole };
