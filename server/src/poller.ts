import { errorMessage, log } from './log.js';

const RETRY_MS = 60_000;

export interface Poller {
  /** Run now (or as soon as the current run finishes) and reschedule. */
  refresh: () => void;
}

/**
 * Runs `task` forever. The task returns how many ms to wait before the next run,
 * which lets integrations speed up (live games, music playing) or slow down.
 */
export function startPoller(name: string, task: () => Promise<number>): Poller {
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let queued = false;
  let lastError = '';

  async function run(): Promise<void> {
    clearTimeout(timer);
    if (running) {
      queued = true;
      return;
    }
    running = true;
    let next = RETRY_MS;
    try {
      next = await task();
      if (lastError) log.info(`[${name}] recovered`);
      lastError = '';
    } catch (err) {
      const msg = errorMessage(err);
      if (msg !== lastError) log.warn(`[${name}] ${msg}`);
      lastError = msg;
    } finally {
      running = false;
    }
    if (queued) {
      queued = false;
      return run();
    }
    timer = setTimeout(run, next);
  }

  void run();
  return { refresh: () => void run() };
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return (await res.json()) as T;
}
