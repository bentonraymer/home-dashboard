import type { ServerResponse } from 'node:http';
import { config } from './config.js';

const state: Record<string, unknown> = {};
const serialized: Record<string, string> = {};
const clients = new Set<ServerResponse>();

function send(res: ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Store a widget's latest data and push it to every connected screen if it changed. */
export function publish(key: string, value: unknown) {
  const json = JSON.stringify(value ?? null);
  if (serialized[key] === json) return;
  serialized[key] = json;
  state[key] = value ?? null;
  for (const res of clients) send(res, 'update', { key, value: state[key] });
}

export function snapshot() {
  return { version: config.version, ...state };
}

export function attachClient(res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  send(res, 'init', snapshot());
  clients.add(res);
  res.on('close', () => clients.delete(res));
}

setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25_000).unref();
