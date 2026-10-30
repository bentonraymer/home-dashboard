<script lang="ts">
  import { clock, dash } from '../lib/store.svelte';
  import { deg } from '../lib/format';
  import { condition } from '../lib/weather';
  import WeatherIcon from './WeatherIcon.svelte';

  const use24h = $derived(dash.settings?.clock.use24h ?? false);
  const showSeconds = $derived(dash.settings?.clock.showSeconds ?? false);
  const time = $derived.by(() => {
    const d = new Date(clock.now);
    const h = use24h ? String(d.getHours()).padStart(2, '0') : String(d.getHours() % 12 || 12);
    const m = String(d.getMinutes()).padStart(2, '0');
    return { main: `${h}:${m}`, seconds: String(d.getSeconds()).padStart(2, '0'), period: d.getHours() < 12 ? 'AM' : 'PM' };
  });
  const date = $derived(new Date(clock.now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
  const w = $derived(dash.weather?.configured ? dash.weather : null);
  const today = $derived(w?.daily?.[0]);
</script>

<div class="hero">
  <div class="time num">
    {time.main}{#if showSeconds}<span class="sec">{time.seconds}</span>{/if}{#if !use24h}<span class="period">{time.period}</span>{/if}
  </div>
  <div class="date">{date}</div>

  {#if w?.current}
    <div class="weather">
      <span class="icon"><WeatherIcon code={w.current.code} isDay={w.current.isDay} size="1em" /></span>
      <span class="temp num">{deg(w.current.temp)}</span>
      <div class="meta">
        <div class="cond">{condition(w.current.code, w.current.isDay).label}</div>
        <div class="sub num">
          {#if today}H {deg(today.hi)}&nbsp; L {deg(today.lo)}&nbsp;·&nbsp;{/if}Feels {deg(w.current.feelsLike)}
        </div>
      </div>
    </div>
  {:else if dash.weather && !dash.weather.configured}
    <div class="hint">Set your location in Settings to see the weather.</div>
  {/if}
</div>

<style>
  .hero {
    text-shadow: 0 0.1rem 1.2rem rgba(0, 0, 0, 0.35);
  }
  .time {
    font-size: 9.5rem;
    font-weight: 200;
    line-height: 0.9;
    letter-spacing: -0.03em;
    margin-left: -0.06em;
  }
  .sec {
    font-size: 0.32em;
    font-weight: 300;
    margin-left: 0.12em;
    color: var(--text-2);
    letter-spacing: 0;
  }
  .period {
    font-size: 0.26em;
    font-weight: 400;
    margin-left: 0.2em;
    letter-spacing: 0.02em;
    color: var(--text-2);
  }
  .date {
    margin-top: 0.9rem;
    font-size: 2rem;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .weather {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1.6rem;
  }
  .icon {
    font-size: 3.6rem;
    display: inline-flex;
  }
  .temp {
    font-size: 4.2rem;
    font-weight: 300;
    letter-spacing: -0.02em;
  }
  .meta {
    margin-left: 0.4rem;
  }
  .cond {
    font-size: 1.45rem;
    font-weight: 600;
  }
  .sub {
    font-size: 1.15rem;
    color: var(--text-2);
    margin-top: 0.15rem;
  }
  .hint {
    margin-top: 1.6rem;
    font-size: 1.2rem;
    color: var(--text-2);
  }
</style>
