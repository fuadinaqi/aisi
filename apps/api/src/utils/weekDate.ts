/** Normalisasi tanggal ke Senin minggu tersebut (00:00 WIB) */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Cek apakah submit evaluasi tepat waktu (<= Minggu 23:59) */
export function isSubmitOnTime(weekDate: Date, submittedAt: Date): boolean {
  const sunday = new Date(weekDate);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return submittedAt <= sunday;
}

export function formatWeekLabel(weekDate: Date): string {
  const end = new Date(weekDate);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `Pekan ${weekDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('id-ID', opts)}`;
}
