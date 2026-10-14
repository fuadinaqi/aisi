
import { ListGroup } from '@/components/layout/AppUI';
import { useGroupLevelLabels } from '@/hooks/useGroupLevelLabels';
import type { LevelBreakdown, LevelCount } from '@/lib/types';

const ROWS: { key: keyof LevelBreakdown; label: string }[] = [
  { key: 'groups', label: 'Kelompok' },
  { key: 'pembina', label: 'Pembina' },
  { key: 'anggota', label: 'Anggota' },
];

const LEVEL_KEYS: { key: keyof LevelCount; enum: string; header: string; value: string }[] = [
  { key: 'level0', enum: 'LEVEL_0', header: 'bg-amber-50/80 text-amber-800', value: 'text-amber-700' },
  { key: 'level1', enum: 'LEVEL_1', header: 'bg-sky-50/80 text-sky-800', value: 'text-sky-700' },
  { key: 'level2', enum: 'LEVEL_2', header: 'bg-violet-50/80 text-violet-800', value: 'text-violet-700' },
];

function levelTotal(counts: LevelCount) {
  return counts.level0 + counts.level1 + counts.level2;
}

export function LevelBreakdownPanel({ data }: { data: LevelBreakdown }) {
  const { getLevelLabel } = useGroupLevelLabels();

  return (
    <ListGroup className="overflow-hidden">
      <div className="border-b border-border/60 px-4 py-3 md:px-5">
        <h3 className="font-semibold">Per level kelompok</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pembagian kelompok, pembina, dan anggota aktif per level
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[28rem] grid grid-cols-[1fr_1fr_1fr_1fr] gap-px bg-border/60 text-sm">
          <div className="bg-card px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:px-5">
            Kategori
          </div>
          {LEVEL_KEYS.map((col) => (
            <div
              key={col.key}
              className={`px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide md:px-5 ${col.header}`}
            >
              {getLevelLabel(col.enum)}
            </div>
          ))}

          {ROWS.map((row) => {
            const counts = data[row.key];
            const total = levelTotal(counts);
            return (
              <div key={row.key} className="contents">
                <div className="bg-card px-4 py-3 font-medium md:px-5">{row.label}</div>
                {LEVEL_KEYS.map((col) => (
                  <div key={col.key} className="bg-card px-4 py-3 text-center md:px-5">
                    <span className={`font-bold ${col.value}`}>{counts[col.key]}</span>
                    {total > 0 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({Math.round((counts[col.key] / total) * 100)}%)
                      </span>
                    )}
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
            <span>{levelTotal(data[row.key])} total</span>
          </div>
        ))}
      </div>
    </ListGroup>
  );
}
