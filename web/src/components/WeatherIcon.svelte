<script lang="ts">
  import { condition } from '../lib/weather';

  let { code, isDay = true, size = '1em' }: { code: number; isDay?: boolean; size?: string } = $props();
  const c = $derived(condition(code, isDay));
</script>

<span class="wi" style:color={c.color} aria-label={c.label}>
  <c.icon {size} strokeWidth={1.9} />
</span>

<style>
  .wi {
    display: inline-flex;
    filter: drop-shadow(0 0.1rem 0.4rem rgba(0, 0, 0, 0.25));
  }
</style>
