import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { publish } from '../hub.js';
import { errorMessage, log } from '../log.js';
import { fetchJson, startPoller } from '../poller.js';
import { getSettings, onSettingsChange } from '../settings.js';

interface Photo {
  id: string;
  src: string;
  author: string;
  authorUrl: string;
  color: string;
  downloadLocation?: string;
}

interface UnsplashPhoto {
  id: string;
  color: string;
  urls: { raw: string };
  user: { name: string; links: { html: string } };
  links: { download_location: string };
}

const UTM = 'utm_source=home_dashboard&utm_medium=referral';
const KEEP_FILES = 8;
export const wallpaperDir = path.join(config.dataDir, 'wallpapers');

let queue: Photo[] = [];
let lastFetch = 0;
let fallbackIndex = Math.floor(Math.random() * 1000);

function fallbackDir() {
  const built = path.join(config.webDir, 'fallback-wallpapers');
  return fs.existsSync(built) ? built : path.resolve('web/public/fallback-wallpapers');
}

function loadFallbacks(): (Photo & { file: string })[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(fallbackDir(), 'credits.json'), 'utf8'));
  } catch {
    return [];
  }
}

const unsplashHeaders = () => ({ Authorization: `Client-ID ${config.unsplashKey}`, 'Accept-Version': 'v1' });

async function refill() {
  // A batch of 30 lasts ~90 minutes at the default interval, far below the API's hourly limit.
  if (Date.now() - lastFetch < 5 * 60_000) return;
  lastFetch = Date.now();
  const topics = getSettings().wallpaper.topics;
  const q = new URLSearchParams({ count: '30', orientation: 'landscape', content_filter: 'high' });
  if (topics.length) q.set('query', topics[Math.floor(Math.random() * topics.length)]);
  const photos = await fetchJson<UnsplashPhoto[]>(`https://api.unsplash.com/photos/random?${q}`, { headers: unsplashHeaders() });
  queue.push(
    ...photos.map((p) => ({
      id: p.id,
      src: `${p.urls.raw}&w=2560&q=80&fm=jpg&fit=max`,
      author: p.user.name,
      authorUrl: `${p.user.links.html}?${UTM}`,
      color: p.color,
      downloadLocation: p.links.download_location,
    })),
  );
}

async function download(photo: Photo): Promise<string> {
  const file = path.join(wallpaperDir, `${photo.id}.jpg`);
  if (!fs.existsSync(file)) {
    const res = await fetch(photo.src, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`image download failed: ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  // Unsplash's API guidelines ask us to ping this whenever a photo is shown.
  if (photo.downloadLocation) {
    fetch(photo.downloadLocation, { headers: unsplashHeaders() }).catch(() => {});
  }
  prune();
  return `/wallpapers/${photo.id}.jpg`;
}

function prune() {
  const files = fs
    .readdirSync(wallpaperDir)
    .map((name) => ({ name, mtime: fs.statSync(path.join(wallpaperDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const f of files.slice(KEEP_FILES)) fs.rmSync(path.join(wallpaperDir, f.name), { force: true });
}

async function nextUnsplash() {
  if (queue.length < 3) {
    try {
      await refill();
    } catch (err) {
      log.warn(`[wallpaper] Unsplash: ${errorMessage(err)}`);
    }
  }
  while (queue.length) {
    const photo = queue.shift()!;
    try {
      return { url: await download(photo), author: photo.author, authorUrl: photo.authorUrl, color: photo.color, source: 'unsplash' };
    } catch (err) {
      log.warn(`[wallpaper] ${errorMessage(err)}`);
    }
  }
  return null;
}

function nextFallback() {
  const fallbacks = loadFallbacks();
  if (!fallbacks.length) return null;
  const photo = fallbacks[fallbackIndex++ % fallbacks.length];
  return { url: `/fallback-wallpapers/${photo.file}`, author: photo.author, authorUrl: photo.authorUrl, color: photo.color, source: 'fallback' };
}

export function startWallpaper() {
  fs.mkdirSync(wallpaperDir, { recursive: true });
  const poller = startPoller('wallpaper', async () => {
    const next = (config.unsplashKey ? await nextUnsplash() : null) ?? nextFallback();
    if (next) publish('wallpaper', { ...next, at: Date.now() });
    return getSettings().wallpaper.intervalMin * 60_000;
  });
  onSettingsChange(
    (s) => s.wallpaper.topics,
    () => {
      queue = [];
      lastFetch = 0;
      poller.refresh();
    },
  );
  onSettingsChange((s) => s.wallpaper.intervalMin, poller.refresh);
  return poller;
}
