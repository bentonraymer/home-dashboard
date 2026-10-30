# Home Dashboard

An ambient, Apple TV–style dashboard for a TV, wall tablet or spare monitor. Full-screen photography in the background, a big clock and the weather up top, and frosted-glass cards for your calendar, to-dos and more. Built as a calmer replacement for MagicMirror.

- **Clock & weather**: current conditions, hourly and 6-day forecast, air quality, UV, sunrise/sunset and moon phase ([Open-Meteo](https://open-meteo.com), no key needed)
- **Calendar**: any number of Google Calendar / iCal (ICS) feeds, color-coded
- **To-dos**: Todoist, using any Todoist filter
- **Now Playing**: your Spotify track with album art; hidden when nothing is playing
- **Headlines**: a slow crossfading ticker from any RSS feeds
- **Sports**: live scores, last result and next game for your teams (NFL, NBA, MLB, NHL, MLS, Premier League, college and more)
- **Countdowns**: trips, birthdays, holidays (yearly ones roll over)
- **Wallpapers**: a new Unsplash photo every few minutes, with built-in photos as a fallback; text contrast adjusts to each photo
- **TV-friendly**: one lightweight page, live updates over a single connection, a low-power mode for slow TV sticks, night dimming and burn-in protection

Layout and preferences are set from a PIN-protected `/settings` page. API keys stay in `.env` on the server and never reach the browser.

## Run it

You need Docker with the Compose plugin.

1. Make a folder and download the two config files:

   ```bash
   mkdir home-dashboard && cd home-dashboard
   curl -O https://raw.githubusercontent.com/bentonraymer/home-dashboard/main/docker-compose.yml
   curl -o .env https://raw.githubusercontent.com/bentonraymer/home-dashboard/main/.env.example
   ```

2. Fill in `.env` (see below). Everything is optional except `SETTINGS_PIN`, which you should set.
3. Start it:

   ```bash
   docker compose up -d
   ```

4. Open `http://<server-ip>:8080/settings`, enter your PIN, search for your city, add your calendars and arrange the cards. Then point your TV or tablet at `http://<server-ip>:8080/`.

To update: `docker compose pull && docker compose up -d`. Open screens reload themselves when a new version starts.

## Configuration (`.env`)

| Variable | What it's for |
| --- | --- |
| `TZ` | Server time zone, e.g. `America/Denver` |
| `SETTINGS_PIN` | PIN for `/settings` |
| `TODOIST_TOKEN` | Todoist API token |
| `UNSPLASH_ACCESS_KEY` | Unsplash app Access Key for rotating wallpapers |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Spotify app credentials for Now Playing |
| `SPOTIFY_REDIRECT_URI` | Optional; defaults to `http://127.0.0.1:8080/auth/spotify/callback` |

### Calendars

Add calendars in `/settings` → **Calendar**: give each a name, pick a color (presets, a color wheel, or type a hex code like `#ff9f0a`) and paste its iCal link. Each calendar shows how many upcoming events it found, or why it couldn't load.

For Google Calendar, open Google Calendar on the web: **Settings → (pick a calendar) → Integrate calendar → Secret address in iCal format**. Any other `.ics` or `webcal://` feed works the same way (sports schedules, school calendars, holidays). Links are stored in the data volume and are never sent to the screens.

(Older setups that used `CALENDAR_URLS` in `.env` are imported automatically on first start.)

### Todoist

**Settings → Integrations → Developer → API token.** The default filter is `today | overdue`; change it in `/settings` to anything Todoist understands, like `#Home & (today | overdue)`.

### Unsplash

Create an app at [unsplash.com/oauth/applications](https://unsplash.com/oauth/applications) and copy its **Access Key**. The free demo tier allows 50 requests an hour; the dashboard fetches 30 photos per request, so even a 1-minute rotation stays well under it. Pick photo topics in `/settings`. Without a key, the 15 photos built into the image rotate instead.

### Spotify

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) (Web API).
2. Add `http://127.0.0.1:8080/auth/spotify/callback` as a **Redirect URI** (Spotify only allows `https://` addresses or `127.0.0.1`).
3. Put the Client ID and Secret in `.env` and restart.
4. In `/settings` → Connections, click **Connect Spotify** and approve.
5. Spotify then sends your browser to `127.0.0.1`, which won't load unless you're on the server itself. That's expected: copy the full address from the address bar, paste it into the box under **Connect Spotify** and click **Finish**.

If you run the dashboard behind an HTTPS reverse proxy, you can set `SPOTIFY_REDIRECT_URI=https://dash.example.com/auth/spotify/callback` instead and skip step 5.

## Display tips

- **Fire TV / Android TV**: use a kiosk browser (e.g. Fully Kiosk Browser) or Silk, and turn on **Low-power mode** in settings if animations stutter.
- **iPad / tablet**: open the page in Safari and use *Add to Home Screen* for a full-screen app. Portrait orientation gets its own stacked layout.
- **Raspberry Pi**: `chromium-browser --kiosk --noerrdialogs --disable-infobars http://<server-ip>:8080/`
- Too big or too small? Change **Text & card size** under **Display** in settings. To size one screen differently, add `?scale=0.7` (any value from 0.4 to 1.6) to that screen's address.
- Night dimming and burn-in protection are under **Display** in settings.

## Development

Requires Node 22+.

```bash
npm install
cp .env.example .env   # fill in what you want to test
npm run dev            # API on :8080, Vite on http://localhost:5173
npm run check          # type-check server and UI
npm run build && npm start
```

The server (`server/`, Fastify) polls every source on its own schedule, caches the results and pushes changes to screens over Server-Sent Events. The UI (`web/`, Svelte 5 + Vite) is two pages: the dashboard and `/settings`. Settings, calendar links, the Spotify refresh token and cached wallpapers are stored in `DATA_DIR` (`/data` in Docker).

Pushing to `main` builds a multi-arch (amd64 + arm64) image and publishes it to `ghcr.io/bentonraymer/home-dashboard` via GitHub Actions; tags like `v1.2.0` also publish versioned images.

## Credits

Weather from [Open-Meteo](https://open-meteo.com). Scores from ESPN's public site API. Photos from [Unsplash](https://unsplash.com); the built-in fallback photos are Unsplash images selected through [Lorem Picsum](https://picsum.photos), credited on screen. Icons from [Lucide](https://lucide.dev).
