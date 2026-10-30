import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { getCalendars, loadCalendars, saveCalendars } from './calendars.js';
import { checkPin, cookieSecret, isAuthed, pinRequired, requireAuth, signOut } from './auth.js';
import { config } from './config.js';
import { attachClient, publish, snapshot } from './hub.js';
import { calendarStatus, startCalendar } from './integrations/calendar.js';
import { startNews } from './integrations/news.js';
import { LEAGUES, listTeams, startSports } from './integrations/sports.js';
import { authorizeUrl, disconnect, handleCallback, spotifyConfigured, spotifyConnected, startSpotify } from './integrations/spotify.js';
import { startTodoist } from './integrations/todoist.js';
import { wallpaperDir, startWallpaper } from './integrations/wallpaper.js';
import { startWeather } from './integrations/weather.js';
import { errorMessage, log } from './log.js';
import { fetchJson } from './poller.js';
import { DEFAULT_FEEDS, getSettings, loadSettings, saveSettings } from './settings.js';

fs.mkdirSync(config.dataDir, { recursive: true });
loadSettings();
loadCalendars();

const app = Fastify({ logger: false, trustProxy: true });
await app.register(fastifyCookie, { secret: cookieSecret() });

// ---- Display ------------------------------------------------------------

app.get('/api/health', async () => ({ ok: true, version: config.version }));
app.get('/api/state', async () => snapshot());
app.get('/api/stream', (req, reply) => {
  reply.hijack();
  attachClient(reply.raw);
});

// ---- Settings auth ------------------------------------------------------

app.get('/api/session', async (req) => ({ authed: isAuthed(req), pinRequired: pinRequired() }));
app.post<{ Body: { pin?: string } }>('/api/login', async (req, reply) => {
  if (!pinRequired()) return { ok: true };
  if (!checkPin(req, reply, req.body?.pin)) return reply.code(401).send({ error: 'Incorrect PIN' });
  return { ok: true };
});
app.post('/api/logout', async (req, reply) => {
  signOut(reply);
  return { ok: true };
});

// ---- Settings (PIN protected) ------------------------------------------

function status() {
  return {
    pinRequired: pinRequired(),
    calendarStatus: Object.fromEntries(calendarStatus),
    todoist: !!config.todoistToken,
    unsplash: !!config.unsplashKey,
    spotify: { configured: spotifyConfigured(), connected: spotifyConnected(), redirectUri: config.spotify.redirectUri },
    leagues: Object.entries(LEAGUES).map(([key, l]) => ({ key, label: l.label })),
    defaultFeeds: DEFAULT_FEEDS,
  };
}

app.register(async (admin) => {
  admin.addHook('preHandler', requireAuth);

  admin.get('/api/admin', async () => ({ settings: getSettings(), calendars: getCalendars(), status: status() }));
  admin.put('/api/admin/calendars', async (req) => ({ calendars: saveCalendars(req.body) }));
  admin.put('/api/admin/settings', async (req) => {
    const settings = saveSettings(req.body);
    publish('settings', settings);
    return { settings };
  });
  admin.get<{ Querystring: { q?: string } }>('/api/admin/geocode', async (req) => {
    const q = new URLSearchParams({ name: req.query.q ?? '', count: '8', language: 'en', format: 'json' });
    const data = await fetchJson<{ results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] }>(
      `https://geocoding-api.open-meteo.com/v1/search?${q}`,
    );
    return (data.results ?? []).map((r) => ({
      name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
      latitude: r.latitude,
      longitude: r.longitude,
    }));
  });
  admin.get<{ Querystring: { league?: string } }>('/api/admin/teams', async (req) => listTeams(req.query.league ?? ''));
  admin.post('/api/admin/wallpaper/next', async () => {
    pollers.wallpaper.refresh();
    return { ok: true };
  });
  admin.post('/api/admin/refresh', async () => {
    Object.values(pollers).forEach((p) => p.refresh());
    return { ok: true };
  });
  admin.post('/api/admin/spotify/disconnect', async () => {
    disconnect();
    return { ok: true };
  });

  // For when the redirect URI points at 127.0.0.1 but the browser is on another machine:
  // the user pastes the address Spotify sent them to and we finish the exchange here.
  admin.post<{ Body: { url?: string } }>('/api/admin/spotify/finish', async (req, reply) => {
    let params: URLSearchParams;
    try {
      params = new URL(String(req.body?.url ?? '')).searchParams;
    } catch {
      return reply.code(400).send({ error: 'That is not a valid URL' });
    }
    if (!(await finishSpotify(req, reply, params))) return reply.code(400).send({ error: 'Could not connect Spotify with that URL' });
    return { ok: true };
  });

  admin.get('/auth/spotify/login', async (req, reply) => {
    if (!spotifyConfigured()) return reply.code(400).send({ error: 'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first' });
    const state = crypto.randomBytes(16).toString('hex');
    reply.setCookie('hd_spotify_state', state, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600, signed: true });
    return reply.redirect(authorizeUrl(state));
  });
});

/** Exchange a Spotify auth code, checking the signed state cookie set when the flow began. */
async function finishSpotify(req: FastifyRequest, reply: FastifyReply, params: URLSearchParams): Promise<boolean> {
  const raw = req.cookies.hd_spotify_state;
  const expected = raw ? req.unsignCookie(raw) : null;
  const code = params.get('code');
  if (params.get('error') || !code || !expected?.valid || expected.value !== params.get('state')) return false;
  reply.clearCookie('hd_spotify_state', { path: '/' });
  try {
    await handleCallback(code);
    return true;
  } catch (err) {
    log.warn(`[spotify] ${errorMessage(err)}`);
    return false;
  }
}

app.get('/auth/spotify/callback', async (req, reply) => {
  const ok = await finishSpotify(req, reply, new URL(req.url, 'http://x').searchParams);
  return reply.redirect(`/settings?spotify=${ok ? 'connected' : 'error'}`);
});

// ---- Static files -------------------------------------------------------

await app.register(fastifyStatic, {
  root: wallpaperDir,
  prefix: '/wallpapers/',
  decorateReply: false,
  maxAge: '7d',
  immutable: true,
});

if (fs.existsSync(config.webDir)) {
  await app.register(fastifyStatic, {
    root: config.webDir,
    index: false,
    setHeaders(res, file) {
      const hashed = file.includes(`${path.sep}assets${path.sep}`);
      res.header('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  });
  app.get('/', (req, reply) => reply.header('Cache-Control', 'no-cache').sendFile('index.html'));
  app.get('/settings', (req, reply) => reply.header('Cache-Control', 'no-cache').sendFile('settings.html'));
} else {
  log.warn(`No built web app at ${config.webDir} (fine in dev, where Vite serves it)`);
}

// ---- Start --------------------------------------------------------------

publish('settings', getSettings());
const pollers = {
  wallpaper: startWallpaper(),
  weather: startWeather(),
  calendar: startCalendar(),
  todoist: startTodoist(),
  spotify: startSpotify(),
  news: startNews(),
  sports: startSports(),
};

await app.listen({ port: config.port, host: config.host });
log.info(`Home Dashboard listening on http://${config.host}:${config.port}`);
const configured = Object.entries(status())
  .filter(([k]) => ['todoist', 'unsplash'].includes(k))
  .map(([k, v]) => `${k}=${v ? 'on' : 'off'}`);
log.info(`Calendars: ${getCalendars().length}, ${configured.join(', ')}, spotify=${spotifyConfigured() ? (spotifyConnected() ? 'connected' : 'not connected') : 'off'}, PIN ${pinRequired() ? 'set' : 'NOT set'}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.close().finally(() => process.exit(0));
  });
}
