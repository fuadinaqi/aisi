'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, School, UserPlus, Mail, Calendar, BookOpen,
  Trophy, Bell, Settings, ClipboardList, LogOut, Menu, X, User,
} from 'lucide-react';
import { useState } from 'react';
import { cn, getPrimaryRole } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { RoleBadge, PointBadge } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';

const navByRole: Record<string, { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  SUPERADMIN: [
    { href: '/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { href: '/schools', label: 'Sekolah', icon: School },
    { href: '/users', label: 'Users', icon: Users },
    { href: '/users/invite', label: 'Undang', icon: UserPlus },
    { href: '/invitations', label: 'Undangan', icon: Mail },
    { href: '/events', label: 'Event', icon: Calendar },
    { href: '/materi', label: 'Materi', icon: BookOpen },
    { href: '/analytics', label: 'Analitik', icon: LayoutDashboard },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/config', label: 'Config', icon: Settings },
    { href: '/notifications', label: 'Notifikasi', icon: Bell },
  ],
  ADMIN: [
    { href: '/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { href: '/schools', label: 'Sekolah', icon: School },
    { href: '/users/invite', label: 'Undang', icon: UserPlus },
    { href: '/invitations', label: 'Undangan', icon: Mail },
    { href: '/events', label: 'Event', icon: Calendar },
    { href: '/materi', label: 'Materi', icon: BookOpen },
    { href: '/analytics', label: 'Analitik', icon: LayoutDashboard },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/config', label: 'Config', icon: Settings },
    { href: '/notifications', label: 'Notifikasi', icon: Bell },
  ],
  PJ_SEKOLAH: [
    { href: '/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { href: '/pembina', label: 'Pembina', icon: Users },
    { href: '/kelompok', label: 'Kelompok', icon: Users },
    { href: '/events', label: 'Event', icon: Calendar },
    { href: '/materi', label: 'Materi', icon: BookOpen },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/notifications', label: 'Notifikasi', icon: Bell },
    { href: '/profile', label: 'Profil', icon: User },
  ],
  PEMBINA: [
    { href: '/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { href: '/kelompok', label: 'Kelompok', icon: Users },
    { href: '/evaluasi', label: 'Evaluasi', icon: ClipboardList },
    { href: '/events', label: 'Event', icon: Calendar },
    { href: '/materi', label: 'Materi', icon: BookOpen },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/notifications', label: 'Notifikasi', icon: Bell },
    { href: '/profile', label: 'Profil', icon: User },
  ],
  ANGGOTA: [
    { href: '/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { href: '/events', label: 'Event', icon: Calendar },
    { href: '/materi', label: 'Materi', icon: BookOpen },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/notifications', label: 'Notifikasi', icon: Bell },
    { href: '/profile', label: 'Profil', icon: User },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);

  if (!user) return null;
  const role = getPrimaryRole(user.roles);
  const nav = navByRole[role] || navByRole.ANGGOTA;

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    router.push('/login');
  };

  const NavLinks = () => nav.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setOpen(false)}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        pathname === item.href || pathname.startsWith(item.href + '/')
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <item.icon className="h-5 w-5" />
      {item.label}
    </Link>
  ));

  return (
    <>
      <button className="fixed left-4 top-4 z-50 rounded-lg bg-background p-2 shadow md:hidden" onClick={() => setOpen(!open)}>
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="border-b p-4">
          <h1 className="text-lg font-bold text-primary">🕌 Dakwah Depok</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{user.name}</span>
            <RoleBadge role={role} />
            <PointBadge points={user.totalPoints} />
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <NavLinks />
        </nav>
        <div className="border-t p-4">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
            <LogOut className="h-5 w-5" /> Logout
          </Button>
        </div>
      </aside>
    </>
  );
}

export function MobileNavbar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  if (!user) return null;

  const role = getPrimaryRole(user.roles);
  const mobileNav = (navByRole[role] || navByRole.ANGGOTA).slice(0, 4);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background md:hidden">
      <div className="flex justify-around py-2">
        {mobileNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-1 text-xs',
              pathname === item.href ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
