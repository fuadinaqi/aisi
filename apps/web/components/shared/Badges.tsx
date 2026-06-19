import { cn, getRoleLabel } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const colors: Record<string, string> = {
    SUPERADMIN: 'bg-red-100 text-red-700',
    ADMIN: 'bg-purple-100 text-purple-700',
    PJ_SEKOLAH: 'bg-yellow-100 text-yellow-700',
    PEMBINA: 'bg-emerald-100 text-emerald-700',
    ANGGOTA: 'bg-sky-100 text-sky-700',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[role] || 'bg-gray-100', className)}>
      {getRoleLabel(role)}
    </span>
  );
}

export function PointBadge({ points }: { points: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      ⭐ {points}
    </span>
  );
}

export function InvitationStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    USED: 'bg-green-100 text-green-700',
    EXPIRED: 'bg-red-100 text-red-700',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || 'bg-gray-100')}>
      {status}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-lg font-medium text-muted-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
