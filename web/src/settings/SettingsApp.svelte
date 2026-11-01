<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import LogOut from '@lucide/svelte/icons/log-out';
  import Plus from '@lucide/svelte/icons/plus';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import X from '@lucide/svelte/icons/x';
  import { onMount } from 'svelte';
  import type { WidgetId, YouTubeChannel } from '../lib/types';
  import { CLOCK_STYLES } from '../lib/clockStyles';
  import { WIDGETS } from '../lib/widgets';
  import { admin, api, AuthError, discard, load, save, toast } from './admin.svelte';
  import ColorPicker from './ColorPicker.svelte';
  import Section from './Section.svelte';
  import Segmented from './Segmented.svelte';
  import Toggle from './Toggle.svelte';

  const s = $derived(admin.settings);
  const status = $derived(admin.status);
  const dirty = $derived(!!s && (JSON.stringify(s) !== admin.saved || JSON.stringify(admin.calendars) !== admin.savedCalendars));

  let pin = $state('');
  let pinError = $state('');
  let wallpaperUrl = $state('');
  let mode = $state<'day' | 'night'>('day');

  onMount(async () => {
    const params = new URLSearchParams(location.search);
    const spotify = params.get('spotify');
    if (spotify) history.replaceState(null, '', '/settings');
    await load().catch((err) => toast(err.message));
    if (spotify === 'connected') toast('Spotify connected');
    if (spotify === 'error') toast('Spotify sign-in failed. Check the redirect URI in your Spotify app.');
    fetch('/api/state')
      .then((r) => r.json())
      .then((st) => {
        wallpaperUrl = st.wallpaper?.url ?? '';
        mode = st.mode ?? 'day';
      })
      .catch(() => {});
  });

  // ---- Night mode: switched instantly through the same open endpoint Home Assistant uses.
  async function setMode(next: 'day' | 'night') {
    const res = await api<{ mode: 'day' | 'night' }>('/api/mode', { method: 'POST', body: { mode: next } });
    mode = res.mode;
  }
  const haExample = $derived(`rest_command:
  dashboard_night:
    url: ${location.origin}/api/mode/night
    method: post
  dashboard_day:
    url: ${location.origin}/api/mode/day
    method: post`);

  // ---- Radar distance, shown in the user's units but stored in km.
  const KM_PER_MI = 1.609;
  const imperial = $derived(s?.units !== 'metric');
  const radarRadius = $derived(s ? Math.round(imperial ? s.radar.radiusKm / KM_PER_MI : s.radar.radiusKm) : 0);
  function setRadarRadius(value: number) {
    if (s) s.radar.radiusKm = Math.round(imperial ? value * KM_PER_MI : value);
  }
  const flightRadius = $derived(s ? Math.round(imperial ? s.flights.radiusKm / KM_PER_MI : s.flights.radiusKm) : 0);
  function setFlightRadius(value: number) {
    if (s) s.flights.radiusKm = Math.round(imperial ? value * KM_PER_MI : value);
  }

  // ---- YouTube: look a channel up by handle, link or id before adding it.
  let channelQuery = $state('');
  let addingChannel = $state(false);
  async function addChannel(e: SubmitEvent) {
    e.preventDefault();
    if (!s || !channelQuery.trim()) return;
    addingChannel = true;
    try {
      const channel = await api<YouTubeChannel>(`/api/admin/youtube/resolve?q=${encodeURIComponent(channelQuery.trim())}`);
      if (s.youtube.channels.some((c) => c.id === channel.id)) toast(`${channel.name} is already on the list`);
      else s.youtube.channels.push(channel);
      channelQuery = '';
    } catch {
      toast("Couldn't find that channel");
    } finally {
      addingChannel = false;
    }
  }

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

  // ---- Layout: two columns of slots; a slot with several cards rotates between them.
  type Column = 'left' | 'right';
  const ALL = Object.keys(WIDGETS) as WidgetId[];
  const COLUMNS: { key: Column; label: string; hint: string }[] = [
    { key: 'left', label: 'Left column', hint: 'Stacked from the top' },
    { key: 'right', label: 'Right column', hint: 'Stacked from the top' },
  ];
  const unused = $derived(s ? ALL.filter((id) => !s.layout.left.flat().includes(id) && !s.layout.right.flat().includes(id)) : []);

  function addSlot(col: Column, id: WidgetId) {
    s?.layout[col].push([id]);
  }
  function addToSlot(col: Column, i: number, id: WidgetId) {
    s?.layout[col][i].push(id);
  }
  function removeCard(col: Column, i: number, id: WidgetId) {
    if (!s) return;
    const group = s.layout[col][i].filter((x) => x !== id);
    if (group.length) s.layout[col][i] = group;
    else s.layout[col].splice(i, 1);
  }
  function moveSlot(col: Column, i: number, dir: -1 | 1) {
    if (!s) return;
    const list = s.layout[col];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  }
  function switchColumn(col: Column, i: number) {
    if (!s) return;
    const [group] = s.layout[col].splice(i, 1);
    s.layout[col === 'left' ? 'right' : 'left'].push(group);
  }
  function pickCard(e: Event & { currentTarget: HTMLSelectElement }, apply: (id: WidgetId) => void) {
    const id = e.currentTarget.value as WidgetId;
    e.currentTarget.value = '';
    if (id) apply(id);
  }

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

  // ---- Calendars
  const CAL_COLORS = ['#0a84ff', '#ff9f0a', '#30d158', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a', '#ac8e68'];
  function addCalendar() {
    admin.calendars.push({
      id: crypto.randomUUID?.() ?? String(Date.now()),
      name: '',
      color: CAL_COLORS[admin.calendars.length % CAL_COLORS.length],
      url: '',
    });
  }
  function calendarState(id: string) {
    const st = status?.calendarStatus[id];
    if (!st) return null;
    return st.ok ? { ok: true, text: `${st.events} upcoming event${st.events === 1 ? '' : 's'}` } : { ok: false, text: `Couldn't load: ${st.error}` };
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

    <Section title="Layout" hint="Put several cards in one slot to have that slot rotate between them. Cards with nothing to show are skipped.">
      {#each COLUMNS as col (col.key)}
        <div class="col-block">
          <div class="col-head"><b>{col.label}</b><span>{col.hint}</span></div>
          {#each s.layout[col.key] as group, i (group.join())}
            <div class="slotbox">
              <div class="slot-head">
                <span class="slot-title">Slot {i + 1}{#if group.length > 1}<span class="badge">Rotates</span>{/if}</span>
                <span class="controls">
                  <button class="icon-btn" onclick={() => moveSlot(col.key, i, -1)} disabled={i === 0} title="Move slot up"><ChevronUp size="1rem" /></button>
                  <button class="icon-btn" onclick={() => moveSlot(col.key, i, 1)} disabled={i === s.layout[col.key].length - 1} title="Move slot down"><ChevronDown size="1rem" /></button>
                  <button class="btn ghost small-btn" onclick={() => switchColumn(col.key, i)}>Move {col.key === 'left' ? 'right' : 'left'}</button>
                </span>
              </div>
              <div class="chips">
                {#each group as id (id)}
                  <span class="chip"><span class="swatch" style:background={WIDGETS[id].accent}></span>{WIDGETS[id].title}<button onclick={() => removeCard(col.key, i, id)} title="Remove from slot"><X size="0.8rem" /></button></span>
                {/each}
                {#if unused.length}
                  <select class="chip-select" onchange={(e) => pickCard(e, (id) => addToSlot(col.key, i, id))}>
                    <option value="">+ Add to rotation</option>
                    {#each unused as id (id)}<option value={id}>{WIDGETS[id].title}</option>{/each}
                  </select>
                {/if}
              </div>
            </div>
          {:else}
            <p class="muted empty-col">Nothing here yet.</p>
          {/each}
          {#if unused.length}
            <select class="new-slot" onchange={(e) => pickCard(e, (id) => addSlot(col.key, id))}>
              <option value="">+ New slot with…</option>
              {#each unused as id (id)}<option value={id}>{WIDGETS[id].title}</option>{/each}
            </select>
          {/if}
        </div>
      {/each}
      <div class="row"><span>Hidden</span><span class="value">{unused.length ? unused.map((id) => WIDGETS[id].title).join(', ') : 'None'}</span></div>
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

    <Section title="Calendar" hint={'Use any iCal (.ics) link. For Google Calendar: Settings → your calendar → Integrate calendar → "Secret address in iCal format". Links are stored on the server and never sent to the screens.'}>
      {#each admin.calendars as c, i (c.id)}
        {@const st = calendarState(c.id)}
        <div class="calendar">
          <div class="cal-top">
            <ColorPicker bind:value={c.color} />
            <input class="grow text" bind:value={c.name} placeholder="Name, e.g. Family" />
            <button class="icon-btn" onclick={() => admin.calendars.splice(i, 1)} title="Remove calendar"><X size="1rem" /></button>
          </div>
          <input class="text url" bind:value={c.url} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" spellcheck="false" />
          {#if st}<div class="cal-status" class:bad={!st.ok}>{st.text}</div>{/if}
        </div>
      {/each}
      <div class="row"><button class="btn ghost" onclick={addCalendar}><Plus size="1rem" /> Add calendar</button></div>
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

    <Section title="Radar" hint="The radar card stays hidden until rain or snow shows up within this distance of your location. Add it to a slot in Layout.">
      <div class="row">
        <span>Show when precipitation is within</span>
        <span class="controls">
          <input type="range" min={imperial ? 10 : 15} max={imperial ? 250 : 400} step="5" value={radarRadius} oninput={(e) => setRadarRadius(Number(e.currentTarget.value))} />
          <span class="num pct">{radarRadius} {imperial ? 'mi' : 'km'}</span>
        </span>
      </div>
    </Section>

    <Section title="Flights overhead" hint="Aircraft come from ADSB.lol's community receivers and routes from adsbdb. The card hides when nothing is in the air nearby.">
      <div class="row">
        <span>Show aircraft within</span>
        <span class="controls">
          <input type="range" min={imperial ? 2 : 3} max={imperial ? 100 : 160} step="1" value={flightRadius} oninput={(e) => setFlightRadius(Number(e.currentTarget.value))} />
          <span class="num pct">{flightRadius} {imperial ? 'mi' : 'km'}</span>
        </span>
      </div>
    </Section>

    <Section title="Live on YouTube" hint="Checked every few minutes. Only channels that are streaming right now are shown, and the card hides when none are.">
      {#each s.youtube.channels as c, i (c.id)}
        <div class="row channel">
          {#if c.avatar}<img class="avatar" src={c.avatar} alt="" />{/if}
          <span class="grow">{c.name}{#if c.handle}<span class="muted handle">{c.handle}</span>{/if}</span>
          <button class="icon-btn" onclick={() => s.youtube.channels.splice(i, 1)} title="Remove"><X size="1rem" /></button>
        </div>
      {/each}
      <form class="row" onsubmit={addChannel}>
        <input class="grow text" bind:value={channelQuery} placeholder="@handle, channel link or channel ID" />
        <button class="btn" type="submit" disabled={addingChannel || !channelQuery.trim()}>{addingChannel ? 'Finding…' : 'Add'}</button>
      </form>
    </Section>

    <Section title="Display" hint="Text size applies to every screen; add ?scale=0.7 to one screen's address to size it on its own. Cards that no longer fit in a column are left off until there's room. Low-power mode drops the glass blur and photo zoom for slow TV sticks. Burn-in protection shifts the layout a few pixels every few minutes.">
      <div class="row">
        <span>Clock style</span>
        <select bind:value={s.display.clockStyle}>
          {#each CLOCK_STYLES as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
        </select>
      </div>
      <div class="row preview cs-{s.display.clockStyle}">
        <span class="preview-time">9:41</span>
        <span class="preview-date">Sunday, November 1</span>
      </div>
      <div class="row">
        <span>Text &amp; card size</span>
        <span class="controls">
          <input type="range" min="0.5" max="1.4" step="0.05" bind:value={s.display.scale} />
          <span class="num pct">{Math.round(s.display.scale * 100)}%</span>
        </span>
      </div>
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

    <Section title="Night mode" hint="A black screen with a dim clock for when the room is dark. Switch it from Home Assistant (or anything on your network) with a POST to /api/mode/night and /api/mode/day; no PIN needed. The switch below takes effect right away, without saving.">
      <div class="row">
        <span>Screens are showing</span>
        <Segmented value={mode} onchange={setMode} options={[{ value: 'day', label: 'Day' }, { value: 'night', label: 'Night' }]} />
      </div>
      <div class="row">
        <span>Brightness</span>
        <span class="controls">
          <input type="range" min="0.1" max="1" step="0.05" bind:value={s.night.brightness} />
          <span class="num pct">{Math.round(s.night.brightness * 100)}%</span>
        </span>
      </div>
      <Toggle label="Show weather" bind:checked={s.night.showWeather} />
      <Toggle label="Show next event" bind:checked={s.night.showNextEvent} />
      <div class="row code-row">
        <span>Home Assistant <code>configuration.yaml</code></span>
        <pre class="code">{haExample}</pre>
      </div>
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
  .row.preview {
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 1.4rem 1rem;
    font-family: var(--hero-font);
  }
  .preview-time {
    font-family: var(--clock-font);
    font-size: calc(var(--clock-size) * 0.45rem);
    font-weight: var(--clock-weight);
    letter-spacing: var(--clock-spacing);
    line-height: 0.95;
    color: var(--clock-fill);
    -webkit-text-stroke: var(--clock-stroke) var(--text);
  }
  .preview-date {
    font-size: calc(var(--date-size) * 0.55rem);
    font-weight: var(--date-weight);
    font-style: var(--date-style);
    text-transform: var(--date-case);
    letter-spacing: var(--date-spacing);
  }
  .row.channel {
    justify-content: flex-start;
    gap: 0.7rem;
  }
  .handle {
    margin-left: 0.5rem;
  }
  .avatar {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
  }
  .row.code-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.6rem;
  }
  .code {
    margin: 0;
    padding: 0.8rem 1rem;
    border-radius: 0.6rem;
    background: rgba(0, 0, 0, 0.35);
    font: 0.85rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--text-2);
    overflow-x: auto;
    user-select: all;
  }
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
  .col-block {
    padding: 0.8rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .col-head {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }
  .col-head span {
    font-size: 0.8rem;
    color: var(--text-3);
  }
  .slotbox {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 0.75rem;
    padding: 0.6rem 0.7rem;
  }
  .slot-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .slot-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-2);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .badge {
    font-size: 0.7rem;
    padding: 0.1rem 0.45rem;
    border-radius: 1rem;
    background: rgba(10, 132, 255, 0.25);
    color: #9ccaff;
  }
  .small-btn {
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
  }
  .icon-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .chip .swatch {
    margin-right: 0.15rem;
  }
  .chip-select,
  .new-slot {
    background: none;
    border: 1px dashed rgba(255, 255, 255, 0.25);
    border-radius: 1rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.85rem;
    color: var(--text-2);
    cursor: pointer;
  }
  .new-slot {
    align-self: flex-start;
  }
  .row.chips {
    justify-content: flex-start;
  }
  .empty-col {
    margin: 0;
    font-size: 0.85rem;
  }
  .calendar {
    padding: 0.7rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .cal-top {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .url {
    width: 100%;
    font-size: 0.85rem;
    color: var(--text-2);
  }
  .cal-status {
    font-size: 0.8rem;
    color: var(--green);
  }
  .cal-status.bad {
    color: var(--red);
  }
  .pct {
    width: 3rem;
    text-align: right;
    color: var(--text-2);
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
