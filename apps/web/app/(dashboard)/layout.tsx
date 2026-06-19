'use client';

import { RoleGuard } from '@/components/layout/RoleGuard';
import { Sidebar, MobileNavbar } from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard>
      <div className="min-h-screen bg-muted/30">
        <Sidebar />
        <main className="md:ml-64">
          <div className="p-4 pb-20 md:p-6 md:pb-6">{children}</div>
        </main>
        <MobileNavbar />
      </div>
    </RoleGuard>
  );
}
