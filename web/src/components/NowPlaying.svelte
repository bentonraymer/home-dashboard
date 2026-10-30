<script lang="ts">
  import { fly } from 'svelte/transition';
  import { clock, dash } from '../lib/store.svelte';

  const np = $derived(dash.nowPlaying);
  const progress = $derived(np ? Math.min(1, (np.progressMs + (clock.now - np.receivedAt)) / np.durationMs) : 0);
</script>

{#if np}
  <div class="np glass" transition:fly={{ y: 24, duration: 600 }}>
    {#if np.art}<img class="art" src={np.art} alt="" />{/if}
    <div class="info">
      <div class="label">
        <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
        Now Playing
      </div>
      <div class="title">{np.title}</div>
      <div class="artist">{np.artist}</div>
      <div class="track"><div class="fill" style:transform={`scaleX(${progress})`}></div></div>
    </div>
  </div>
{/if}

<style>
  .np {
    display: flex;
    align-items: center;
    gap: 1.1rem;
    padding: 0.9rem 1.3rem 0.9rem 0.9rem;
    border-radius: var(--radius);
    max-width: 34rem;
  }
  .art {
    width: 5.2rem;
    height: 5.2rem;
    border-radius: 0.8rem;
    object-fit: cover;
    box-shadow: 0 0.4rem 1.2rem rgba(0, 0, 0, 0.35);
    flex: none;
  }
  .info {
    min-width: 0;
    flex: 1;
  }
  .label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--green);
  }
  .title,
  .artist {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title {
    margin-top: 0.3rem;
    font-size: 1.3rem;
    font-weight: 600;
  }
  .artist {
    font-size: 1.05rem;
    color: var(--text-2);
  }
  .track {
    margin-top: 0.6rem;
    height: 0.25rem;
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.18);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: rgba(255, 255, 255, 0.85);
    transform-origin: left;
    transition: transform 1s linear;
  }
  .bars {
    display: inline-flex;
    align-items: flex-end;
    gap: 0.12rem;
    height: 0.75rem;
  }
  .bars i {
    width: 0.16rem;
    height: 100%;
    background: currentColor;
    border-radius: 0.1rem;
    animation: eq 1.1s ease-in-out infinite;
    transform-origin: bottom;
  }
  .bars i:nth-child(2) {
    animation-delay: -0.4s;
  }
  .bars i:nth-child(3) {
    animation-delay: -0.75s;
  }
  @keyframes eq {
    0%,
    100% {
      transform: scaleY(0.3);
    }
    50% {
      transform: scaleY(1);
    }
  }
  :global(.low-power) .bars i {
    animation: none;
  }
</style>
