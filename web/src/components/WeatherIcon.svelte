<script lang="ts">
  import { condition } from '../lib/weather';

  let { code, isDay = true, size = '1em', mono = false }: { code: number; isDay?: boolean; size?: string; mono?: boolean } = $props();
  const c = $derived(condition(code, isDay));
</script>

<span class="wi" class:mono style:color={mono ? null : c.color} aria-label={c.label}>
  <c.icon {size} strokeWidth={1.9} />
</span>

<style>
  .wi {
    display: inline-flex;
    filter: drop-shadow(0 0.1rem 0.4rem rgba(0, 0, 0, 0.25));
  }
  .wi.mono {
    filter: none;
  }
</style>
