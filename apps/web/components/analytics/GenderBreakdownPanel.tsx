import { ListGroup } from '@/components/layout/AppUI';
import type { GenderBreakdown } from '@/lib/types';

const ROWS: { key: keyof GenderBreakdown; label: string }[] = [
  { key: 'groups', label: 'Kelompok' },
  { key: 'pembina', label: 'Pembina' },
  { key: 'anggota', label: 'Anggota' },
];

export function GenderBreakdownPanel({ data }: { data: GenderBreakdown }) {
  return (
    <ListGroup className="overflow-hidden">
      <div className="border-b border-border/60 px-4 py-3 md:px-5">
        <h3 className="font-semibold">Ikhwan & Akhwat</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pembagian kelompok, pembina, dan anggota aktif
        </p>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr] gap-px bg-border/60 text-sm">
        <div className="bg-card px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:px-5">
          Kategori
        </div>
        <div className="bg-indigo-50/80 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-indigo-800 md:px-5">
          Ikhwan
        </div>
        <div className="bg-fuchsia-50/80 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-fuchsia-800 md:px-5">
          Akhwat
        </div>

        {ROWS.map((row) => {
          const counts = data[row.key];
          const total = counts.ikhwan + counts.akhwat;
          return (
            <div key={row.key} className="contents">
              <div className="bg-card px-4 py-3 font-medium md:px-5">{row.label}</div>
              <div className="bg-card px-4 py-3 text-center md:px-5">
                <span className="font-bold text-indigo-700">{counts.ikhwan}</span>
                {total > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({Math.round((counts.ikhwan / total) * 100)}%)
                  </span>
                )}
              </div>
              <div className="bg-card px-4 py-3 text-center md:px-5">
                <span className="font-bold text-fuchsia-700">{counts.akhwat}</span>
                {total > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({Math.round((counts.akhwat / total) * 100)}%)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border/60 bg-muted/30 px-4 py-3 md:px-5">
        {ROWS.map((row) => {
          const total = data[row.key].ikhwan + data[row.key].akhwat;
          return (
            <div key={row.key} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{row.label}:</span>
              <span>{total} total</span>
            </div>
          );
        })}
      </div>
    </ListGroup>
  );
}
