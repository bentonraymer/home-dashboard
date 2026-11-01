<script lang="ts">
  import MapView from '../components/MapView.svelte';
  import { dash } from '../lib/store.svelte';
  import type { Flight } from '../lib/types';

  // Flights with a label on the map and a row in the list underneath.
  const LISTED = 3;

  const s = $derived(dash.settings);
  const lat = $derived(s?.location.latitude ?? 0);
  const lon = $derived(s?.location.longitude ?? 0);
  const radiusKm = $derived(dash.flights?.radiusKm ?? s?.flights.radiusKm ?? 25);
  const aircraft = $derived(dash.flights?.aircraft ?? []);
  const listed = $derived(aircraft.slice(0, LISTED));
  const imperial = $derived(s?.units !== 'metric');

  const name = (f: Flight) => f.callsign || f.registration || f.hex.toUpperCase();
  const distance = (km: number) => (imperial ? `${(km / 1.609).toFixed(km < 16 ? 1 : 0)} mi` : `${km.toFixed(km < 10 ? 1 : 0)} km`);
  const altitude = (ft: number) => (imperial ? `${ft.toLocaleString()} ft` : `${Math.round(ft * 0.3048).toLocaleString()} m`);
  const detail = (f: Flight) => [f.route?.airline, f.type].filter(Boolean).join(' · ');
</script>

<div class="flights">
  <MapView {lat} {lon} {radiusKm} credit="ADSB.lol · Esri, HERE, Garmin">
    {#snippet over(map)}
      {#each aircraft as f, i (f.hex)}
        {@const p = map.point(f.lat, f.lon)}
        <div class="plane" class:listed={i < LISTED} class:still={s?.display.lowPower} style:left="{p.x}px" style:top="{p.y}px">
          <svg viewBox="0 0 24 24" style:rotate="{f.track}deg" aria-hidden="true">
            <path d="M12 2c.8 0 1.4.9 1.4 2v5.2l7.6 4.4v2l-7.6-2.4v4.6l2.2 1.7V21L12 20l-3.6 1v-1.5l2.2-1.7v-4.6L3 15.6v-2l7.6-4.4V4c0-1.1.6-2 1.4-2z" />
          </svg>
          {#if i < LISTED}<span class="tag">{name(f)}</span>{/if}
        </div>
      {/each}
    {/snippet}
  </MapView>

  <ul>
    {#each listed as f (f.hex)}
      <li>
        <div class="main">
          <span class="callsign">{name(f)}</span>
          {#if f.route}<span class="route">{f.route.from} → {f.route.to}</span>{/if}
        </div>
        <div class="sub">
          <span class="detail">{detail(f)}</span>
          <span class="num">{altitude(f.altitudeFt)} · {distance(f.distanceKm)}</span>
        </div>
      </li>
    {/each}
  </ul>
</div>

<style>
  .flights {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .plane {
    position: absolute;
    width: 0;
    height: 0;
    transition:
      left 20s linear,
      top 20s linear;
  }
  .plane.still {
    transition: none;
  }
  svg {
    position: absolute;
    width: 18px;
    height: 18px;
    left: -9px;
    top: -9px;
    fill: rgba(255, 255, 255, 0.75);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
  }
  .listed svg {
    width: 24px;
    height: 24px;
    left: -12px;
    top: -12px;
    fill: var(--orange);
  }
  .tag {
    position: absolute;
    left: 14px;
    top: -9px;
    padding: 1px 6px;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.6);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    color: #fff;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .main,
  .sub {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
  }
  .callsign {
    font-size: 1.15rem;
    font-weight: 600;
  }
  .route {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--orange);
    white-space: nowrap;
  }
  .sub {
    font-size: 0.9rem;
    color: var(--text-2);
  }
  .detail {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub .num {
    white-space: nowrap;
  }
</style>
