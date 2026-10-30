export type WidgetId = 'calendar' | 'todos' | 'hourly' | 'daily' | 'air' | 'countdowns' | 'sports';

export interface Settings {
  location: { name: string; latitude: number | null; longitude: number | null };
  units: 'imperial' | 'metric';
  clock: { use24h: boolean; showSeconds: boolean };
  layout: { left: WidgetId[][]; right: WidgetId[][]; rotatorIntervalSec: number; showNowPlaying: boolean; showNews: boolean };
  wallpaper: { intervalMin: number; topics: string[] };
  calendar: { daysAhead: number; maxEvents: number };
  todos: { filter: string; maxTasks: number };
  news: { feeds: { name: string; url: string }[]; intervalSec: number };
  sports: { teams: { league: string; id: string; name: string; abbr: string; logo: string }[] };
  countdowns: { id: string; name: string; date: string; yearly: boolean; emoji: string }[];
  display: {
    scale: number;
    lowPower: boolean;
    burnInShift: boolean;
    kenBurns: boolean;
    nightDim: { enabled: boolean; start: string; end: string; level: number };
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  location: string;
  calendar: string;
  color: string;
  allDay: boolean;
  start: string;
  end: string;
}

export interface Task {
  id: string;
  content: string;
  priority: number;
  due: string | null;
  hasTime: boolean;
  recurring: boolean;
  project: { name: string; color: string } | null;
}

export interface Weather {
  configured: boolean;
  location?: string;
  units?: 'imperial' | 'metric';
  current?: { temp: number; feelsLike: number; humidity: number; code: number; isDay: boolean; wind: number; uv: number };
  hourly?: { time: number; temp: number; code: number; pop: number; isDay: boolean }[];
  daily?: { date: string; code: number; hi: number; lo: number; pop: number; uv: number; sunrise: number; sunset: number }[];
  air?: { aqi: number | null; pm25: number | null; pollen: { name: string; value: number }[] } | null;
  moon?: { phase: number; illumination: number; name: string };
}

export interface Game {
  id: string;
  date: string;
  state: 'pre' | 'in' | 'post';
  detail: string;
  home: boolean;
  us: string | null;
  them: string | null;
  won: boolean | null;
  opponent: { abbr: string; name: string; logo: string };
}

export interface TeamSummary {
  key: string;
  league: string;
  name: string;
  abbr: string;
  logo: string;
  color: string;
  record: string;
  live: Game | null;
  next: Game | null;
  last: Game | null;
}

export interface NowPlaying {
  id: string;
  title: string;
  artist: string;
  album: string;
  art: string;
  durationMs: number;
  progressMs: number;
  receivedAt: number;
}

export interface Wallpaper {
  url: string;
  author: string;
  authorUrl: string;
  color: string;
  source: 'unsplash' | 'fallback';
}

export interface DashboardState {
  connected: boolean;
  version: string | null;
  settings: Settings | null;
  weather: Weather | null;
  calendar: { configured: boolean; events: CalendarEvent[] } | null;
  todos: { configured: boolean; tasks: Task[] } | null;
  nowPlaying: NowPlaying | null;
  news: { items: { title: string; source: string; published: number }[] } | null;
  sports: { teams: TeamSummary[] } | null;
  wallpaper: Wallpaper | null;
}

export interface CalendarSource {
  id: string;
  name: string;
  color: string;
  url: string;
}
