import path from 'node:path';

export interface CalendarSource {
  name: string;
  color: string;
  url: string;
}

const CALENDAR_COLORS = ['#0a84ff', '#ff9f0a', '#30d158', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a', '#ac8e68'];

/**
 * CALENDAR_URLS is a comma- or newline-separated list of entries, each either
 * `url`, `name|url` or `name|color|url`.
 */
function parseCalendars(raw: string): CalendarSource[] {
  return raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, i) => {
      const parts = entry.split('|').map((p) => p.trim());
      const url = parts.pop()!.replace(/^webcal:\/\//i, 'https://');
      const name = parts[0] || `Calendar ${i + 1}`;
      const color = parts[1] || CALENDAR_COLORS[i % CALENDAR_COLORS.length];
      return { name, color, url };
    });
}

const env = process.env;
const port = Number(env.PORT ?? 8080);

export const config = {
  port,
  host: env.HOST ?? '0.0.0.0',
  dataDir: path.resolve(env.DATA_DIR ?? './data'),
  webDir: path.resolve(env.WEB_DIR ?? './dist/web'),
  settingsPin: env.SETTINGS_PIN ?? '',
  calendars: parseCalendars(env.CALENDAR_URLS ?? ''),
  todoistToken: env.TODOIST_TOKEN ?? '',
  unsplashKey: env.UNSPLASH_ACCESS_KEY ?? '',
  spotify: {
    clientId: env.SPOTIFY_CLIENT_ID ?? '',
    clientSecret: env.SPOTIFY_CLIENT_SECRET ?? '',
    redirectUri: env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${port}/auth/spotify/callback`,
  },
  // Clients reload themselves when this changes, so a new deploy reaches every screen.
  version: env.APP_VERSION || String(Date.now()),
};
