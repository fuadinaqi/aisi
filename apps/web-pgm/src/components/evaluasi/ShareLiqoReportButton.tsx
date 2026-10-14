import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildLiqoReportText, sharePlainText, type LiqoReportInput } from '@/lib/liqoReport';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';

type ShareLiqoReportButtonProps = LiqoReportInput & {
  className?: string;
  compact?: boolean;
};

export function ShareLiqoReportButton({
  groupName,
  weekDate,
  attendances,
  notes,
  className,
  compact = false,
}: ShareLiqoReportButtonProps) {
  const [pending, setPending] = useState(false);

  const share = async () => {
    try {
      setPending(true);
      const text = buildLiqoReportText({ groupName, weekDate, attendances, notes });
      const result = await sharePlainText(text);
      if (result === 'copied') {
        toastSuccess('Laporan disalin', 'Tempel di grup WhatsApp.');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toastError(err, 'Gagal membagikan laporan');
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={compact ? 'outline' : 'default'}
      size={compact ? 'icon' : 'default'}
      className={cn(compact && 'h-8 w-8 shrink-0', className)}
      disabled={pending}
      aria-label="Bagikan laporan liqo"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void share();
      }}
    >
      <Share2 className="h-4 w-4" />
      {compact ? null : 'Bagikan laporan'}
    </Button>
  );
}
