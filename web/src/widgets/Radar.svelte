<script lang="ts">
  import { dash } from '../lib/store.svelte';
  import { formatTime } from '../lib/format';
  import MapView from '../components/MapView.svelte';

  // RainViewer only serves radar up to zoom 7; above that its tiles are drawn larger.
  const RADAR_MAX_ZOOM = 7;
  const FRAME_MS = 550;
  const HOLD_MS = 2500;

  const radar = $derived(dash.radar);
  const s = $derived(dash.settings);
  const lat = $derived(s?.location.latitude ?? 0);
  const lon = $derived(s?.location.longitude ?? 0);
  const radiusKm = $derived(radar?.radiusKm ?? s?.radar.radiusKm ?? 80);
  const lowPower = $derived(s?.display.lowPower ?? false);
  const frames = $derived((radar?.frames ?? []).slice(lowPower ? -1 : -10));

  // Loop through the recent frames, pausing on the latest one.
  let frame = $state(0);
  $effect(() => {
    const n = frames.length;
    frame = n - 1;
    if (n < 2) return;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      frame = (frame + 1) % n;
      timer = setTimeout(step, frame === n - 1 ? HOLD_MS : FRAME_MS);
    };
    timer = setTimeout(step, HOLD_MS);
    return () => clearTimeout(timer);
  });

  const imperial = $derived(s?.units !== 'metric');
  const snowy = $derived([71, 73, 75, 77, 85, 86].includes(dash.weather?.current?.code ?? -1));
  const summary = $derived.by(() => {
    const what = snowy ? 'Snow' : 'Rain';
    const km = radar?.nearestKm;
    if (km == null) return `${what} in the area`;
    if (km <= 3) return `${what} at your location`;
    const distance = imperial ? `${Math.round(km / 1.609)} mi` : `${km} km`;
    return `${what} ${distance} away`;
  });
  const frameTime = $derived(frames[frame] ? formatTime(frames[frame].time, s?.clock.use24h ?? false) : '');
</script>

<div class="radar">
  <div class="summary">
    <span>{summary}</span>
    <span class="time num" class:latest={frame === frames.length - 1}>{frameTime}</span>
  </div>
  <MapView {lat} {lon} {radiusKm} fill credit="RainViewer · Esri, HERE, Garmin">
    {#snippet under(map)}
      {@const z = Math.min(map.zoom, RADAR_MAX_ZOOM)}
      {#each frames as f, i (f.path)}
        <div class="frame" class:on={i === frame}>
          {#each map.tiles(z) as t (`${t.x}/${t.y}`)}
            <img
              class="tile"
              src={`${radar?.host}${f.path}/256/${z}/${t.x}/${t.y}/2/1_1.png`}
              alt=""
              style:left="{t.left}px"
              style:top="{t.top}px"
              style:width="{t.size}px"
            />
          {/each}
        </div>
      {/each}
    {/snippet}
  </MapView>
</div>

<style>
  .radar {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .radar > :global(.map) {
    flex: 1 1 0;
  }
  .summary {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    font-size: 1.25rem;
    font-weight: 600;
  }
  .time {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-3);
  }
  .time.latest {
    color: var(--text-2);
  }
  .frame {
    position: absolute;
    inset: 0;
    opacity: 0;
  }
  .frame.on {
    opacity: 0.85;
  }
</style>
