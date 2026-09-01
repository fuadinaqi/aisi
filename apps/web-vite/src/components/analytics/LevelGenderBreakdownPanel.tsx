
import { ListGroup } from '@/components/layout/AppUI';
import { useGroupLevelLabels } from '@/hooks/useGroupLevelLabels';
import type { GenderCount, LevelGenderBreakdown } from '@/lib/types';

const ROWS: { key: keyof LevelGenderBreakdown; label: string }[] = [
  { key: 'groups', label: 'Kelompok' },
  { key: 'pembina', label: 'Pembina' },
  { key: 'anggota', label: 'Anggota' },
];

const LEVEL_KEYS: { key: 'level0' | 'level1' | 'level2'; enum: string; header: string }[] = [
  { key: 'level0', enum: 'LEVEL_0', header: 'bg-amber-50/80 text-amber-800' },
  { key: 'level1', enum: 'LEVEL_1', header: 'bg-sky-50/80 text-sky-800' },
  { key: 'level2', enum: 'LEVEL_2', header: 'bg-violet-50/80 text-violet-800' },
];

function CountCell({
  counts,
  gender,
  total,
}: {
  counts: GenderCount;
  gender: 'ikhwan' | 'akhwat';
  total: number;
}) {
  const value = counts[gender];
  const colorClass = gender === 'ikhwan' ? 'text-indigo-700' : 'text-fuchsia-700';

  return (
    <div className="bg-card px-2 py-3 text-center md:px-3">
      <span className={`font-bold ${colorClass}`}>{value}</span>
      {total > 0 && (
        <span className="ml-1 text-xs text-muted-foreground">
          ({Math.round((value / total) * 100)}%)
        </span>
      )}
    </div>
  );
}

function rowTotal(row: { level0: GenderCount; level1: GenderCount; level2: GenderCount }) {
  return (
    row.level0.ikhwan +
    row.level0.akhwat +
    row.level1.ikhwan +
    row.level1.akhwat +
    row.level2.ikhwan +
    row.level2.akhwat
  );
}

export function LevelGenderBreakdownPanel({ data }: { data: LevelGenderBreakdown }) {
  const { getLevelLabel } = useGroupLevelLabels();

  return (
    <ListGroup className="overflow-hidden">
      <div className="border-b border-border/60 px-4 py-3 md:px-5">
        <h3 className="font-semibold">Per level & gender</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Matriks kelompok, pembina, dan anggota aktif per level dan jenis kelamin
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[680px] grid grid-cols-[minmax(5.5rem,1fr)_repeat(6,minmax(4.5rem,1fr))] gap-px bg-border/60 text-sm">
          <div className="bg-card px-3 py-2.5 md:px-5" />
          {LEVEL_KEYS.map((col) => (
            <div
              key={col.key}
              className={`col-span-2 px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide ${col.header}`}
            >
              {getLevelLabel(col.enum)}
            </div>
          ))}

          <div className="bg-card px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:px-5">
            Kategori
          </div>
          {LEVEL_KEYS.map((col) => (
            <div key={col.key} className="contents">
              <div className="bg-indigo-50/60 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-indigo-800 md:text-xs">
                Ikhwan
              </div>
              <div className="bg-fuchsia-50/60 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-fuchsia-800 md:text-xs">
                Akhwat
              </div>
            </div>
          ))}

          {ROWS.map((row) => {
            const cells = data[row.key];
            const grandTotal = rowTotal(cells);

            return (
              <div key={row.key} className="contents">
                <div className="bg-card px-3 py-3 font-medium md:px-5">{row.label}</div>
                {LEVEL_KEYS.map((col) => (
                  <div key={col.key} className="contents">
                    <CountCell counts={cells[col.key]} gender="ikhwan" total={grandTotal} />
                    <CountCell counts={cells[col.key]} gender="akhwat" total={grandTotal} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border/60 bg-muted/30 px-4 py-3 md:px-5">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{row.label}:</span>
            <span>{rowTotal(data[row.key])} total</span>
          </div>
        ))}
      </div>
    </ListGroup>
  );
}
