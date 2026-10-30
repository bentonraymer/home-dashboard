import path from 'node:path';

const env = process.env;
const port = Number(env.PORT ?? 8080);

export const config = {
  port,
  host: env.HOST ?? '0.0.0.0',
  dataDir: path.resolve(env.DATA_DIR ?? './data'),
  webDir: path.resolve(env.WEB_DIR ?? './dist/web'),
  settingsPin: env.SETTINGS_PIN ?? '',
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
