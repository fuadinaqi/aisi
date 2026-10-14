import { MutabaahFieldInput, MutabaahFieldLabel } from '@/components/mutabaah/MutabaahFieldInput';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MutabaahAnswerValue, MutabaahFormItem } from '@/lib/mutabaah';

type Props = {
  items: MutabaahFormItem[];
  answers: Record<string, MutabaahAnswerValue>;
  onChange: (itemId: string, value: MutabaahAnswerValue) => void;
  loading?: boolean;
  error?: string;
  compact?: boolean;
  helperText?: string;
  isSubmitted?: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
};

export function MutabaahEntryForm({
  items,
  answers,
  onChange,
  loading,
  error,
  compact,
  helperText,
  isSubmitted,
  onSaveDraft,
  onSubmit,
}: Props) {
  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
        Belum ada master mutabaah untuk kelompok ini
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {helperText && <p className="text-sm text-muted-foreground">{helperText}</p>}
      <div className={cn('space-y-5', compact ? 'space-y-4' : 'space-y-6')}>
        {items.map((item) => (
          <div key={item.id} className="space-y-3">
            <MutabaahFieldLabel item={item} />
            <MutabaahFieldInput
              item={item}
              value={answers[item.id] ?? item.value}
              onChange={(value) => onChange(item.id, value)}
            />
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {isSubmitted ? (
        <Button className="w-full rounded-xl" disabled={loading} onClick={onSaveDraft}>
          Simpan perubahan
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" disabled={loading} onClick={onSaveDraft}>
            Simpan draft
          </Button>
          <Button className="flex-1 rounded-xl" disabled={loading} onClick={onSubmit}>
            Kirim mutabaah
          </Button>
        </div>
      )}
    </div>
  );
}
