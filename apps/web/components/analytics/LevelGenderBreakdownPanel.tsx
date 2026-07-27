'use client';

import { ListGroup } from '@/components/layout/AppUI';
import { useGroupLevelLabels } from '@/hooks/useGroupLevelLabels';
import type { GenderCount, LevelGenderBreakdown } from '@/lib/types';

const ROWS: { key: keyof LevelGenderBreakdown; label: string }[] = [
  { key: 'groups', label: 'Kelompok' },
  { key: 'pembina', label: 'Pembina' },
  { key: 'anggota', label: 'Anggota' },
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

export function LevelGenderBreakdownPanel({ data }: { data: LevelGenderBreakdown }) {
  const { getLevelLabel } = useGroupLevelLabels();
  const level1Label = getLevelLabel('LEVEL_1');
  const level2Label = getLevelLabel('LEVEL_2');

  return (
    <ListGroup className="overflow-hidden">
      <div className="border-b border-border/60 px-4 py-3 md:px-5">
        <h3 className="font-semibold">Per level & gender</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Matriks kelompok, pembina, dan anggota aktif per level dan jenis kelamin
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[520px] grid grid-cols-[minmax(5.5rem,1fr)_repeat(4,minmax(4.5rem,1fr))] gap-px bg-border/60 text-sm">
          <div className="bg-card px-3 py-2.5 md:px-5" />
          <div className="col-span-2 bg-sky-50/80 px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-sky-800">
            {level1Label}
          </div>
          <div className="col-span-2 bg-violet-50/80 px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-violet-800">
            {level2Label}
          </div>

          <div className="bg-card px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:px-5">
            Kategori
          </div>
          <div className="bg-indigo-50/60 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-indigo-800 md:text-xs">
            Ikhwan
          </div>
          <div className="bg-fuchsia-50/60 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-fuchsia-800 md:text-xs">
            Akhwat
          </div>
          <div className="bg-indigo-50/60 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-indigo-800 md:text-xs">
            Ikhwan
          </div>
          <div className="bg-fuchsia-50/60 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-fuchsia-800 md:text-xs">
            Akhwat
          </div>

          {ROWS.map((row) => {
            const level1 = data[row.key].level1;
            const level2 = data[row.key].level2;
            const totalLevel1 = level1.ikhwan + level1.akhwat;
            const totalLevel2 = level2.ikhwan + level2.akhwat;
            const grandTotal = totalLevel1 + totalLevel2;

            return (
              <div key={row.key} className="contents">
                <div className="bg-card px-3 py-3 font-medium md:px-5">{row.label}</div>
                <CountCell counts={level1} gender="ikhwan" total={grandTotal} />
                <CountCell counts={level1} gender="akhwat" total={grandTotal} />
                <CountCell counts={level2} gender="ikhwan" total={grandTotal} />
                <CountCell counts={level2} gender="akhwat" total={grandTotal} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border/60 bg-muted/30 px-4 py-3 md:px-5">
        {ROWS.map((row) => {
          const l1 = data[row.key].level1;
          const l2 = data[row.key].level2;
          const total = l1.ikhwan + l1.akhwat + l2.ikhwan + l2.akhwat;
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
