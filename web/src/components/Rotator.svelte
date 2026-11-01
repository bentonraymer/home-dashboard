<script lang="ts">
  import { fade } from 'svelte/transition';
  import { clock, dash } from '../lib/store.svelte';
  import type { WidgetId } from '../lib/types';
  import { WIDGETS } from '../lib/widgets';
  import Card from './Card.svelte';

  /** `phase` (seconds) staggers slots so they don't all flip at the same moment. */
  let { views, phase = 0 }: { views: WidgetId[]; phase?: number } = $props();

  const ready = $derived(views.filter((id) => WIDGETS[id]?.ready(dash)));
  const intervalSec = $derived(dash.settings?.layout.rotatorIntervalSec ?? 20);
  // Derived from wall-clock time so every screen shows the same view at once.
  const index = $derived(ready.length ? Math.floor((clock.now / 1000 + phase) / intervalSec) % ready.length : 0);
  const current = $derived(ready[index]);
</script>

{#if current}
  <div class="stack" class:rigid={!WIDGETS[current].shrinks}>
    {#key current}
      {@const w = WIDGETS[current]}
      <div class="slot" class:uniform={w.uniform} transition:fade={{ duration: ready.length > 1 ? 800 : 0 }}>
        <Card title={w.title} icon={w.icon} accent={w.accent}>
          {#snippet aside()}
            {#if ready.length > 1}
              <span class="dots">
                {#each ready as id, i (id)}<i class:on={i === index}></i>{/each}
              </span>
            {/if}
          {/snippet}
          <w.component />
        </Card>
      </div>
    {/key}
  </div>
{/if}

<style>
  .stack {
    display: grid;
    grid-template: minmax(0, auto) / minmax(0, 1fr);
    min-height: 0;
  }
  .slot {
    grid-area: 1 / 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  /* Fixed-height cards: the widget inside stretches to fill the card body. */
  .slot.uniform > :global(.card) {
    height: var(--uniform-card-h);
  }
  .slot.uniform > :global(.card > .body) {
    display: flex;
    flex-direction: column;
  }
  .slot.uniform > :global(.card > .body > *) {
    flex: 1 1 auto;
    min-height: 0;
  }
  .dots {
    display: inline-flex;
    gap: 0.35rem;
  }
  .dots i {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
  }
  .dots i.on {
    background: #fff;
  }
</style>
