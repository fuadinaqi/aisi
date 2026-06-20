import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HeroGreeting({
  name,
  subtitle,
  badge,
  trailing,
  className,
}: {
  name: string;
  subtitle?: string;
  badge?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-700 p-5 text-primary-foreground shadow-sm md:rounded-3xl md:p-6',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-10 right-10 h-24 w-24 rounded-full bg-white/5" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-primary-foreground/80">Selamat datang</p>
          <h1 className="truncate text-xl font-bold md:text-2xl">Halo, {name}</h1>
          {subtitle && <p className="text-sm text-primary-foreground/75">{subtitle}</p>}
          {badge && <div className="pt-2">{badge}</div>}
        </div>
        {trailing}
      </div>
    </div>
  );
}

export function QuickActionGrid({
  actions,
  className,
}: {
  actions: { href: string; label: string; icon: LucideIcon; color?: string }[];
  className?: string;
}) {
  return (
    <div className={cn('grid gap-2 sm:gap-3', actions.length <= 3 ? 'grid-cols-3' : 'grid-cols-4', className)}>
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="group flex flex-col items-center gap-2 rounded-xl p-2 transition-colors active:bg-black/5"
        >
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-sm ring-1 ring-black/5 transition-transform group-active:scale-95',
              action.color,
            )}
          >
            <action.icon className="h-5 w-5 text-primary" />
          </div>
          <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight text-foreground">
            {action.label}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function AppSectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between px-1', className)}>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

export function ListGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04] md:rounded-3xl',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListRow({
  href,
  onClick,
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  trailing,
  showChevron = true,
  className,
}: {
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  iconClassName?: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  className?: string;
}) {
  const content = (
    <>
      {Icon && (
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10',
            iconClassName,
          )}
        >
          <Icon className="h-5 w-5 text-primary" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{title}</p>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {showChevron && (href || onClick) && (
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
        )}
      </div>
    </>
  );

  const rowClass = cn(
    'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/60 md:px-5 md:py-4',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        {content}
      </button>
    );
  }

  return <div className={rowClass}>{content}</div>;
}

export function ListDivider() {
  return <div className="ml-14 mr-4 border-t border-border/60 md:ml-[4.25rem]" />;
}

export function MetricStrip({
  items,
  className,
}: {
  items: { label: string; value: string | number; sub?: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid divide-x divide-border/60 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-black/[0.04]',
        items.length === 2
          ? 'grid-cols-2'
          : items.length === 3
            ? 'grid-cols-3'
            : items.length === 5
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
              : 'grid-cols-4',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="px-3 py-4 text-center md:px-4">
          <p className="text-lg font-bold text-foreground md:text-xl">{item.value}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{item.label}</p>
          {item.sub && <p className="mt-0.5 text-[10px] text-muted-foreground/80">{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}

export function ProfileHeader({
  name,
  email,
  badge,
  points,
  className,
  avatarClassName,
}: {
  name: string;
  email?: string;
  badge?: React.ReactNode;
  points?: React.ReactNode;
  className?: string;
  avatarClassName?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-black/[0.04] md:rounded-3xl',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary',
          avatarClassName,
        )}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold">{name}</p>
        {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {badge}
          {points}
        </div>
      </div>
    </div>
  );
}
