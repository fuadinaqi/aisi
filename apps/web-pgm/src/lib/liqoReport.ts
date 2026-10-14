import { weekPosterMeta } from '@/lib/laporanPoster';

const SECTIONS = [
  { status: 'HADIR', label: 'Hadir' },
  { status: 'IZIN', label: 'Izin' },
  { status: 'SAKIT', label: 'Sakit' },
  { status: 'TIDAK_HADIR', label: 'Tanpa Keterangan' },
] as const;

export type LiqoReportAttendance = {
  name: string;
  status: string;
};

export type LiqoReportInput = {
  groupName: string;
  weekDate: string | Date;
  attendances: LiqoReportAttendance[];
  notes?: string | null;
};

/** Teks rekap liqo untuk dibagikan ke grup, misalnya lewat WhatsApp. */
export function buildLiqoReportText(input: LiqoReportInput): string {
  const { weekLabel, monthLabel } = weekPosterMeta(input.weekDate);
  const lines = [input.groupName.trim() || 'Kelompok', weekLabel, monthLabel, ''];

  for (const section of SECTIONS) {
    const names = input.attendances
      .filter((item) => item.status === section.status)
      .map((item) => item.name.trim())
      .filter((name) => name.length > 0);
    lines.push(`${section.label}:`);
    if (names.length) {
      names.forEach((name, index) => lines.push(`${index + 1}. ${name}`));
    } else {
      lines.push('-');
    }
    lines.push('');
  }

  const notes = input.notes?.trim();
  if (notes) {
    lines.push(notes, '');
  }

  lines.push('✅ Sudah mengisi evaluasi di web');
  return lines.join('\n').trimEnd();
}

export async function sharePlainText(text: string): Promise<'shared' | 'copied'> {
  const payload = { text };
  const canShare =
    typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare(payload));

  if (canShare) {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }

  throw new Error('Tidak bisa membagikan laporan di perangkat ini');
}
