<script lang="ts">
  import { fade } from 'svelte/transition';
  import { clock, dash } from '../lib/store.svelte';
  import { relativeTime } from '../lib/format';

  const items = $derived(dash.news?.items ?? []);
  const intervalSec = $derived(dash.settings?.news.intervalSec ?? 12);
  const index = $derived(items.length ? Math.floor(clock.now / 1000 / intervalSec) % items.length : 0);
  const item = $derived(items[index]);
</script>

<div class="ticker">
  {#if item}
    {#key item.title}
      <div class="item" transition:fade={{ duration: 700 }}>
        <span class="source">{item.source}</span>
        <span class="title">{item.title}</span>
        {#if item.published}<span class="age">{relativeTime(item.published, clock.now)}</span>{/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .ticker {
    display: grid;
    min-width: 0;
    flex: 1;
  }
  .item {
    grid-area: 1 / 1;
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
    min-width: 0;
    font-size: 1.2rem;
    text-shadow: 0 0.1rem 0.8rem rgba(0, 0, 0, 0.4);
  }
  .source {
    flex: none;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
  }
  .title {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .age {
    flex: none;
    font-size: 0.95rem;
    color: var(--text-3);
  }
</style>
