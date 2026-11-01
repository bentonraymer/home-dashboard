<script lang="ts">
  import { clock, dash } from '../lib/store.svelte';

  const live = $derived((dash.youtube?.live ?? []).slice(0, 4));
  // Live thumbnails change as the stream goes on; refresh them every few minutes.
  const bust = $derived(Math.floor(clock.now / 300_000));

  const watching = (n: number | null) => {
    if (n === null) return '';
    const short = n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n);
    return `${short.replace('.0', '')} watching`;
  };
</script>

<ul>
  {#each live as l (l.videoId)}
    <li>
      <div class="thumb">
        <img src={`https://i.ytimg.com/vi/${l.videoId}/mqdefault_live.jpg?t=${bust}`} alt="" />
        <span class="badge">LIVE</span>
      </div>
      <div class="info">
        <div class="channel">
          {#if l.avatar}<img class="avatar" src={l.avatar} alt="" />{/if}
          <span>{l.channel}</span>
        </div>
        <div class="title">{l.title}</div>
        {#if l.viewers !== null}<div class="viewers num">{watching(l.viewers)}</div>{/if}
      </div>
    </li>
  {/each}
</ul>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  li {
    display: flex;
    gap: 0.9rem;
    align-items: center;
  }
  .thumb {
    position: relative;
    flex: none;
    width: 9.5rem;
    aspect-ratio: 16 / 9;
    border-radius: 0.6rem;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.08);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .badge {
    position: absolute;
    left: 0.35rem;
    bottom: 0.35rem;
    padding: 0.05rem 0.35rem;
    border-radius: 0.25rem;
    background: #ff0033;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .info {
    min-width: 0;
  }
  .channel {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 1.05rem;
    font-weight: 600;
  }
  .channel span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .avatar {
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    flex: none;
  }
  .title {
    margin-top: 0.2rem;
    font-size: 0.95rem;
    color: var(--text-2);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .viewers {
    margin-top: 0.2rem;
    font-size: 0.85rem;
    color: var(--text-3);
  }
</style>
