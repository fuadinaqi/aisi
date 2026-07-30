import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function PageHeader({ title, description, action, className, compact }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3',
        compact ? 'px-0.5' : 'px-0.5 pb-1',
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <h1
          className={cn(
            'font-bold tracking-tight text-foreground',
            compact ? 'text-lg md:text-xl' : 'text-xl md:text-2xl',
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="hidden text-sm text-muted-foreground sm:block">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageContainer({
  children,
  className,
  tight,
}: {
  children: React.ReactNode;
  className?: string;
  tight?: boolean;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-6xl',
        tight ? 'space-y-4' : 'space-y-5 md:space-y-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  title,
  children,
  className,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      {title && (
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
