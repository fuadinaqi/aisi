import { cn, getGenderLabel } from '@/lib/utils';

const GENDER_OPTIONS = [
  { value: 'IKHWAN', label: 'Ikhwan' },
  { value: 'AKHWAT', label: 'Akhwat' },
] as const;

export function GenderBadge({ gender, className }: { gender: string; className?: string }) {
  const isAkhwat = gender === 'AKHWAT';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        isAkhwat
          ? 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/10'
          : 'bg-indigo-50 text-indigo-700 ring-indigo-600/10',
        className,
      )}
    >
      {getGenderLabel(gender)}
    </span>
  );
}

export function GenderSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm',
        className,
      )}
      {...props}
    >
      {GENDER_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function getGroupGenderTheme(gender: string) {
  if (gender === 'AKHWAT') {
    return {
      banner:
        'bg-gradient-to-r from-fuchsia-100/90 via-pink-50 to-rose-50 ring-1 ring-fuchsia-200/70',
      bannerTitle: 'Kelompok Akhwat',
      bannerTitleClass: 'text-fuchsia-950',
      bannerSubtitle: 'text-fuchsia-700/80',
      card: 'ring-fuchsia-100/90 bg-gradient-to-br from-card to-fuchsia-50/25',
      cardLabel: 'text-fuchsia-700/70',
      primaryButton: 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white shadow-md shadow-fuchsia-200/50',
      outlineButton: 'border-fuchsia-200 text-fuchsia-800 hover:bg-fuchsia-50',
      memberLink: 'group-hover/link:text-fuchsia-700',
      memberChevron: 'group-hover/link:text-fuchsia-600',
      inlineLink: 'text-fuchsia-700 hover:text-fuchsia-800',
      pageGlow:
        'before:absolute before:inset-x-0 before:top-0 before:h-48 before:bg-gradient-to-b before:from-fuchsia-100/40 before:to-transparent before:pointer-events-none',
      profileAvatar: 'bg-fuchsia-100 text-fuchsia-700',
    };
  }

  return {
    banner:
      'bg-gradient-to-r from-indigo-100/90 via-sky-50 to-blue-50 ring-1 ring-indigo-200/70',
    bannerTitle: 'Kelompok Ikhwan',
    bannerTitleClass: 'text-indigo-950',
    bannerSubtitle: 'text-indigo-700/80',
    card: 'ring-indigo-100/90 bg-gradient-to-br from-card to-indigo-50/25',
    cardLabel: 'text-indigo-700/70',
    primaryButton: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200/50',
    outlineButton: 'border-indigo-200 text-indigo-800 hover:bg-indigo-50',
    memberLink: 'group-hover/link:text-indigo-700',
    memberChevron: 'group-hover/link:text-indigo-600',
    inlineLink: 'text-indigo-700 hover:text-indigo-800',
    pageGlow:
      'before:absolute before:inset-x-0 before:top-0 before:h-48 before:bg-gradient-to-b before:from-indigo-100/40 before:to-transparent before:pointer-events-none',
    profileAvatar: 'bg-indigo-100 text-indigo-700',
  };
}

export function GenderToggle({
  value,
  onChange,
}: {
  value: 'IKHWAN' | 'AKHWAT';
  onChange: (value: 'IKHWAN' | 'AKHWAT') => void;
}) {
  return (
    <div className="flex gap-2">
      {GENDER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
            value === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
