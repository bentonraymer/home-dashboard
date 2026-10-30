import type { DashboardState } from './types';

export const dash: DashboardState = $state({
  connected: false,
  version: null,
  settings: null,
  weather: null,
  calendar: null,
  todos: null,
  nowPlaying: null,
  news: null,
  sports: null,
  wallpaper: null,
});

/** Ticks once a second; anything time-based derives from `clock.now`. */
export const clock = $state({ now: Date.now() });

function tick() {
  clock.now = Date.now();
  setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
}

function apply(key: string, value: unknown) {
  // Progress bars run off the local clock, so remember when this snapshot arrived.
  if (key === 'nowPlaying' && value) (value as { receivedAt: number }).receivedAt = Date.now();
  (dash as unknown as Record<string, unknown>)[key] = value;
}

export function connect() {
  tick();
  const source = new EventSource('/api/stream');
  source.addEventListener('init', (e) => {
    const data = JSON.parse((e as MessageEvent).data) as Record<string, unknown>;
    // A new server build means new client code too: reload to pick it up.
    if (dash.version && data.version !== dash.version) location.reload();
    for (const [key, value] of Object.entries(data)) apply(key, value);
    dash.connected = true;
  });
  source.addEventListener('update', (e) => {
    const { key, value } = JSON.parse((e as MessageEvent).data);
    apply(key, value);
  });
  source.onerror = () => {
    dash.connected = false;
  };
}
