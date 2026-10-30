import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { errorMessage, log } from './log.js';

export interface CalendarSource {
  id: string;
  name: string;
  color: string;
  url: string;
}

const CALENDAR_COLORS = ['#0a84ff', '#ff9f0a', '#30d158', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a', '#ac8e68'];

// Kept apart from settings.json because secret iCal URLs grant read access to
// the calendar, and settings are broadcast to every screen.
const file = path.join(config.dataDir, 'calendars.json');
const events = new EventEmitter();
let current: CalendarSource[] = [];

function normalize(input: unknown): CalendarSource[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((c) => c && typeof c.url === 'string' && /^(https?|webcal):\/\//i.test(c.url.trim()))
    .map((c, i) => ({
      id: typeof c.id === 'string' && c.id ? c.id : crypto.randomUUID(),
      name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : `Calendar ${i + 1}`,
      color: typeof c.color === 'string' && /^#[0-9a-f]{6}$/i.test(c.color) ? c.color.toLowerCase() : CALENDAR_COLORS[i % CALENDAR_COLORS.length],
      url: c.url.trim().replace(/^webcal:\/\//i, 'https://'),
    }));
}

/** Older installs listed calendars in CALENDAR_URLS as `url`, `name|url` or `name|color|url`. */
function fromEnv(raw: string): CalendarSource[] {
  return normalize(
    raw
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const parts = entry.split('|').map((p) => p.trim());
        const url = parts.pop()!;
        return { name: parts[0], color: parts[1], url };
      }),
  );
}

export function loadCalendars() {
  try {
    if (fs.existsSync(file)) current = normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
    else if (process.env.CALENDAR_URLS) {
      current = fromEnv(process.env.CALENDAR_URLS);
      log.info(`Imported ${current.length} calendar(s) from CALENDAR_URLS; manage them in /settings from now on`);
      saveCalendars(current);
    }
  } catch (err) {
    log.error(`Could not read ${file}: ${errorMessage(err)}`);
  }
  return current;
}

export const getCalendars = () => current;

export function saveCalendars(input: unknown): CalendarSource[] {
  current = normalize(input);
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(current, null, 2), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
  events.emit('change');
  return current;
}

export function onCalendarsChange(fn: () => void) {
  events.on('change', fn);
}
