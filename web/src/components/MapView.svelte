<script lang="ts" module>
  export interface Tile {
    x: number;
    y: number;
    left: number;
    top: number;
    size: number;
  }
  export interface MapApi {
    zoom: number;
    /** Tiles at zoom `z` covering the map, each drawn `size` map pixels wide. */
    tiles: (z: number) => Tile[];
    /** Map-pixel position of a coordinate. */
    point: (lat: number, lon: number) => { x: number; y: number };
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  // The map is laid out in a fixed 600×400 "map pixel" box, then scaled to the card's width.
  const W = 600;
  const H = 400;
  const TILE = 256;

  let {
    lat,
    lon,
    radiusKm,
    credit,
    fill = false,
    under,
    over,
  }: {
    lat: number;
    lon: number;
    radiusKm: number;
    credit: string;
    /** Fill the parent's height instead of keeping a 3:2 shape; the map is cropped to cover it. */
    fill?: boolean;
    under?: Snippet<[MapApi]>;
    over?: Snippet<[MapApi]>;
  } = $props();

  const metersPerPx = (z: number) => (40075016 * Math.cos((lat * Math.PI) / 180)) / (TILE * 2 ** z);
  // Zoom so the whole radius (plus a margin) fits across the map.
  const zoom = $derived(Math.max(3, Math.min(12, Math.floor(Math.log2((W * metersPerPx(0)) / (radiusKm * 1000 * 2.3))))));

  function world(la: number, lo: number, z: number) {
    const size = TILE * 2 ** z;
    const sin = Math.sin((la * Math.PI) / 180);
    return { x: ((lo + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
  }
  const center = $derived(world(lat, lon, zoom));

  const api: MapApi = $derived({
    zoom,
    tiles(z) {
      const size = TILE * 2 ** (zoom - z);
      const left = center.x - W / 2;
      const top = center.y - H / 2;
      const count = 2 ** z;
      const out: Tile[] = [];
      for (let ty = Math.floor(top / size); ty <= Math.floor((top + H) / size); ty++) {
        if (ty < 0 || ty >= count) continue;
        for (let tx = Math.floor(left / size); tx <= Math.floor((left + W) / size); tx++) {
          out.push({ x: ((tx % count) + count) % count, y: ty, left: tx * size - left, top: ty * size - top, size });
        }
      }
      return out;
    },
    point(la, lo) {
      const p = world(la, lo, zoom);
      return { x: p.x - center.x + W / 2, y: p.y - center.y + H / 2 };
    },
  });
  const baseTiles = $derived(api.tiles(zoom));
  const ringPx = $derived((radiusKm * 1000) / metersPerPx(zoom));
  // Esri's dark canvas needs no API key; labels are a separate layer so they sit above any overlay.
  const basemap = (layer: 'Base' | 'Reference', t: Tile) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_${layer}/MapServer/tile/${zoom}/${t.y}/${t.x}`;

  let width = $state(W);
  let height = $state(H);
  // Cover the box, cropping the edges evenly; the centre (your location) stays in the middle.
  const scale = $derived(fill ? Math.max(width / W, height / H) : width / W);
  const transform = $derived(`translate(${(width - W * scale) / 2}px, ${fill ? (height - H * scale) / 2 : 0}px) scale(${scale})`);
</script>

<div class="map" class:fill bind:clientWidth={width} bind:clientHeight={height}>
  <div class="canvas" style:width="{W}px" style:height="{H}px" style:transform={transform}>
    {#each baseTiles as t (`${t.x}/${t.y}`)}
      <img class="tile" src={basemap('Base', t)} alt="" style:left="{t.left}px" style:top="{t.top}px" style:width="{t.size}px" />
    {/each}
    {@render under?.(api)}
    {#each baseTiles as t (`${t.x}/${t.y}`)}
      <img class="tile" src={basemap('Reference', t)} alt="" style:left="{t.left}px" style:top="{t.top}px" style:width="{t.size}px" />
    {/each}
    <div class="ring" style:width="{ringPx * 2}px" style:height="{ringPx * 2}px"></div>
    <div class="you"></div>
    {@render over?.(api)}
  </div>
  <span class="credit">{credit}</span>
</div>

<style>
  .map {
    position: relative;
    aspect-ratio: 3 / 2;
    border-radius: 0.9rem;
    overflow: hidden;
    background: #0e0f12;
  }
  .map.fill {
    aspect-ratio: auto;
    min-height: 6rem;
  }
  .canvas {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
  }
  .canvas :global(img.tile) {
    position: absolute;
    display: block;
    aspect-ratio: 1;
    user-select: none;
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
