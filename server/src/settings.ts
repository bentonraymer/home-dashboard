import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { errorMessage, log } from './log.js';

export const WIDGETS = ['calendar', 'todos', 'hourly', 'daily', 'air', 'countdowns', 'sports'] as const;
export type WidgetId = (typeof WIDGETS)[number];

export interface SportsTeam {
  league: string;
  id: string;
  name: string;
  abbr: string;
  logo: string;
}

export interface Countdown {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  yearly: boolean;
  emoji: string;
}

export interface Feed {
  name: string;
  url: string;
}

export const DEFAULT_FEEDS: Feed[] = [
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'The New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
];

export const DEFAULT_SETTINGS = {
  location: { name: '', latitude: null as number | null, longitude: null as number | null },
  units: 'imperial' as 'imperial' | 'metric',
  clock: { use24h: false, showSeconds: false },
  layout: {
    // Each column is a list of slots; a slot with several cards rotates between them.
    left: [['hourly', 'daily', 'air', 'countdowns', 'sports']] as WidgetId[][],
    right: [['calendar'], ['todos']] as WidgetId[][],
    rotatorIntervalSec: 20,
    showNowPlaying: true,
    showNews: true,
  },
  wallpaper: {
    intervalMin: 3,
    topics: ['landscape', 'nature', 'mountains', 'ocean', 'architecture', 'minimal', 'forest', 'desert'],
  },
  calendar: { daysAhead: 7, maxEvents: 10 },
  todos: { filter: 'today | overdue', maxTasks: 8 },
  news: { feeds: DEFAULT_FEEDS, intervalSec: 12 },
  sports: { teams: [] as SportsTeam[] },
  countdowns: [] as Countdown[],
  display: {
    scale: 0.85,
    lowPower: false,
    burnInShift: true,
    kenBurns: true,
    nightDim: { enabled: false, start: '23:00', end: '06:30', level: 0.6 },
  },
};

export type Settings = typeof DEFAULT_SETTINGS;

const file = path.join(config.dataDir, 'settings.json');
const events = new EventEmitter();
let current: Settings = structuredClone(DEFAULT_SETTINGS);

/**
 * Overlay `input` onto `base`, keeping only keys that exist in the defaults
 * and whose type matches, so a bad save can never corrupt the shape.
 */
function merge<T>(base: T, input: unknown): T {
  if (input === undefined) return base;
  if (base === null) return (typeof input === 'number' || input === null ? input : base) as T;
  if (Array.isArray(base)) return (Array.isArray(input) ? input : base) as T;
  if (typeof base === 'object') {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return base;
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const key of Object.keys(out)) out[key] = merge(out[key], (input as Record<string, unknown>)[key]);
    return out as T;
  }
  return (typeof input === typeof base ? input : base) as T;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
}

function normalize(s: Settings): Settings {
  const known = (ids: WidgetId[]) => ids.filter((id) => (WIDGETS as readonly string[]).includes(id));
  // Every card may appear in at most one slot; drop unknown ids and empty slots.
  const seen = new Set<string>();
  const slots = (groups: unknown) =>
    (Array.isArray(groups) ? groups : [])
      .map((group) =>
        known(Array.isArray(group) ? group : []).filter((id) => !seen.has(id) && seen.add(id)),
      )
      .filter((group) => group.length);
  s.layout.left = slots(s.layout.left);
  s.layout.right = slots(s.layout.right);
  s.layout.rotatorIntervalSec = clamp(s.layout.rotatorIntervalSec, 5, 600);
  s.wallpaper.intervalMin = clamp(s.wallpaper.intervalMin, 1, 240);
  s.wallpaper.topics = s.wallpaper.topics.map(String).map((t) => t.trim()).filter(Boolean);
  s.calendar.daysAhead = clamp(Math.round(s.calendar.daysAhead), 1, 60);
  s.calendar.maxEvents = clamp(Math.round(s.calendar.maxEvents), 1, 50);
  s.todos.maxTasks = clamp(Math.round(s.todos.maxTasks), 1, 50);
  s.news.intervalSec = clamp(s.news.intervalSec, 4, 120);
  s.news.feeds = s.news.feeds.filter((f) => f && typeof f.url === 'string' && /^https?:\/\//.test(f.url));
  s.display.nightDim.level = clamp(s.display.nightDim.level, 0, 0.95);
  s.display.scale = clamp(s.display.scale, 0.4, 1.6);
  s.countdowns = s.countdowns.filter((c) => c && typeof c.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date));
  s.sports.teams = s.sports.teams.filter((t) => t && typeof t.league === 'string' && typeof t.id === 'string');
  return s;
}

/** Settings saved before left/right slots had one fixed column and one rotator. */
function migrate(raw: Record<string, any>) {
  const layout = raw?.layout;
  if (layout && !layout.left && !layout.right && (layout.column || layout.rotator)) {
    layout.right = (layout.column ?? []).map((id: string) => [id]);
    layout.left = layout.rotator?.length ? [layout.rotator] : [];
  }
  return raw;
}

export function loadSettings() {
  try {
    if (fs.existsSync(file)) {
      current = normalize(merge(structuredClone(DEFAULT_SETTINGS), migrate(JSON.parse(fs.readFileSync(file, 'utf8')))));
    }
  } catch (err) {
    log.error(`Could not read ${file}, using defaults: ${errorMessage(err)}`);
  }
  return current;
}

export function getSettings(): Settings {
  return current;
}

export function saveSettings(input: unknown): Settings {
  const previous = current;
  current = normalize(merge(structuredClone(DEFAULT_SETTINGS), input));
  fs.mkdirSync(config.dataDir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(current, null, 2));
  fs.renameSync(tmp, file);
  events.emit('change', current, previous);
  return current;
}

/** Call `fn` whenever the slice of settings picked by `select` changes. */
export function onSettingsChange(select: (s: Settings) => unknown, fn: () => void) {
  events.on('change', (next: Settings, prev: Settings) => {
    if (JSON.stringify(select(next)) !== JSON.stringify(select(prev))) fn();
  });
}
