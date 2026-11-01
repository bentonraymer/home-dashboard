<script lang="ts">
  import { fade } from 'svelte/transition';
  import { clock, dash } from '../lib/store.svelte';
  import { clockParts, dayLabel, deg, formatTime, startOfDay } from '../lib/format';
  import { condition } from '../lib/weather';
  import WeatherIcon from './WeatherIcon.svelte';

  const s = $derived(dash.settings);
  const use24h = $derived(s?.clock.use24h ?? false);
  const time = $derived(clockParts(clock.now, use24h));
  const date = $derived(new Date(clock.now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
  const w = $derived(s?.night.showWeather !== false && dash.weather?.configured ? dash.weather.current : undefined);

  // The next timed event in the coming day; all-day events aren't worth waking up to.
  const next = $derived.by(() => {
    if (s?.night.showNextEvent === false) return null;
    const minute = Math.floor(clock.now / 60_000) * 60_000;
    const e = dash.calendar?.events.find((e) => !e.allDay && Date.parse(e.start) > minute);
    if (!e || Date.parse(e.start) - minute > 24 * 3600_000) return null;
    const start = Date.parse(e.start);
    const day = startOfDay(start).getTime() === startOfDay(minute).getTime() ? '' : `${dayLabel(new Date(start), minute)} `;
    return { title: e.title, when: `${day}${formatTime(start, use24h)}` };
  });

  // On a black screen the same pixels stay lit all night, so drift further than the day view does.
  const shift = $derived.by(() => {
    if (s?.display.burnInShift === false) return 'none';
    const step = Math.floor(clock.now / 180_000);
    const x = ((step * 7919) % 9) - 4;
    const y = ((step * 104729) % 7) - 3;
    return `translate(${x}vmin, ${y}vmin)`;
  });
</script>

<div class="night cs-{s?.display.clockStyle ?? 'classic'}" style:--level={s?.night.brightness ?? 0.45} transition:fade={{ duration: 1200 }}>
  <div class="content" style:transform={shift}>
    <div class="time num">
      {time.main}{#if !use24h}<span class="period">{time.period}</span>{/if}
    </div>
    <div class="date">{date}</div>
    {#if w || next}
      <div class="meta">
        {#if w}
          <span class="item"><WeatherIcon code={w.code} isDay={w.isDay} mono /> {deg(w.temp)} {condition(w.code, w.isDay).label}</span>
        {/if}
        {#if next}
          <span class="item"><span class="when">{next.when}</span> {next.title}</span>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .night {
    position: fixed;
    inset: 0;
    z-index: 10;
    background: #000;
    display: grid;
    place-items: center;
    /* One dim, warm-neutral grey for everything; brightness scales it. */
    color: rgb(190 184 176 / calc(var(--level) * 0.8));
    font-family: var(--hero-font);
    cursor: none;
  }
  .content {
    text-align: center;
    transition: transform 4s var(--ease);
  }
  .time {
    font-family: var(--clock-font);
    font-size: calc(var(--clock-size) * 1.35);
    font-weight: var(--clock-weight);
    font-style: var(--clock-style);
    line-height: 0.9;
    letter-spacing: var(--clock-spacing);
    color: var(--clock-fill);
    -webkit-text-stroke: var(--clock-stroke) rgb(190 184 176 / calc(var(--level) * 0.8));
  }
  .period {
    -webkit-text-stroke: 0;
    color: rgb(190 184 176 / calc(var(--level) * 0.8));
  }
  .period {
    font-size: 0.22em;
    font-weight: 400;
    margin-left: 0.25em;
    letter-spacing: 0.02em;
  }
  .date {
    margin-top: 1.4rem;
    font-size: calc(var(--date-size) * 0.95);
    font-weight: 400;
    font-style: var(--date-style);
    text-transform: var(--date-case);
    letter-spacing: var(--date-spacing);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem 2.6rem;
    margin-top: 2.2rem;
    font-size: 1.5rem;
    font-weight: 400;
  }
  .item {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    max-width: 40rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .when {
    font-weight: 600;
  }
</style>
