import type { Settings } from '../lib/types';

export interface Status {
  pinRequired: boolean;
  calendars: { name: string; color: string }[];
  todoist: boolean;
  unsplash: boolean;
  spotify: { configured: boolean; connected: boolean; redirectUri: string };
  leagues: { key: string; label: string }[];
  defaultFeeds: { name: string; url: string }[];
}

export const admin = $state({
  loading: true,
  authed: false,
  pinRequired: false,
  settings: null as Settings | null,
  status: null as Status | null,
  saved: '',
  saving: false,
  toast: '',
});

export class AuthError extends Error {}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401) {
    admin.authed = false;
    throw new AuthError((await res.json().catch(() => ({}))).error ?? 'Not signed in');
  }
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export function toast(message: string) {
  admin.toast = message;
  setTimeout(() => {
    if (admin.toast === message) admin.toast = '';
  }, 3500);
}

export async function load() {
  const session = await api<{ authed: boolean; pinRequired: boolean }>('/api/session');
  admin.pinRequired = session.pinRequired;
  admin.authed = session.authed;
  if (session.authed) {
    const data = await api<{ settings: Settings; status: Status }>('/api/admin');
    admin.settings = data.settings;
    admin.status = data.status;
    admin.saved = JSON.stringify(data.settings);
  }
  admin.loading = false;
}

export async function save() {
  if (!admin.settings) return;
  admin.saving = true;
  try {
    const { settings } = await api<{ settings: Settings }>('/api/admin/settings', { method: 'PUT', body: admin.settings });
    admin.settings = settings;
    admin.saved = JSON.stringify(settings);
    toast('Saved — screens update in a moment');
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Save failed');
  } finally {
    admin.saving = false;
  }
}

export function discard() {
  admin.settings = JSON.parse(admin.saved);
}
