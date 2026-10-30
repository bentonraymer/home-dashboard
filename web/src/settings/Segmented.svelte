<script lang="ts" generics="T extends string">
  let { value = $bindable(), options }: { value: T; options: { value: T; label: string }[] } = $props();
</script>

<div class="seg" role="radiogroup">
  {#each options as o (o.value)}
    <button type="button" role="radio" aria-checked={value === o.value} class:on={value === o.value} onclick={() => (value = o.value)}>
      {o.label}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    padding: 0.15rem;
    border-radius: 0.6rem;
    background: rgba(118, 118, 128, 0.24);
    flex: none;
  }
  button {
    border: 0;
    background: transparent;
    padding: 0.3rem 0.8rem;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    color: var(--text-2);
  }
  button.on {
    background: rgba(255, 255, 255, 0.2);
    color: var(--text);
    box-shadow: 0 0.1rem 0.3rem rgba(0, 0, 0, 0.25);
  }
</style>
