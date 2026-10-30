<script lang="ts">
  import { fade } from 'svelte/transition';
  import { clock, dash } from '../lib/store.svelte';
  import type { WidgetId } from '../lib/types';
  import { WIDGETS } from '../lib/widgets';
  import Card from './Card.svelte';

  let { views }: { views: WidgetId[] } = $props();

  const ready = $derived(views.filter((id) => WIDGETS[id].ready(dash)));
  const intervalSec = $derived(dash.settings?.layout.rotatorIntervalSec ?? 20);
  // Derived from wall-clock time so every screen shows the same view at once.
  const index = $derived(ready.length ? Math.floor(clock.now / 1000 / intervalSec) % ready.length : 0);
  const current = $derived(ready[index]);
</script>

{#if current}
  <div class="stack">
    {#key current}
      {@const w = WIDGETS[current]}
      <div class="slot" transition:fade={{ duration: 800 }}>
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
    align-items: end;
  }
  .slot {
    grid-area: 1 / 1;
    min-width: 0;
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
