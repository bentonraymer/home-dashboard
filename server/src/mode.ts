import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { publish } from './hub.js';

export type Mode = 'day' | 'night';
export const MODES: readonly Mode[] = ['day', 'night'];

const file = path.join(config.dataDir, 'mode.json');
let current: Mode = 'day';

/** Restore the last mode so a restart in the middle of the night stays dark. */
export function loadMode() {
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')).mode;
    if (MODES.includes(saved)) current = saved;
  } catch {
    // No saved mode yet.
  }
  publish('mode', current);
}

export function getMode() {
  return current;
}

export function setMode(mode: Mode) {
  current = mode;
  fs.writeFileSync(file, JSON.stringify({ mode }));
  publish('mode', current);
  return current;
}
