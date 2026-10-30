<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  let {
    title,
    icon: Icon,
    accent = 'var(--text-2)',
    aside,
    children,
  }: { title?: string; icon?: Component; accent?: string; aside?: Snippet; children: Snippet } = $props();
</script>

<section class="card glass">
  {#if title}
    <header>
      {#if Icon}<span class="icon" style:color={accent}><Icon size="1.05em" strokeWidth={2.25} /></span>{/if}
      <h2>{title}</h2>
      {#if aside}<span class="aside">{@render aside()}</span>{/if}
    </header>
  {/if}
  <div class="body">{@render children()}</div>
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 1.15rem 1.35rem 1.25rem;
    border-radius: var(--radius);
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin-bottom: 0.8rem;
    color: var(--text-2);
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .icon {
    display: inline-flex;
  }
  h2 {
    margin: 0;
    font: inherit;
  }
  .aside {
    margin-left: auto;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
  }
  .body {
    min-height: 0;
    overflow: hidden;
    flex: 1 1 auto;
  }
</style>
