<script lang="ts">
  import WeatherIcon from '../components/WeatherIcon.svelte';
  import { dash } from '../lib/store.svelte';
  import { deg, formatHour } from '../lib/format';

  const use24h = $derived(dash.settings?.clock.use24h ?? false);
  // Two rows of as many hours as fit across the card.
  const MIN_COLUMN_REM = 3.4;
  let width = $state(0);
  const perRow = $derived.by(() => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return Math.max(3, Math.floor((width + 0.3 * rem) / ((MIN_COLUMN_REM + 0.3) * rem)));
  });
  const hours = $derived((dash.weather?.hourly ?? []).slice(0, perRow * 2));
</script>

<div class="row" bind:clientWidth={width} style:grid-template-columns="repeat({perRow}, 1fr)">
  {#each hours as h, i (h.time)}
    <div class="hour">
      <span class="t">{i === 0 ? 'Now' : formatHour(h.time, use24h)}</span>
      <span class="icon"><WeatherIcon code={h.code} isDay={h.isDay} size="1em" /></span>
      <span class="pop num">{h.pop >= 20 ? `${h.pop}%` : ''}</span>
      <span class="temp num">{deg(h.temp)}</span>
    </div>
  {/each}
</div>

<style>
  .row {
    display: grid;
    grid-template-rows: auto auto;
    align-content: space-evenly;
    column-gap: 0.3rem;
  }
  .hour {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }
  .t {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-2);
  }
  .icon {
    font-size: 1.9rem;
    display: inline-flex;
    margin-top: 0.3rem;
  }
  .pop {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--teal);
    height: 1rem;
  }
  .temp {
    font-size: 1.35rem;
    font-weight: 500;
  }
</style>
