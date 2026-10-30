<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, hint, children }: { title: string; hint?: string; children: Snippet } = $props();
</script>

<section>
  <h2>{title}</h2>
  <div class="box">{@render children()}</div>
  {#if hint}<p class="hint">{hint}</p>{/if}
</section>

<style>
  section {
    margin-bottom: 2rem;
  }
  h2 {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
    margin: 0 0 0.5rem 1rem;
  }
  .box {
    background: rgba(28, 28, 32, 0.72);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid var(--hairline);
    border-radius: 1rem;
    padding: 0.5rem 1rem;
  }
  .box :global(> * + *) {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .hint {
    font-size: 0.8rem;
    color: var(--text-3);
    margin: 0.5rem 1rem 0;
    line-height: 1.45;
  }
</style>
