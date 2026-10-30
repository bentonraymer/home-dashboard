<script lang="ts">
  import { dash } from '../lib/store.svelte';

  interface Layer {
    key: number;
    url: string;
    visible: boolean;
  }

  let layers: Layer[] = $state([]);
  let counter = 0;
  const kenBurns = $derived((dash.settings?.display.kenBurns ?? true) && !dash.settings?.display.lowPower);
  const intervalMin = $derived(dash.settings?.wallpaper.intervalMin ?? 3);

  /**
   * Sample the photo where text sits and strengthen the scrims on bright images,
   * so white text stays readable on snow, sky and beaches.
   */
  function measure(img: HTMLImageElement) {
    try {
      const w = 48;
      const h = 27;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const region = (x0: number, y0: number, x1: number, y1: number) => {
        let sum = 0;
        let n = 0;
        for (let y = Math.floor(y0 * h); y < y1 * h; y++) {
          for (let x = Math.floor(x0 * w); x < x1 * w; x++) {
            const i = (y * w + x) * 4;
            sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
            n++;
          }
        }
        return n ? sum / n : 0.5;
      };
      const root = document.documentElement.style;
      const strength = (lum: number) => (0.12 + Math.max(0, lum - 0.25) * 0.85).toFixed(3);
      root.setProperty('--scrim-hero', strength(region(0, 0, 0.6, 0.55)));
      root.setProperty('--scrim-lower', strength(region(0, 0.5, 0.6, 1)));
      root.setProperty('--scrim-bottom', strength(region(0, 0.85, 1, 1)));
    } catch {
      // Cross-origin or decode failure: keep the default scrims.
    }
  }

  async function show(url: string) {
    if (layers[layers.length - 1]?.url === url) return;
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      return;
    }
    measure(img);
    const key = ++counter;
    layers.push({ key, url, visible: false });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const layer = layers.find((l) => l.key === key);
        if (layer) layer.visible = true;
      }),
    );
    setTimeout(() => {
      layers = layers.filter((l) => l.key >= key);
    }, 3000);
  }

  $effect(() => {
    const url = dash.wallpaper?.url;
    if (url) show(url);
  });
</script>

<div class="wallpaper" aria-hidden="true">
  {#each layers as layer (layer.key)}
    <div class="layer" class:visible={layer.visible}>
      <img
        src={layer.url}
        alt=""
        class:kb={kenBurns}
        class:alt={layer.key % 2 === 0}
        style:animation-duration={`${intervalMin * 60 + 10}s`}
      />
    </div>
  {/each}
</div>

<style>
  .wallpaper {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: radial-gradient(120% 120% at 20% 10%, #2c3e50 0%, #0b0b10 70%);
  }
  .layer {
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 2.5s var(--ease);
  }
  .layer.visible {
    opacity: 1;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .kb {
    animation: drift linear forwards;
    transform-origin: 30% 40%;
    will-change: transform;
  }
  .kb.alt {
    transform-origin: 70% 60%;
  }
  @keyframes drift {
    from {
      transform: scale(1.0);
    }
    to {
      transform: scale(1.08);
    }
  }
</style>
