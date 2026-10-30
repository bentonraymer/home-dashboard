<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import LogOut from '@lucide/svelte/icons/log-out';
  import Plus from '@lucide/svelte/icons/plus';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import X from '@lucide/svelte/icons/x';
  import { onMount } from 'svelte';
  import type { WidgetId } from '../lib/types';
  import { WIDGETS } from '../lib/widgets';
  import { admin, api, AuthError, discard, load, save, toast } from './admin.svelte';
  import Section from './Section.svelte';
  import Segmented from './Segmented.svelte';
  import Toggle from './Toggle.svelte';

  const s = $derived(admin.settings);
  const status = $derived(admin.status);
  const dirty = $derived(!!s && JSON.stringify(s) !== admin.saved);

  let pin = $state('');
  let pinError = $state('');
  let wallpaperUrl = $state('');

  onMount(async () => {
    const params = new URLSearchParams(location.search);
    const spotify = params.get('spotify');
    if (spotify) history.replaceState(null, '', '/settings');
    await load().catch((err) => toast(err.message));
    if (spotify === 'connected') toast('Spotify connected');
    if (spotify === 'error') toast('Spotify sign-in failed. Check the redirect URI in your Spotify app.');
    fetch('/api/state')
      .then((r) => r.json())
      .then((st) => (wallpaperUrl = st.wallpaper?.url ?? ''))
      .catch(() => {});
  });

  async function signIn(e: SubmitEvent) {
    e.preventDefault();
    pinError = '';
    try {
      await api('/api/login', { method: 'POST', body: { pin } });
      pin = '';
      await load();
    } catch (err) {
      pinError = err instanceof AuthError ? 'Incorrect PIN' : 'Could not sign in';
    }
  }

  async function signOut() {
    await api('/api/logout', { method: 'POST' });
    location.reload();
  }

  // ---- Location
  let query = $state('');
  let results: { name: string; latitude: number; longitude: number }[] = $state([]);
  async function search(e: SubmitEvent) {
    e.preventDefault();
    results = await api(`/api/admin/geocode?q=${encodeURIComponent(query)}`);
    if (!results.length) toast('No places found');
  }
  function pick(r: { name: string; latitude: number; longitude: number }) {
    if (!s) return;
    s.location = { name: r.name.split(',')[0], latitude: r.latitude, longitude: r.longitude };
    results = [];
    query = '';
  }

  // ---- Layout
  type Zone = 'column' | 'rotator' | 'hidden';
  const zoneOf = (id: WidgetId): Zone => (s!.layout.column.includes(id) ? 'column' : s!.layout.rotator.includes(id) ? 'rotator' : 'hidden');
  const ordered = $derived(
    s ? [...s.layout.column, ...s.layout.rotator, ...(Object.keys(WIDGETS) as WidgetId[]).filter((id) => zoneOf(id) === 'hidden')] : [],
  );
  function setZone(id: WidgetId, zone: Zone) {
    if (!s) return;
    s.layout.column = s.layout.column.filter((x) => x !== id);
    s.layout.rotator = s.layout.rotator.filter((x) => x !== id);
    if (zone !== 'hidden') s.layout[zone].push(id);
  }
  function move(id: WidgetId, dir: -1 | 1) {
    const zone = zoneOf(id);
    if (!s || zone === 'hidden') return;
    const list = s.layout[zone];
    const i = list.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  }
  const zoneOptions: { value: Zone; label: string }[] = [
    { value: 'column', label: 'Column' },
    { value: 'rotator', label: 'Rotating' },
    { value: 'hidden', label: 'Off' },
  ];

  // ---- Wallpaper topics
  let topic = $state('');
  function addTopic(e: SubmitEvent) {
    e.preventDefault();
    if (s && topic.trim() && !s.wallpaper.topics.includes(topic.trim())) s.wallpaper.topics.push(topic.trim());
    topic = '';
  }

  // ---- Sports
  let league = $state('nfl');
  let teams: { league: string; id: string; name: string; abbr: string; logo: string }[] = $state([]);
  let teamId = $state('');
  $effect(() => {
    if (!admin.authed) return;
    const key = league;
    teams = [];
    teamId = '';
    api<typeof teams>(`/api/admin/teams?league=${key}`).then((t) => {
      if (league === key) teams = t;
    });
  });
  function addTeam() {
    const t = teams.find((x) => x.id === teamId);
    if (!s || !t || s.sports.teams.some((x) => x.league === t.league && x.id === t.id)) return;
    s.sports.teams.push(t);
  }

  // ---- Countdowns
  function addCountdown() {
    s?.countdowns.push({ id: crypto.randomUUID?.() ?? String(Date.now()), name: '', date: new Date().toISOString().slice(0, 10), yearly: false, emoji: '' });
  }

  // ---- Actions
  async function nextWallpaper() {
    await api('/api/admin/wallpaper/next', { method: 'POST' });
    toast('Fetching a new photo…');
  }
  async function refreshAll() {
    await api('/api/admin/refresh', { method: 'POST' });
    toast('Refreshing all data');
  }
  let spotifyUrl = $state('');
  async function finishSpotify(e: SubmitEvent) {
    e.preventDefault();
    try {
      await api('/api/admin/spotify/finish', { method: 'POST', body: { url: spotifyUrl } });
      spotifyUrl = '';
      toast('Spotify connected');
      await load();
    } catch {
      toast('That URL did not work. Start again with Connect Spotify.');
    }
  }
  async function disconnectSpotify() {
    await api('/api/admin/spotify/disconnect', { method: 'POST' });
    await load();
  }
