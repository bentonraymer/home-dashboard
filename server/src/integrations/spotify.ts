import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { publish } from '../hub.js';
import { log } from '../log.js';
import { startPoller, type Poller } from '../poller.js';

const tokenFile = path.join(config.dataDir, 'spotify.json');
const SCOPES = 'user-read-currently-playing user-read-playback-state';

let refreshToken = '';
let accessToken = '';
let expiresAt = 0;
let poller: Poller | undefined;
let last: { id: string; isPlaying: boolean; progressMs: number; at: number } | null = null;

try {
  refreshToken = JSON.parse(fs.readFileSync(tokenFile, 'utf8')).refresh_token ?? '';
} catch {
  // not connected yet
}

export const spotifyConfigured = () => !!(config.spotify.clientId && config.spotify.clientSecret);
export const spotifyConnected = () => !!refreshToken;

export function authorizeUrl(state: string) {
  const q = new URLSearchParams({
    client_id: config.spotify.clientId,
    response_type: 'code',
    redirect_uri: config.spotify.redirectUri,
    scope: SCOPES,
    state,
  });
  return `https://accounts.spotify.com/authorize?${q}`;
}

async function tokenRequest(params: Record<string, string>) {
  const basic = Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) throw new Error(`Spotify token error: ${body.error ?? res.status}`);
  accessToken = body.access_token;
  expiresAt = Date.now() + (body.expires_in ?? 3600) * 1000 - 60_000;
  if (body.refresh_token) {
    refreshToken = body.refresh_token;
    fs.writeFileSync(tokenFile, JSON.stringify({ refresh_token: refreshToken }), { mode: 0o600 });
  }
}

export async function handleCallback(code: string) {
  await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: config.spotify.redirectUri });
  log.info('[spotify] connected');
  poller?.refresh();
}

export function disconnect() {
  refreshToken = accessToken = '';
  fs.rmSync(tokenFile, { force: true });
  poller?.refresh();
}

interface Playing {
  is_playing: boolean;
  progress_ms: number | null;
  item: null | {
    id: string;
    name: string;
    duration_ms: number;
    type: 'track' | 'episode';
    artists?: { name: string }[];
    album?: { name: string; images: { url: string; width: number }[] };
    show?: { name: string; images: { url: string }[] };
    images?: { url: string }[];
  };
}

export function startSpotify() {
  poller = startPoller('spotify', async () => {
    if (!spotifyConfigured() || !refreshToken) {
      last = null;
      publish('nowPlaying', null);
      return 30 * 60_000;
    }
    if (Date.now() > expiresAt) await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });

    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401) {
      expiresAt = 0;
      return 1000;
    }
    if (res.status === 429) return Number(res.headers.get('retry-after') ?? 30) * 1000;
    if (res.status !== 204 && !res.ok) throw new Error(`currently-playing responded ${res.status}`);

    const body = res.status === 204 ? null : ((await res.json()) as Playing);
    if (!body?.item || !body.is_playing) {
      last = null;
      publish('nowPlaying', null);
      return 15_000;
    }
    const item = body.item;
    const progressMs = body.progress_ms ?? 0;
    // Screens animate the progress bar themselves, so only resend on track changes or drift.
    const expected = last ? last.progressMs + (Date.now() - last.at) : -1;
    if (!last || last.id !== item.id || Math.abs(expected - progressMs) > 4000) {
      last = { id: item.id, isPlaying: true, progressMs, at: Date.now() };
      const images = item.album?.images ?? item.images ?? item.show?.images ?? [];
      publish('nowPlaying', {
        id: item.id,
        title: item.name,
        artist: item.artists?.map((a) => a.name).join(', ') ?? item.show?.name ?? '',
        album: item.album?.name ?? '',
        art: images[0]?.url ?? '',
        durationMs: item.duration_ms,
        progressMs,
        at: last.at,
      });
    }
    return 5000;
  });
  return poller;
}
