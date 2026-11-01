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
  .hero {
    text-align: center;
    font-family: var(--hero-font);
    text-shadow: 0 0.1rem 1.2rem rgba(0, 0, 0, 0.35);
  }
  .time {
    font-family: var(--clock-font);
    font-size: var(--clock-size);
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
    margin-top: 0.9rem;
    font-size: var(--date-size);
    font-weight: var(--date-weight);
    font-style: var(--date-style);
    text-transform: var(--date-case);
    letter-spacing: var(--date-spacing);
  }
  .weather {
    display: flex;
    justify-content: center;
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
    text-align: left;
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