</script>

<div class="bg" style:background-image={wallpaperUrl ? `url(${wallpaperUrl})` : undefined}></div>

<div class="page">
  <header>
    <h1>Dashboard Settings</h1>
    {#if admin.authed}
      <a class="btn ghost" href="/" target="_blank">Open dashboard</a>
      {#if admin.pinRequired}<button class="icon-btn" onclick={signOut} title="Sign out"><LogOut size="1.1rem" /></button>{/if}
    {/if}
  </header>

  {#if admin.loading}
    <p class="muted">Loading…</p>
  {:else if !admin.authed}
    <form class="login" onsubmit={signIn}>
      <p>Enter the settings PIN from your <code>.env</code>.</p>
      <input type="password" inputmode="numeric" autocomplete="current-password" bind:value={pin} placeholder="PIN" />
      <button class="btn" type="submit">Unlock</button>
      {#if pinError}<p class="error">{pinError}</p>{/if}
    </form>
  {:else if s && status}
    {#if !status.pinRequired}
      <p class="warn">No SETTINGS_PIN is set, so anyone on your network can change these settings.</p>
    {/if}

    <Section title="Location & Time">
      <div class="row">
        <span>Location</span>
        <span class="value">{s.location.name || 'Not set'}</span>
      </div>
      <form class="row" onsubmit={search}>
        <input class="grow" type="search" bind:value={query} placeholder="Search for a city" />
        <button class="btn" type="submit" disabled={!query.trim()}>Search</button>
      </form>
      {#each results as r (r.name + r.latitude)}
        <button class="row result" onclick={() => pick(r)}>{r.name}</button>
      {/each}
      <div class="row"><span>Units</span><Segmented bind:value={s.units} options={[{ value: 'imperial', label: '°F' }, { value: 'metric', label: '°C' }]} /></div>
      <Toggle label="24-hour clock" bind:checked={s.clock.use24h} />
      <Toggle label="Show seconds" bind:checked={s.clock.showSeconds} />
    </Section>

    <Section title="Layout" hint="Column cards stay on screen on the right. Rotating cards take turns in the lower-left slot; ones with nothing to show are skipped.">
      {#each ordered as id (id)}
        {@const zone = zoneOf(id)}
        <div class="row">
          <span class="widget"><span class="swatch" style:background={WIDGETS[id].accent}></span>{WIDGETS[id].title}</span>
          <span class="controls">
            {#if zone !== 'hidden'}
              <button class="icon-btn" onclick={() => move(id, -1)} title="Move up"><ChevronUp size="1rem" /></button>
              <button class="icon-btn" onclick={() => move(id, 1)} title="Move down"><ChevronDown size="1rem" /></button>
            {/if}
            <Segmented options={zoneOptions} bind:value={() => zone, (z) => setZone(id, z)} />
          </span>
        </div>
      {/each}
      <div class="row">
        <span>Rotate every</span>
        <span><input class="num-input" type="number" min="5" max="600" bind:value={s.layout.rotatorIntervalSec} /> sec</span>
      </div>
      <Toggle label="Now Playing card" bind:checked={s.layout.showNowPlaying} />
      <Toggle label="News headlines" bind:checked={s.layout.showNews} />
    </Section>

    <Section title="Wallpaper" hint={status.unsplash ? 'Photos come from Unsplash, matching one of these topics at random.' : 'UNSPLASH_ACCESS_KEY is not set, so the built-in photos are used.'}>
      <div class="row">
        <span>Change photo every</span>
        <span><input class="num-input" type="number" min="1" max="240" bind:value={s.wallpaper.intervalMin} /> min</span>
      </div>
      <div class="row chips">
        {#each s.wallpaper.topics as t, i (t)}
          <span class="chip">{t}<button onclick={() => s.wallpaper.topics.splice(i, 1)} title="Remove"><X size="0.8rem" /></button></span>
        {/each}
        <form onsubmit={addTopic}><input class="chip-input" bind:value={topic} placeholder="Add topic" /></form>
      </div>
      <div class="row"><span>Skip to the next photo</span><button class="btn ghost" onclick={nextWallpaper}>Next photo</button></div>
    </Section>

    <Section title="Calendar" hint="Calendars come from CALENDAR_URLS in your .env file.">
      {#each status.calendars as c (c.name)}
        <div class="row"><span class="widget"><span class="swatch" style:background={c.color}></span>{c.name}</span></div>
      {:else}
        <div class="row muted">No calendars configured</div>
      {/each}
      <div class="row"><span>Days ahead</span><input class="num-input" type="number" min="1" max="60" bind:value={s.calendar.daysAhead} /></div>
      <div class="row"><span>Max events</span><input class="num-input" type="number" min="1" max="50" bind:value={s.calendar.maxEvents} /></div>
    </Section>

    <Section title="To Do" hint={'Any Todoist filter works, e.g. "today | overdue", "#Home & (today | overdue)" or "p1 | p2".'}>
      {#if !status.todoist}<div class="row muted">TODOIST_TOKEN is not set</div>{/if}
      <div class="row"><span>Filter</span><input class="grow text" bind:value={s.todos.filter} /></div>
      <div class="row"><span>Max tasks</span><input class="num-input" type="number" min="1" max="50" bind:value={s.todos.maxTasks} /></div>
    </Section>

    <Section title="News">
      {#each s.news.feeds as f, i (i)}
        <div class="row feed">
          <input class="text name" bind:value={f.name} placeholder="Name" />
          <input class="grow text" bind:value={f.url} placeholder="https://…/rss" />
          <button class="icon-btn" onclick={() => s.news.feeds.splice(i, 1)} title="Remove"><X size="1rem" /></button>
        </div>
      {/each}
      <div class="row">
        <button class="btn ghost" onclick={() => s.news.feeds.push({ name: '', url: '' })}><Plus size="1rem" /> Add feed</button>
        <button class="btn ghost" onclick={() => (s.news.feeds = structuredClone(status.defaultFeeds))}>Restore defaults</button>
      </div>
      <div class="row"><span>Next headline every</span><span><input class="num-input" type="number" min="4" max="120" bind:value={s.news.intervalSec} /> sec</span></div>
    </Section>

    <Section title="Sports">
      {#each s.sports.teams as t, i (t.league + t.id)}
        <div class="row">
          <span class="widget">{#if t.logo}<img src={t.logo} alt="" />{/if}{t.name}</span>
          <button class="icon-btn" onclick={() => s.sports.teams.splice(i, 1)} title="Remove"><X size="1rem" /></button>
        </div>
      {/each}
      <div class="row">
        <select bind:value={league}>
          {#each status.leagues as l (l.key)}<option value={l.key}>{l.label}</option>{/each}
        </select>
        <select class="grow" bind:value={teamId} disabled={!teams.length}>
          <option value="">{teams.length ? 'Choose a team' : 'Loading…'}</option>
          {#each teams as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
        </select>
        <button class="btn" onclick={addTeam} disabled={!teamId}>Add</button>
      </div>
    </Section>

    <Section title="Countdowns" hint="Yearly countdowns (birthdays, holidays) roll over to next year automatically.">
      {#each s.countdowns as c, i (c.id)}
        <div class="row countdown">
          <input class="text emoji" bind:value={c.emoji} placeholder="🎉" maxlength="4" />
          <input class="grow text" bind:value={c.name} placeholder="Name" />
          <input class="text" type="date" bind:value={c.date} />
          <label class="small"><input type="checkbox" bind:checked={c.yearly} /> Yearly</label>
          <button class="icon-btn" onclick={() => s.countdowns.splice(i, 1)} title="Remove"><X size="1rem" /></button>
        </div>
      {/each}
      <div class="row"><button class="btn ghost" onclick={addCountdown}><Plus size="1rem" /> Add countdown</button></div>
    </Section>

    <Section title="Display" hint="Low-power mode drops the glass blur and photo zoom for slow TV sticks. Burn-in protection shifts the layout a few pixels every few minutes.">
      <Toggle label="Low-power mode" bind:checked={s.display.lowPower} />
      <Toggle label="Slow photo zoom" bind:checked={s.display.kenBurns} />
      <Toggle label="Burn-in protection" bind:checked={s.display.burnInShift} />
      <Toggle label="Dim at night" bind:checked={s.display.nightDim.enabled} />
      {#if s.display.nightDim.enabled}
        <div class="row">
          <span>From</span>
          <span><input class="text" type="time" bind:value={s.display.nightDim.start} /> to <input class="text" type="time" bind:value={s.display.nightDim.end} /></span>
        </div>
        <div class="row">
          <span>Dim amount</span>
          <input type="range" min="0.1" max="0.9" step="0.05" bind:value={s.display.nightDim.level} />
        </div>
      {/if}
    </Section>

    <Section
      title="Connections"
      hint={status.spotify.configured && !status.spotify.connected
        ? `Add ${status.spotify.redirectUri} as a Redirect URI in your Spotify app. If you approve from another computer, that page won't load: copy its address into the box above.`
        : 'API keys live in your .env file and never leave the server.'}
    >
      <div class="row"><span>Todoist</span><span class:ok={status.todoist} class="state">{status.todoist ? 'Connected' : 'Not set'}</span></div>
      <div class="row"><span>Unsplash</span><span class:ok={status.unsplash} class="state">{status.unsplash ? 'Connected' : 'Built-in photos'}</span></div>
      <div class="row">
        <span>Spotify</span>
        {#if !status.spotify.configured}
          <span class="state">Not set</span>
        {:else if status.spotify.connected}
          <span class="controls"><span class="state ok">Connected</span><button class="btn ghost" onclick={disconnectSpotify}>Disconnect</button></span>
        {:else}
          <a class="btn" href="/auth/spotify/login">Connect Spotify</a>
        {/if}
      </div>
      {#if status.spotify.configured && !status.spotify.connected}
        <form class="row" onsubmit={finishSpotify}>
          <input class="grow text" bind:value={spotifyUrl} placeholder="Page didn't load after approving? Paste its address here" />
          <button class="btn ghost" type="submit" disabled={!spotifyUrl.trim()}>Finish</button>
        </form>
      {/if}
      <div class="row"><span>Refresh every source now</span><button class="btn ghost" onclick={refreshAll}><RefreshCw size="1rem" /> Refresh</button></div>
    </Section>
  {/if}
</div>

{#if dirty}
  <div class="savebar">
    <span>Unsaved changes</span>
    <button class="btn ghost" onclick={discard}>Discard</button>
    <button class="btn" onclick={save} disabled={admin.saving}>{admin.saving ? 'Saving…' : 'Save'}</button>
  </div>
{/if}
{#if admin.toast}<div class="toast">{admin.toast}</div>{/if}

<style>
  :global(body) {
    font-size: 16px;
    background: #000;
  }
  .bg {
    position: fixed;
    inset: -40px;
    background: radial-gradient(120% 120% at 20% 10%, #2c3e50 0%, #0b0b10 70%) center / cover;
    filter: blur(30px) brightness(0.45);
  }
  .page {
    position: relative;
    max-width: 44rem;
    margin: 0 auto;
    padding: 2rem 1rem 8rem;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1.6rem;
  }
  h1 {
    font-size: 1.9rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 auto 0 0;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.6rem 0;
    min-height: 2.9rem;
    flex-wrap: wrap;
  }
  .value,
  .muted {
    color: var(--text-2);
  }
  .grow {
    flex: 1;
    min-width: 8rem;
  }
  input.text,
  input[type='search'],
  .num-input,
  select,
  .login input {
    background: rgba(118, 118, 128, 0.24);
    border: 1px solid transparent;
    border-radius: 0.6rem;
    padding: 0.45rem 0.7rem;
    outline: none;
  }
  input:focus-visible,
  select:focus-visible {
    border-color: var(--blue);
  }
  .num-input {
    width: 4.6rem;
    text-align: right;
  }
  .emoji {
    width: 3rem;
    text-align: center;
  }
  .name {
    width: 9rem;
  }
  .result {
    width: 100%;
    background: none;
    border: 0;
    text-align: left;
    color: var(--blue);
    cursor: pointer;
  }
  .widget {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
  }
  .widget img {
    width: 1.6rem;
    height: 1.6rem;
    object-fit: contain;
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
  }
  .controls {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 0;
    border-radius: 0.6rem;
    padding: 0.45rem 0.95rem;
    background: var(--blue);
    color: #fff;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    text-decoration: none;
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .btn.ghost {
    background: rgba(118, 118, 128, 0.24);
  }
  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 0;
    border-radius: 50%;
    background: rgba(118, 118, 128, 0.24);
    cursor: pointer;
  }
  .chips {
    justify-content: flex-start;
    gap: 0.5rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.4rem 0.3rem 0.75rem;
    border-radius: 1rem;
    background: rgba(118, 118, 128, 0.3);
    font-size: 0.9rem;
  }
  .chip button {
    display: inline-grid;
    place-items: center;
    border: 0;
    background: none;
    cursor: pointer;
    color: var(--text-2);
  }
  .chip-input {
    background: none;
    border: 1px dashed rgba(255, 255, 255, 0.25);
    border-radius: 1rem;
    padding: 0.3rem 0.75rem;
    width: 8rem;
    font-size: 0.9rem;
    outline: none;
  }
  .small {
    font-size: 0.85rem;
    color: var(--text-2);
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }
  .state {
    color: var(--text-3);
  }
  .state.ok {
    color: var(--green);
  }
  .warn {
    background: rgba(255, 159, 10, 0.15);
    border: 1px solid rgba(255, 159, 10, 0.4);
    color: #ffd8a8;
    padding: 0.7rem 1rem;
    border-radius: 0.8rem;
    font-size: 0.9rem;
    margin: 0 0 1.6rem;
  }
  .login {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
  }
  .login p {
    width: 100%;
    color: var(--text-2);
    margin: 0 0 0.4rem;
  }
  .login input {
    width: 12rem;
    font-size: 1.1rem;
  }
  .error {
    color: var(--red) !important;
  }
  .savebar {
    position: fixed;
    z-index: 2;
    left: 50%;
    bottom: 1.2rem;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.6rem 0.6rem 1.1rem;
    border-radius: 1rem;
    background: rgba(40, 40, 46, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--hairline);
    box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.45);
    width: max-content;
    max-width: calc(100% - 2rem);
  }
  .savebar span {
    margin-right: 0.6rem;
    font-size: 0.9rem;
    color: var(--text-2);
  }
  .toast {
    position: fixed;
    z-index: 3;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.6rem 1.1rem;
    border-radius: 1rem;
    background: rgba(40, 40, 46, 0.92);
    border: 1px solid var(--hairline);
    font-size: 0.9rem;
    max-width: calc(100% - 2rem);
  }
  code {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.1rem 0.35rem;
    border-radius: 0.3rem;
  }
</style>
