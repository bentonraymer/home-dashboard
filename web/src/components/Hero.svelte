<script lang="ts">
  import { clock, dash } from '../lib/store.svelte';
  import { clockParts, deg } from '../lib/format';
  import { condition } from '../lib/weather';
  import WeatherIcon from './WeatherIcon.svelte';

  const use24h = $derived(dash.settings?.clock.use24h ?? false);
  const showSeconds = $derived(dash.settings?.clock.showSeconds ?? false);
  const time = $derived(clockParts(clock.now, use24h));
  const date = $derived(new Date(clock.now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
  const style = $derived(dash.settings?.display.clockStyle ?? 'classic');
  const w = $derived(dash.weather?.configured ? dash.weather : null);
  const today = $derived(w?.daily?.[0]);
</script>

<div class="hero cs-{style}">
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
  /* Everything here is sized in --u, which shrinks below 1rem when the space between the
     columns gets too narrow (large text size, small screens), so nothing wraps or overflows. */
  .hero {
    --u: min(1rem, 3.1cqi);
    font-size: var(--u);
    text-align: center;
    font-family: var(--hero-font);
    text-shadow: 0 calc(0.1 * var(--u)) calc(1.2 * var(--u)) rgba(0, 0, 0, 0.35);
  }
  .time {
    font-family: var(--clock-font);
    font-size: calc(var(--clock-size) * var(--u));
    font-weight: var(--clock-weight);
    font-style: var(--clock-style);
    line-height: 0.9;
    letter-spacing: var(--clock-spacing);
    color: var(--clock-fill);
    -webkit-text-stroke: var(--clock-stroke) var(--text);
    text-shadow: var(--clock-shadow);
  }
  .sec,
  .period {
    -webkit-text-stroke: 0;
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
    margin-top: calc(0.9 * var(--u));
    font-size: calc(var(--date-size) * var(--u));
    white-space: nowrap;
    font-weight: var(--date-weight);
    font-style: var(--date-style);
    text-transform: var(--date-case);
    letter-spacing: var(--date-spacing);
  }
  .weather {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: calc(1 * var(--u));
    margin-top: calc(1.6 * var(--u));
  }
  .icon {
    font-size: calc(3.6 * var(--u));
    display: inline-flex;
  }
  .temp {
    font-size: calc(4.2 * var(--u));
    font-weight: 300;
    letter-spacing: -0.02em;
  }
  .meta {
    white-space: nowrap;
    margin-left: calc(0.4 * var(--u));
    text-align: left;
  }
  .cond {
    font-size: calc(1.45 * var(--u));
    font-weight: 600;
  }
  .sub {
    font-size: calc(1.15 * var(--u));
    color: var(--text-2);
    margin-top: calc(0.15 * var(--u));
  }
  .hint {
    margin-top: calc(1.6 * var(--u));
    font-size: calc(1.2 * var(--u));
    color: var(--text-2);
  }
</style>
