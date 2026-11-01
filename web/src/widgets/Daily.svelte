<script lang="ts">
  import WeatherIcon from '../components/WeatherIcon.svelte';
  import { dash } from '../lib/store.svelte';
  import { deg, localDate } from '../lib/format';
  import { tempColor } from '../lib/weather';

  const units = $derived(dash.weather?.units ?? 'imperial');
  const days = $derived((dash.weather?.daily ?? []).slice(0, 6));
  const lo = $derived(Math.min(...days.map((d) => d.lo)));
  const hi = $derived(Math.max(...days.map((d) => d.hi)));
  const pct = (t: number) => ((t - lo) / Math.max(1, hi - lo)) * 100;
  const current = $derived(dash.weather?.current?.temp);
</script>

<div class="days">
  {#each days as d, i (d.date)}
    <div class="day">
      <span class="name">{i === 0 ? 'Today' : localDate(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</span>
      <span class="cond">
        <span class="icon"><WeatherIcon code={d.code} size="1em" /></span>
        <span class="pop num">{d.pop >= 20 ? `${d.pop}%` : ''}</span>
      </span>
      <span class="lo num">{deg(d.lo)}</span>
      <span class="range">
        <span
          class="fill"
          style:left={`${pct(d.lo)}%`}
          style:right={`${100 - pct(d.hi)}%`}
          style:background={`linear-gradient(90deg, ${tempColor(d.lo, units)}, ${tempColor(d.hi, units)})`}
        ></span>
        {#if i === 0 && current !== undefined}
          <span class="dot" style:left={`${pct(current)}%`}></span>
        {/if}
      </span>
      <span class="hi num">{deg(d.hi)}</span>
    </div>
  {/each}
</div>

<style>
  .days {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .day {
    display: grid;
    grid-template-columns: 4.2rem 4.4rem 2.8rem 1fr 2.8rem;
    align-items: center;
    gap: 0.7rem;
    padding: 0.3rem 0;
    font-size: 1.15rem;
  }
  .name {
    font-weight: 600;
  }
  .cond {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .icon {
    font-size: 1.5rem;
    display: inline-flex;
  }
  .pop {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--teal);
  }
  .lo {
    color: var(--text-3);
    text-align: right;
  }
  .range {
    position: relative;
    height: 0.32rem;
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.15);
  }
  .fill {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 1rem;
  }
  .dot {
    position: absolute;
    top: 50%;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: #fff;
    border: 0.12rem solid rgba(0, 0, 0, 0.5);
    transform: translate(-50%, -50%);
  }
</style>
