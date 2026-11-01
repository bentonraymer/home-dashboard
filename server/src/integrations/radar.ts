import { PNG } from 'pngjs';
import { publish } from '../hub.js';
import { fetchJson, startPoller } from '../poller.js';
import { getSettings, onSettingsChange } from '../settings.js';

interface WeatherMaps {
  host: string;
  radar: { past: { time: number; path: string }[] };
}

// RainViewer serves radar tiles up to zoom 7 (about 1 km per pixel); higher zooms return a placeholder.
export const RADAR_ZOOM = 7;
const TILE = 256;
// Ignore a few stray pixels (clutter, the odd speck) so the card only shows up for real weather.
const MIN_PIXELS = 12;
const MIN_COVERAGE = 0.002;
// In RainViewer's colour scheme the alpha channel tracks intensity; the faintest echoes are mostly noise.
const MIN_ALPHA = 60;

const worldSize = TILE * 2 ** RADAR_ZOOM;

function project(lat: number, lon: number) {
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldSize,
  };
}

async function tile(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`radar tile responded ${res.status}`);
  return PNG.sync.read(Buffer.from(await res.arrayBuffer()));
}

/** Scan the latest radar frame for precipitation within `radiusKm` of the location. */
async function scan(host: string, framePath: string, lat: number, lon: number, radiusKm: number) {
  const center = project(lat, lon);
  const kmPerPx = (40075.016 * Math.cos((lat * Math.PI) / 180)) / worldSize;
  const r = radiusKm / kmPerPx;
  const tiles = 2 ** RADAR_ZOOM;
  let inside = 0;
  let wet = 0;
  let nearest = Infinity;

  const jobs = [];
  for (let ty = Math.floor((center.y - r) / TILE); ty <= Math.floor((center.y + r) / TILE); ty++) {
    if (ty < 0 || ty >= tiles) continue;
    for (let tx = Math.floor((center.x - r) / TILE); tx <= Math.floor((center.x + r) / TILE); tx++) {
      const wrapped = ((tx % tiles) + tiles) % tiles;
      jobs.push(
        tile(`${host}${framePath}/${TILE}/${RADAR_ZOOM}/${wrapped}/${ty}/2/1_1.png`).then((png) => {
          for (let py = 0; py < png.height; py++) {
            for (let px = 0; px < png.width; px++) {
              const d = Math.hypot(tx * TILE + px + 0.5 - center.x, ty * TILE + py + 0.5 - center.y);
              if (d > r) continue;
              inside++;
              if (png.data[(py * png.width + px) * 4 + 3] >= MIN_ALPHA) {
                wet++;
                nearest = Math.min(nearest, d * kmPerPx);
              }
            }
          }
        }),
      );
    }
  }
  await Promise.all(jobs);
  const coverage = inside ? wet / inside : 0;
  return { active: wet >= MIN_PIXELS && coverage >= MIN_COVERAGE, coverage, nearestKm: Number.isFinite(nearest) ? nearest : null };
}

export function startRadar() {
  const poller = startPoller('radar', async () => {
    const { location, radar } = getSettings();
    if (location.latitude === null || location.longitude === null) {
      publish('radar', { configured: false, active: false });
      return 60 * 60_000;
    }
    const maps = await fetchJson<WeatherMaps>('https://api.rainviewer.com/public/weather-maps.json');
    const frames = maps.radar.past;
    const latest = frames.at(-1);
    if (!latest) throw new Error('RainViewer returned no radar frames');
    const result = await scan(maps.host, latest.path, location.latitude, location.longitude, radar.radiusKm);
    publish('radar', {
      configured: true,
      ...result,
      coverage: Math.round(result.coverage * 1000) / 1000,
      nearestKm: result.nearestKm === null ? null : Math.round(result.nearestKm),
      radiusKm: radar.radiusKm,
      host: maps.host,
      frames: frames.map(({ time, path }) => ({ time: time * 1000, path })),
    });
    // RainViewer publishes a new frame every 10 minutes.
    return 5 * 60_000;
  });
  onSettingsChange((s) => [s.location.latitude, s.location.longitude, s.radar], poller.refresh);
  return poller;
}
