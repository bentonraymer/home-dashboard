import ical, { type VEvent } from 'node-ical';
import { getCalendars, onCalendarsChange, type CalendarSource } from '../calendars.js';
import { publish } from '../hub.js';
import { errorMessage, log } from '../log.js';
import { startPoller } from '../poller.js';
import { getSettings, onSettingsChange } from '../settings.js';

export interface CalendarEvent {
  id: string;
  title: string;
  location: string;
  calendar: string;
  color: string;
  allDay: boolean;
  /** ISO timestamp for timed events, YYYY-MM-DD for all-day events. */
  start: string;
  end: string;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'val' in value) return String((value as { val: unknown }).val);
  return '';
}

// node-ical builds all-day dates at local midnight, so read them back with local getters.
function dateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function fetchCalendar(source: CalendarSource, from: Date, to: Date): Promise<CalendarEvent[]> {
  const res = await fetch(source.url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = ical.sync.parseICS(await res.text());
  const out: CalendarEvent[] = [];

  for (const component of Object.values(parsed)) {
    if (!component || component.type !== 'VEVENT') continue;
    const event = component as VEvent;
    if (event.status === 'CANCELLED') continue;
    for (const instance of ical.expandRecurringEvent(event, { from, to, expandOngoing: true })) {
      if (instance.event.status === 'CANCELLED') continue;
      const start = new Date(instance.start);
      const end = instance.end ? new Date(instance.end) : start;
      out.push({
        id: `${event.uid}-${start.getTime()}`,
        title: text(instance.summary) || '(No title)',
        location: text(instance.event.location),
        calendar: source.name,
        color: source.color,
        allDay: instance.isFullDay,
        start: instance.isFullDay ? dateOnly(start) : start.toISOString(),
        end: instance.isFullDay ? dateOnly(end) : end.toISOString(),
      });
    }
  }
  return out;
}

export interface SourceStatus {
  ok: boolean;
  events: number;
  error?: string;
}

/** Per-calendar fetch results, shown next to each calendar in /settings. */
export const calendarStatus = new Map<string, SourceStatus>();

export function startCalendar() {
  const poller = startPoller('calendar', async () => {
    const sources = getCalendars();
    if (!sources.length) {
      publish('calendar', { configured: false, events: [] });
      return 60 * 60_000;
    }
    const { daysAhead } = getSettings().calendar;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + (daysAhead + 1) * 86_400_000);

    const results = await Promise.allSettled(sources.map((c) => fetchCalendar(c, from, to)));
    const events: CalendarEvent[] = [];
    let failed = 0;
    calendarStatus.clear();
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        events.push(...r.value);
        calendarStatus.set(sources[i].id, { ok: true, events: r.value.length });
      } else {
        failed++;
        calendarStatus.set(sources[i].id, { ok: false, events: 0, error: errorMessage(r.reason) });
        log.warn(`[calendar] ${sources[i].name}: ${errorMessage(r.reason)}`);
      }
    });
    if (failed === results.length) throw new Error('every calendar feed failed');

    const time = (e: CalendarEvent) => (e.allDay ? new Date(`${e.start}T00:00:00`).getTime() : Date.parse(e.start));
    events.sort((a, b) => time(a) - time(b) || Number(b.allDay) - Number(a.allDay));
    publish('calendar', { configured: true, events: events.slice(0, 200) });
    return 10 * 60_000;
  });
  onSettingsChange((s) => s.calendar.daysAhead, poller.refresh);
  onCalendarsChange(poller.refresh);
  return poller;
}
