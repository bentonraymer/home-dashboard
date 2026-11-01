<script lang="ts">
  import { dash } from '../lib/store.svelte';
  import { formatTime } from '../lib/format';

  // The map is laid out in a fixed 600×400 "map pixel" box, then scaled to the card's width.
  const W = 600;
  const H = 400;
  const TILE = 256;
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

  const metersPerPx = (z: number) => (40075016 * Math.cos((lat * Math.PI) / 180)) / (TILE * 2 ** z);
  // Zoom so the whole search radius (plus a margin) fits across the map.
  const zoom = $derived(Math.max(3, Math.min(10, Math.floor(Math.log2((W * metersPerPx(0)) / (radiusKm * 1000 * 2.3))))));

  const center = $derived.by(() => {
    const size = TILE * 2 ** zoom;
    const sin = Math.sin((lat * Math.PI) / 180);
    return { x: ((lon + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
  });

  /** Tiles at zoom `z` covering the map, each `size` map pixels wide. */
  function tiles(z: number) {
    const size = TILE * 2 ** (zoom - z);
    const left = center.x - W / 2;
    const top = center.y - H / 2;
    const count = 2 ** z;
    const out: { x: number; y: number; left: number; top: number; size: number }[] = [];
    for (let ty = Math.floor(top / size); ty <= Math.floor((top + H) / size); ty++) {
      if (ty < 0 || ty >= count) continue;
      for (let tx = Math.floor(left / size); tx <= Math.floor((left + W) / size); tx++) {
        out.push({ x: ((tx % count) + count) % count, y: ty, left: tx * size - left, top: ty * size - top, size });
      }
    }
    return out;
  }
  const baseTiles = $derived(tiles(zoom));
  const radarTiles = $derived(tiles(Math.min(zoom, RADAR_MAX_ZOOM)));
  const radarZoom = $derived(Math.min(zoom, RADAR_MAX_ZOOM));
  const ringPx = $derived((radiusKm * 1000) / metersPerPx(zoom));
  // Esri's dark canvas needs no API key; labels are a separate layer so they sit above the radar.
  const basemap = (layer: 'Base' | 'Reference', t: { x: number; y: number }) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_${layer}/MapServer/tile/${zoom}/${t.y}/${t.x}`;

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

  let width = $state(W);

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
  <div class="map" bind:clientWidth={width}>
    <div class="canvas" style:width="{W}px" style:height="{H}px" style:transform="scale({width / W})">
      {#each baseTiles as t (`${t.x}/${t.y}`)}
        <img src={basemap('Base', t)} alt="" style:left="{t.left}px" style:top="{t.top}px" style:width="{t.size}px" />
      {/each}
      {#each frames as f, i (f.path)}
        <div class="frame" class:on={i === frame}>
          {#each radarTiles as t (`${t.x}/${t.y}`)}
            <img
              src={`${radar?.host}${f.path}/256/${radarZoom}/${t.x}/${t.y}/2/1_1.png`}
              alt=""
              style:left="{t.left}px"
              style:top="{t.top}px"
              style:width="{t.size}px"
            />
          {/each}
        </div>
      {/each}
      {#each baseTiles as t (`${t.x}/${t.y}`)}
        <img src={basemap('Reference', t)} alt="" style:left="{t.left}px" style:top="{t.top}px" style:width="{t.size}px" />
      {/each}
      <div class="ring" style:width="{ringPx * 2}px" style:height="{ringPx * 2}px"></div>
      <div class="you"></div>
    </div>
    <span class="credit">RainViewer · Esri, HERE, Garmin</span>
  </div>
</div>

<style>
  .radar {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
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
  .map {
    position: relative;
    aspect-ratio: 3 / 2;
    border-radius: 0.9rem;
    overflow: hidden;
    background: #0e0f12;
  }
  .canvas {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
  }
  img {
    position: absolute;
    display: block;
    aspect-ratio: 1;
    user-select: none;
  }
  .frame {
    position: absolute;
    inset: 0;
    opacity: 0;
  }
  .frame.on {
    opacity: 0.85;
  }
  .ring {
    position: absolute;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    border-radius: 50%;
    border: 1.5px dashed rgba(255, 255, 255, 0.22);
  }
  .you {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 14px;
    height: 14px;
    translate: -50% -50%;
    border-radius: 50%;
    background: var(--blue);
    border: 2.5px solid #fff;
    box-shadow: 0 0 0 5px rgba(10, 132, 255, 0.3);
  }
  .credit {
    position: absolute;
    right: 0.5rem;
    bottom: 0.35rem;
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.45);
  }
</style>
