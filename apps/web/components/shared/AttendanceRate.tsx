import { cn } from '@/lib/utils';

type AttendanceRateProps = {
  rate: number | null;
  totalHadir: number;
  totalPekan: number;
  totalSlots?: number;
  variant?: 'member' | 'group';
  align?: 'left' | 'right';
  className?: string;
};

export function AttendanceRate({
  rate,
  totalHadir,
  totalPekan,
  totalSlots,
  variant = 'member',
  align = 'right',
  className,
}: AttendanceRateProps) {
  const empty = totalPekan === 0;
  const alignClass = align === 'right' ? 'text-right' : 'text-left';

  if (empty) {
    return (
      <div className={cn('shrink-0 text-xs text-muted-foreground', alignClass, className)}>
        Belum ada evaluasi
      </div>
    );
  }

  const color =
    rate === null
      ? 'text-muted-foreground'
      : rate >= 80
        ? 'text-emerald-600'
        : rate >= 50
          ? 'text-amber-600'
          : 'text-red-500';

  const detail =
    variant === 'group' && totalSlots !== undefined
      ? `${totalHadir}/${totalSlots} kehadiran · ${totalPekan} pekan`
      : `${totalHadir}/${totalPekan} pekan hadir`;

  return (
    <div className={cn('shrink-0', alignClass, className)}>
      <p className={cn('text-sm font-semibold tabular-nums', color)}>{rate}%</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
