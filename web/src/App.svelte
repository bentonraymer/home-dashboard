<script lang="ts">
  import { untrack } from 'svelte';
  import WifiOff from '@lucide/svelte/icons/wifi-off';
    import Hero from './components/Hero.svelte';
  import NewsTicker from './components/NewsTicker.svelte';
  import NowPlaying from './components/NowPlaying.svelte';
  import Rotator from './components/Rotator.svelte';
  import Wallpaper from './components/Wallpaper.svelte';
  import { clock, dash } from './lib/store.svelte';
  import type { WidgetId } from './lib/types';

  const s = $derived(dash.settings);
  const left: WidgetId[][] = $derived(s?.layout.left ?? []);
  const right: WidgetId[][] = $derived(s?.layout.right ?? [['calendar'], ['todos']]);
  // Offset each rotating slot by a few seconds so they take turns changing.
  const phase = (column: 'left' | 'right', i: number) => (column === 'left' ? i : left.length + i) * 5;

  // A screen can override the shared scale with ?scale=0.8 in its URL.
  const urlScale = Number(new URLSearchParams(location.search).get('scale')) || null;
  const scale = $derived(urlScale ?? s?.display.scale ?? 0.85);
  $effect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(scale));
  });

  const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const dim = $derived.by(() => {
    const n = s?.display.nightDim;
    if (!n?.enabled) return 0;
    const d = new Date(clock.now);
    const now = d.getHours() * 60 + d.getMinutes();
    const start = minutes(n.start);
    const end = minutes(n.end);
    const inside = start <= end ? now >= start && now < end : now >= start || now < end;
    return inside ? n.level : 0;
  });

  // Nudge everything a few pixels every few minutes so static text can't burn into OLED/plasma panels.
  const shift = $derived.by(() => {
    if (!s?.display.burnInShift) return 'none';
    const step = Math.floor(clock.now / 240_000);
    const x = ((step * 7919) % 13) - 6;
    const y = ((step * 104729) % 9) - 4;
    return `translate(${x}px, ${y}px)`;
  });

  // Only flag a lost connection once it has lasted a while; brief blips are normal.
  let offlineSince = $state<number | null>(null);
  $effect(() => {
    const connected = dash.connected;
    untrack(() => (offlineSince = connected ? null : (offlineSince ?? Date.now())));
  });
  const offline = $derived(offlineSince !== null && clock.now - offlineSince > 15_000);
</script>

<div class="stage" class:low-power={s?.display.lowPower}>
  <Wallpaper />
  <div class="scrim" aria-hidden="true"></div>

  <main class="layout" class:no-right={!right.length} style:transform={shift}>
    <section class="hero-area"><Hero /></section>

    <section class="lower">
      {#if s?.layout.showNowPlaying ?? true}<NowPlaying />{/if}
      {#each left as group, i (group.join())}
        <div class="slot-wrap"><Rotator views={group} phase={phase('left', i)} /></div>
      {/each}
    </section>

    {#if right.length}
      <section class="column">
        {#each right as group, i (group.join())}
          <div class="slot-wrap"><Rotator views={group} phase={phase('right', i)} /></div>
        {/each}
      </section>
    {/if}

    <footer class="footer">
      {#if s?.layout.showNews ?? true}<NewsTicker />{:else}<span class="spacer"></span>{/if}
      {#if dash.wallpaper?.author}
        <span class="credit">Photo by {dash.wallpaper.author} on Unsplash</span>
      {/if}
    </footer>
  </main>

  {#if offline}
    <div class="offline glass"><WifiOff size="1.1rem" /> Reconnecting…</div>
  {/if}
  <div class="dim" style:opacity={dim} aria-hidden="true"></div>
</div>

<style>
  :global(html.dashboard) {
    font-size: calc(100vmin / 54 * var(--ui-scale, 0.85));
    overflow: hidden;
    cursor: none;
  }
  @media (orientation: portrait) {
    :global(html.dashboard) {
      font-size: calc(100vw / 40 * var(--ui-scale, 0.85));
    }
  }
  :global(.glass) {
    background: var(--glass);
    backdrop-filter: blur(1.8rem) saturate(170%);
    -webkit-backdrop-filter: blur(1.8rem) saturate(170%);
    border: 1px solid var(--hairline);
    box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.22);
  }
  :global(.low-power .glass) {
    background: var(--glass-solid);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  :global(.empty) {
    margin: 0.2rem 0;
    font-size: 1.1rem;
    color: var(--text-2);
  }
  :global(.fade-bottom) {
    mask-image: linear-gradient(to bottom, #000 calc(100% - 2.5rem), transparent);
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 2.5rem), transparent);
    padding-bottom: 1rem;
  }

  .stage {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
  .scrim {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(70% 65% at 0% 0%, rgba(0, 0, 0, calc(var(--scrim-hero, 0.25) + 0.1)), transparent 75%),
      radial-gradient(70% 60% at 0% 100%, rgba(0, 0, 0, var(--scrim-lower, 0.2)), transparent 75%),
      linear-gradient(to top, rgba(0, 0, 0, calc(var(--scrim-bottom, 0.2) + 0.25)), transparent 14%),
      radial-gradient(140% 140% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.35));
    transition: background 2.5s;
  }
  .layout {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 31rem;
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'hero column'
      'lower column'
      'footer footer';
    gap: 1.6rem 3rem;
    padding: 3rem 3.4rem 1.8rem;
    transition: transform 3s var(--ease);
  }
  .hero-area {
    grid-area: hero;
  }
  .column {
    grid-area: column;
    display: flex;
    flex-direction: column;
    gap: 1.3rem;
    min-height: 0;
  }
  .slot-wrap {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 0 1 auto;
  }
  .layout.no-right {
    grid-template-columns: minmax(0, 1fr) 0;
    column-gap: 0;
  }
  .lower {
    grid-area: lower;
    align-self: end;
    display: flex;
    flex-direction: column;
    gap: 1.3rem;
    max-width: 40rem;
    min-height: 0;
    max-height: 100%;
  }
  .footer {
    grid-area: footer;
    display: flex;
    align-items: baseline;
    gap: 2rem;
    min-width: 0;
  }
  .spacer {
    flex: 1;
  }
  .credit {
    flex: none;
    font-size: 0.85rem;
    color: var(--text-3);
    text-shadow: 0 0.1rem 0.6rem rgba(0, 0, 0, 0.5);
  }
  .offline {
    position: fixed;
    top: 1.2rem;
    right: 1.2rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.9rem;
    border-radius: 2rem;
    font-size: 0.95rem;
    color: var(--text-2);
  }
  .dim {
    position: fixed;
    inset: 0;
    background: #000;
    pointer-events: none;
    transition: opacity 60s linear;
  }

  @media (orientation: portrait) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      grid-template-areas: 'hero' 'lower' 'column' 'footer';
      padding: 2.4rem 2rem 1.6rem;
    }
    .lower {
      max-width: none;
      align-self: start;
    }
    .column {
      flex-direction: row;
    }
    .column .slot-wrap {
      flex: 1 1 0;
      min-width: 0;
    }
    .footer {
      flex-direction: column;
      align-items: stretch;
      gap: 0.6rem;
    }
  }
</style>
