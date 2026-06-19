import { Star } from 'lucide-react';
import { cn, getRoleLabel } from '@/lib/utils';

const roleStyles: Record<string, string> = {
  SUPERADMIN: 'bg-rose-50 text-rose-700 ring-rose-600/10',
  ADMIN: 'bg-violet-50 text-violet-700 ring-violet-600/10',
  PJ_SEKOLAH: 'bg-amber-50 text-amber-800 ring-amber-600/10',
  PEMBINA: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  ANGGOTA: 'bg-sky-50 text-sky-700 ring-sky-600/10',
};

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        roleStyles[role] || 'bg-muted text-muted-foreground ring-border',
        className,
      )}
    >
      {getRoleLabel(role)}
    </span>
  );
}

export function PointBadge({ points, className }: { points: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      <Star className="h-3 w-3 text-amber-500" fill="currentColor" />
      {points.toLocaleString('id-ID')}
    </span>
  );
}

export function InvitationStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    PENDING: 'Menunggu',
    USED: 'Digunakan',
    EXPIRED: 'Kedaluwarsa',
  };
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-800 ring-amber-600/10',
    USED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
    EXPIRED: 'bg-rose-50 text-rose-700 ring-rose-600/10',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        styles[status] || 'bg-muted text-muted-foreground',
      )}
    >
      {labels[status] || status}
    </span>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-card px-6 py-14 text-center shadow-sm ring-1 ring-black/[0.04]">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex min-h-[7.25rem] flex-col rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 text-2xl font-bold leading-none tracking-tight text-foreground">{value}</p>
      <p className="mt-2 min-h-[2rem] text-xs font-medium leading-snug text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
