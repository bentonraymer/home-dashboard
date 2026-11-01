const DAY = 86_400_000;

export function startOfDay(t: number | Date): Date {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Parse YYYY-MM-DD as a local date (not UTC midnight). */
export function localDate(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

export function formatTime(t: number | Date, use24h: boolean, withPeriod = true): string {
  const d = new Date(t);
  if (use24h) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  const mm = m ? `:${String(m).padStart(2, '0')}` : '';
  return withPeriod ? `${h}${mm} ${d.getHours() < 12 ? 'AM' : 'PM'}` : `${h}${mm}`;
}

export function formatHour(t: number, use24h: boolean): string {
  const d = new Date(t);
  if (use24h) return String(d.getHours()).padStart(2, '0');
  return `${d.getHours() % 12 || 12}${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export function dayLabel(date: Date, now: number, long = true): string {
  const diff = daysBetween(new Date(now), date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return date.toLocaleDateString(undefined, { weekday: long ? 'long' : 'short' });
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function relativeTime(t: number, now: number): string {
  const mins = Math.round((now - t) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const deg = (n: number | undefined | null) => (n === undefined || n === null ? '--' : `${Math.round(n)}°`);

/** The big clock's pieces: "9:41", seconds and AM/PM. */
export function clockParts(t: number, use24h: boolean) {
  const d = new Date(t);
  const h = use24h ? String(d.getHours()).padStart(2, '0') : String(d.getHours() % 12 || 12);
  return {
    main: `${h}:${String(d.getMinutes()).padStart(2, '0')}`,
    seconds: String(d.getSeconds()).padStart(2, '0'),
    period: d.getHours() < 12 ? 'AM' : 'PM',
  };
}
