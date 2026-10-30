<script lang="ts">
  import Sunrise from '@lucide/svelte/icons/sunrise';
  import Sunset from '@lucide/svelte/icons/sunset';
  import { clock, dash } from '../lib/store.svelte';
  import { formatTime } from '../lib/format';
  import { aqiCategory, uvCategory } from '../lib/weather';

  const w = $derived(dash.weather);
  const use24h = $derived(dash.settings?.clock.use24h ?? false);
  const aqi = $derived(w?.air?.aqi ?? null);
  const cat = $derived(aqi !== null ? aqiCategory(aqi) : null);
  const uv = $derived(w?.current?.uv ?? 0);
  // Show the next sunrise/sunset pair: tomorrow's sunrise once today's has passed.
  const sun = $derived.by(() => {
    const days = w?.daily ?? [];
    const today = days[0];
    if (!today) return null;
    const sunrise = today.sunrise > clock.now || !days[1] ? today.sunrise : days[1].sunrise;
    const sunset = today.sunset > clock.now || !days[1] ? today.sunset : days[1].sunset;
    return { sunrise, sunset };
  });
  const moon = $derived(w?.moon);

  // SVG path for the lit part of the moon; phase 0 = new, 0.5 = full.
  const moonPath = $derived.by(() => {
    if (!moon) return '';
    const p = moon.phase;
    const waxing = p < 0.5;
    const gibbous = p > 0.25 && p < 0.75;
    const rx = Math.abs(Math.cos(2 * Math.PI * p));
    return `M0,-1 A1,1 0 0 ${waxing ? 1 : 0} 0,1 A${rx},1 0 0 ${waxing === gibbous ? 1 : 0} 0,-1`;
  });
</script>

<div class="tiles">
  {#if cat && aqi !== null}
    <div class="tile">
      <div class="label">Air Quality</div>
      <div class="value num">{Math.round(aqi)}</div>
      <div class="desc" style:color={cat.color}>{cat.label}</div>
      <div class="scale"><span class="marker" style:left={`${Math.min(100, (aqi / 300) * 100)}%`}></span></div>
    </div>
  {/if}
  <div class="tile">
    <div class="label">UV Index</div>
    <div class="value num">{Math.round(uv)}</div>
    <div class="desc">{uvCategory(uv)}</div>
    <div class="scale uv"><span class="marker" style:left={`${Math.min(100, (uv / 11) * 100)}%`}></span></div>
  </div>
  {#if sun}
    <div class="tile">
      <div class="label">Sun</div>
      <div class="sunrow"><Sunrise size="1.4rem" color="#ffd60a" /><span class="num">{formatTime(sun.sunrise, use24h)}</span></div>
      <div class="sunrow"><Sunset size="1.4rem" color="#ff9f0a" /><span class="num">{formatTime(sun.sunset, use24h)}</span></div>
    </div>
  {/if}
  {#if moon}
    <div class="tile moon">
      <svg viewBox="-1.1 -1.1 2.2 2.2" aria-hidden="true">
        <circle r="1" fill="rgba(255,255,255,0.12)" />
        <path d={moonPath} fill="#f2f2f7" />
      </svg>
      <div>
        <div class="label">Moon</div>
        <div class="desc strong">{moon.name}</div>
        <div class="desc num">{Math.round(moon.illumination * 100)}% lit</div>
      </div>
    </div>
  {/if}
  {#if w?.air?.pollen?.length}
    <div class="tile wide">
      <div class="label">Pollen (grains/m³)</div>
      <div class="pollen">
        {#each w.air.pollen as p (p.name)}
          <span><b>{p.name}</b> <span class="num">{Math.round(p.value)}</span></span>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.8rem;
  }
  .tile {
    background: rgba(255, 255, 255, 0.07);
    border-radius: 1rem;
    padding: 0.8rem 1rem;
  }
  .wide {
    grid-column: 1 / -1;
  }
  .label {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .value {
    font-size: 2rem;
    font-weight: 500;
    line-height: 1.1;
    margin-top: 0.2rem;
  }
  .desc {
    font-size: 1rem;
    color: var(--text-2);
  }
  .strong {
    color: var(--text);
    font-weight: 600;
    margin-top: 0.2rem;
  }
  .scale {
    position: relative;
    height: 0.3rem;
    margin-top: 0.55rem;
    border-radius: 1rem;
    background: linear-gradient(90deg, #30d158, #ffd60a, #ff9f0a, #ff453a, #bf5af2);
  }
  .scale.uv {
    background: linear-gradient(90deg, #30d158, #ffd60a, #ff9f0a, #ff453a, #bf5af2);
  }
  .marker {
    position: absolute;
    top: 50%;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: #fff;
    border: 0.12rem solid rgba(0, 0, 0, 0.5);
    transform: translate(-50%, -50%);
  }
  .sunrow {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 1.2rem;
    font-weight: 500;
    margin-top: 0.35rem;
  }
  .moon {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .moon svg {
    width: 3.4rem;
    height: 3.4rem;
    flex: none;
  }
  .pollen {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.2rem;
    margin-top: 0.3rem;
    font-size: 1rem;
    text-transform: capitalize;
  }
  .pollen b {
    font-weight: 600;
  }
</style>
