import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  emptyOptionLabel?: string;
  disabled?: boolean;
  className?: string;
  size?: 'default' | 'sm';
  ariaLabel?: string;
  searchable?: boolean;
};

function normalize(text: string) {
  return text.toLowerCase().trim();
}

export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  emptyText = 'Tidak ada hasil',
  emptyOptionLabel,
  disabled,
  className,
  size = 'default',
  ariaLabel,
  searchable,
}: Props) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const rows = useMemo(
    () => (emptyOptionLabel ? [{ value: '', label: emptyOptionLabel }, ...options] : options),
    [emptyOptionLabel, options],
  );
  const showSearch = searchable ?? rows.length > 7;
  const selected = rows.find((opt) => opt.value === value);
  const displayLabel = selected?.label || placeholder;

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return rows;
    return rows.filter((opt) => normalize(opt.label).includes(q));
  }, [query, rows]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => setRect(triggerRef.current!.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(Math.max(0, rows.findIndex((opt) => opt.value === value)));
    const t = window.setTimeout(() => {
      if (showSearch) searchRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
    // Hanya saat panel dibuka; jangan reset pencarian saat opsi di-render ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const opt = filtered[activeIndex];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
          triggerRef.current?.focus();
        }
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [activeIndex, filtered, onChange, open]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openUp =
    rect != null && window.innerHeight - rect.bottom < 280 && rect.top > window.innerHeight - rect.bottom;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 border border-input bg-background text-left text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'h-9 rounded-lg px-2 py-2' : 'h-10 rounded-xl px-3',
          !selected ? 'text-muted-foreground' : '',
          className,
        )}
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 overflow-hidden rounded-xl border border-border bg-background shadow-lg"
            style={{
              left: rect.left,
              width: Math.max(rect.width, 200),
              top: openUp ? undefined : rect.bottom + 4,
              bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
            }}
          >
            {showSearch && (
              <div className="border-b border-border/70 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="h-9 w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}
            <ul id={listId} role="listbox" className="max-h-60 overflow-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</li>
              ) : (
                filtered.map((opt, index) => {
                  const isSelected = opt.value === value;
                  const isActive = index === activeIndex;
                  return (
                    <li key={`${opt.value}-${index}`} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(opt.value)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm',
                          isActive ? 'bg-muted' : 'hover:bg-muted/70',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
