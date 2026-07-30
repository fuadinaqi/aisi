import { RoleGuard } from '@/components/layout/RoleGuard';
import { Sidebar, MobileNavbar } from '@/components/layout/Sidebar';
import { Outlet } from 'react-router-dom';

export function DashboardLayout() {
  return (
    <RoleGuard>
      <div className="min-h-screen bg-[hsl(var(--surface))]">
        <Sidebar />
        <main className="md:pl-64">
          <div className="mx-auto max-w-6xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8 md:pt-8">
            <Outlet />
          </div>
        </main>
        <MobileNavbar />
      </div>
    </RoleGuard>
  );
}
