/** Offset WIB (UTC+7) dalam ms */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Ambil komponen tanggal kalender WIB dari input ISO atau YYYY-MM-DD */
function getWibCalendarParts(input: Date | string): { year: number; month: number; day: number } {
  let instant: number;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    instant = Date.UTC(y, m - 1, d) - WIB_OFFSET_MS;
  } else {
    instant = new Date(input).getTime();
  }
  const wib = new Date(instant + WIB_OFFSET_MS);
  return {
    year: wib.getUTCFullYear(),
    month: wib.getUTCMonth() + 1,
    day: wib.getUTCDate(),
  };
}

/** Normalisasi tanggal ke Senin minggu tersebut (00:00 WIB) */
export function getMonday(date: Date | string): Date {
  const { year, month, day } = getWibCalendarParts(date);
  const wib = new Date(Date.UTC(year, month - 1, day));
  const dow = wib.getUTCDay();
  const mondayDay = day - dow + (dow === 0 ? -6 : 1);
  return new Date(Date.UTC(year, month - 1, mondayDay) - WIB_OFFSET_MS);
}

/** Cek tanggal evaluasi tidak melebihi hari ini */
export function assertWeekDateNotFuture(weekDate: Date | string) {
  const { year, month, day } = getWibCalendarParts(weekDate);
  const selected = new Date(Date.UTC(year, month - 1, day) - WIB_OFFSET_MS);
  const todayParts = getWibCalendarParts(new Date());
  const today = new Date(
    Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day) - WIB_OFFSET_MS,
  );
  if (selected > today) {
    throw new Error('Tanggal evaluasi tidak boleh setelah hari ini');
  }
}

/** Cek pekan mutabaah/evaluasi tidak sebelum pekan bergabung ke kelompok */
export function assertWeekDateNotBeforeJoin(weekDate: Date | string, joinedAt: Date | string) {
  const normalizedWeek = getMonday(weekDate);
  const minWeek = getMonday(joinedAt);
  if (normalizedWeek.getTime() < minWeek.getTime()) {
    throw new Error('Tanggal mutabaah tidak boleh sebelum bergabung ke kelompok');
  }
}

/** Cek apakah submit evaluasi tepat waktu (<= Minggu 23:59 WIB) */
export function isSubmitOnTime(weekDate: Date, submittedAt: Date): boolean {
  const { year, month, day } = getWibCalendarParts(weekDate);
  const sundayDay = day + 6;
  const sunday = new Date(Date.UTC(year, month - 1, sundayDay, 23, 59, 59, 999) - WIB_OFFSET_MS);
  return submittedAt <= sunday;
}

export function formatWeekLabel(weekDate: Date): string {
  const { year, month, day } = getWibCalendarParts(weekDate);
  const monday = new Date(Date.UTC(year, month - 1, day) - WIB_OFFSET_MS);
  const end = new Date(Date.UTC(year, month - 1, day + 6) - WIB_OFFSET_MS);
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  };
  return `Pekan ${monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })} - ${end.toLocaleDateString('id-ID', opts)}`;
}
