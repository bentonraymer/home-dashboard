<script lang="ts">
  let { value = $bindable() }: { value: string } = $props();

  const PRESETS = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ac8e68'];
  let open = $state(false);
  let root: HTMLDivElement;
  let draft = $state(value);
  $effect(() => {
    draft = value;
  });

  // Accept "#abc", "abc", "#aabbcc" or "aabbcc" and store the 6-digit form.
  function commit() {
    let hex = draft.trim().replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{3}$/.test(hex)) hex = hex.replace(/./g, (c) => c + c);
    if (/^[0-9a-f]{6}$/.test(hex)) value = `#${hex}`;
    else draft = value;
  }
</script>

<svelte:window onpointerdown={(e) => open && !root.contains(e.target as Node) && (commit(), (open = false))} />

<div class="picker" bind:this={root}>
  <button type="button" class="swatch" style:background={value} onclick={() => (open = !open)} aria-label="Choose color" aria-expanded={open}></button>
  {#if open}
    <div class="pop">
      <div class="presets">
        {#each PRESETS as c (c)}
          <button type="button" class="dot" class:on={c === value} style:background={c} aria-label={c} onclick={() => ((value = c), (open = false))}></button>
        {/each}
      </div>
      <div class="custom">
        <label class="wheel" title="Pick any color">
          <input type="color" bind:value />
        </label>
        <input
          class="hex"
          bind:value={draft}
          onblur={commit}
          onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), commit(), (open = false))}
          spellcheck="false"
          maxlength="7"
          aria-label="Hex color"
        />
        <button type="button" class="done" onclick={() => (commit(), (open = false))}>Done</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
    flex: none;
  }
  .swatch {
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.85);
    cursor: pointer;
    padding: 0;
  }
  .pop {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    z-index: 5;
    width: 15.5rem;
    padding: 0.8rem;
    border-radius: 0.9rem;
    background: rgba(44, 44, 50, 0.97);
    border: 1px solid var(--hairline);
    box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.5);
  }
  .presets {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
    justify-items: center;
  }
  .dot {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .dot.on {
    border-color: #fff;
  }
  .custom {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.8rem;
  }
  .wheel {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    flex: none;
    cursor: pointer;
    background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
    position: relative;
    overflow: hidden;
  }
  .wheel input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .hex {
    flex: 1;
    min-width: 0;
    background: rgba(118, 118, 128, 0.24);
    border: 1px solid transparent;
    border-radius: 0.5rem;
    padding: 0.35rem 0.55rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9rem;
    outline: none;
  }
  .hex:focus {
    border-color: var(--blue);
  }
  .done {
    border: 0;
    border-radius: 0.5rem;
    padding: 0.35rem 0.7rem;
    background: var(--blue);
    color: #fff;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
  }
</style>
