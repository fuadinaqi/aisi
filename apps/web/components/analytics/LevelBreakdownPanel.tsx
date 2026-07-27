'use client';

import { ListGroup } from '@/components/layout/AppUI';
import { useGroupLevelLabels } from '@/hooks/useGroupLevelLabels';
import type { LevelBreakdown } from '@/lib/types';

const ROWS: { key: keyof LevelBreakdown; label: string }[] = [
  { key: 'groups', label: 'Kelompok' },
  { key: 'pembina', label: 'Pembina' },
  { key: 'anggota', label: 'Anggota' },
];

export function LevelBreakdownPanel({ data }: { data: LevelBreakdown }) {
  const { getLevelLabel } = useGroupLevelLabels();
  const level1Label = getLevelLabel('LEVEL_1');
  const level2Label = getLevelLabel('LEVEL_2');

  return (
    <ListGroup className="overflow-hidden">
      <div className="border-b border-border/60 px-4 py-3 md:px-5">
        <h3 className="font-semibold">Per level kelompok</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pembagian kelompok, pembina, dan anggota aktif per level
        </p>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr] gap-px bg-border/60 text-sm">
        <div className="bg-card px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:px-5">
          Kategori
        </div>
        <div className="bg-sky-50/80 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-sky-800 md:px-5">
          {level1Label}
        </div>
        <div className="bg-violet-50/80 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-violet-800 md:px-5">
          {level2Label}
        </div>

        {ROWS.map((row) => {
          const counts = data[row.key];
          const total = counts.level1 + counts.level2;
          return (
            <div key={row.key} className="contents">
              <div className="bg-card px-4 py-3 font-medium md:px-5">{row.label}</div>
              <div className="bg-card px-4 py-3 text-center md:px-5">
                <span className="font-bold text-sky-700">{counts.level1}</span>
                {total > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({Math.round((counts.level1 / total) * 100)}%)
                  </span>
                )}
              </div>
              <div className="bg-card px-4 py-3 text-center md:px-5">
                <span className="font-bold text-violet-700">{counts.level2}</span>
                {total > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({Math.round((counts.level2 / total) * 100)}%)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border/60 bg-muted/30 px-4 py-3 md:px-5">
        {ROWS.map((row) => {
          const total = data[row.key].level1 + data[row.key].level2;
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
