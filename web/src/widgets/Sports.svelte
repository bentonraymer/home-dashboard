<script lang="ts">
  import { clock, dash } from '../lib/store.svelte';
  import { dayLabel, formatTime } from '../lib/format';
  import type { Game } from '../lib/types';

  const use24h = $derived(dash.settings?.clock.use24h ?? false);
  const teams = $derived(dash.sports?.teams ?? []);
  const vs = (g: Game) => `${g.home ? 'vs' : '@'} ${g.opponent.abbr}`;
  const when = (g: Game) => {
    const t = Date.parse(g.date);
    return `${dayLabel(new Date(t), clock.now, false)} ${formatTime(t, use24h)}`;
  };
  // Only show results from the last few days; older ones are just noise.
  const recent = (g: Game | null) => g && clock.now - Date.parse(g.date) < 4 * 86_400_000;
</script>

<div class="list">
  {#each teams as t (t.key)}
    <div class="team">
      {#if t.logo}<img src={t.logo} alt="" />{/if}
      <div class="main">
        <div class="name">{t.abbr} <span class="record">{t.record}</span></div>
        {#if t.live}
          <div class="line live num">
            <span class="dot"></span>{t.live.us}–{t.live.them} {vs(t.live)} · {t.live.detail}
          </div>
        {:else}
          {#if t.next}<div class="line">{vs(t.next)} · {when(t.next)}</div>{/if}
          {#if recent(t.last) && t.last}
            <div class="line muted num">
              <b class:win={t.last.won} class:loss={t.last.won === false}>{t.last.won ? 'W' : t.last.won === false ? 'L' : 'T'}</b>
              {t.last.us}–{t.last.them} {vs(t.last)}
            </div>
          {/if}
          {#if !t.next && !recent(t.last)}<div class="line muted">No upcoming games</div>{/if}
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .team {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.4rem 0;
  }
  img {
    width: 2.6rem;
    height: 2.6rem;
    object-fit: contain;
    flex: none;
  }
  .name {
    font-size: 1.15rem;
    font-weight: 700;
  }
  .record {
    font-weight: 500;
    color: var(--text-3);
    font-size: 0.95rem;
    margin-left: 0.3rem;
  }
  .line {
    font-size: 1.05rem;
  }
  .muted {
    color: var(--text-2);
  }
  .live {
    color: var(--text);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--red);
    animation: pulse 1.6s ease-in-out infinite;
  }
  .win {
    color: var(--green);
  }
  .loss {
    color: var(--red);
  }
  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }
</style>
