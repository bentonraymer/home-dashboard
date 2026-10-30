import ical, { type VEvent } from 'node-ical';
import { config, type CalendarSource } from '../config.js';
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
  if (!res.ok) throw new Error(`${source.name}: HTTP ${res.status}`);
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

export function startCalendar() {
  const poller = startPoller('calendar', async () => {
    if (!config.calendars.length) {
      publish('calendar', { configured: false, events: [] });
      return 60 * 60_000;
    }
    const { daysAhead } = getSettings().calendar;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + (daysAhead + 1) * 86_400_000);

    const results = await Promise.allSettled(config.calendars.map((c) => fetchCalendar(c, from, to)));
    const events: CalendarEvent[] = [];
    let failed = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') events.push(...r.value);
      else {
        failed++;
        log.warn(`[calendar] ${config.calendars[i].name}: ${errorMessage(r.reason)}`);
      }
    });
    if (failed === results.length) throw new Error('every calendar feed failed');

    const time = (e: CalendarEvent) => (e.allDay ? new Date(`${e.start}T00:00:00`).getTime() : Date.parse(e.start));
    events.sort((a, b) => time(a) - time(b) || Number(b.allDay) - Number(a.allDay));
    publish('calendar', { configured: true, events: events.slice(0, 200) });
    return 10 * 60_000;
  });
  onSettingsChange((s) => s.calendar.daysAhead, poller.refresh);
  return poller;
}
