<script lang="ts">
  import { clock, dash } from '../lib/store.svelte';
  import { daysBetween, localDate } from '../lib/format';

  const items = $derived.by(() => {
    const today = new Date(Math.floor(clock.now / 60_000) * 60_000);
    return (dash.settings?.countdowns ?? [])
      .map((c) => {
        let date = localDate(c.date);
        if (c.yearly) {
          date.setFullYear(today.getFullYear());
          if (daysBetween(today, date) < 0) date.setFullYear(today.getFullYear() + 1);
        }
        return { ...c, date, days: daysBetween(today, date) };
      })
      .filter((c) => c.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5);
  });
</script>

<div class="list">
  {#each items as c (c.id)}
    <div class="item">
      <span class="days num">{c.days === 0 ? '🎉' : c.days}</span>
      <div class="main">
        <div class="name">{c.emoji ? `${c.emoji} ` : ''}{c.name}</div>
        <div class="sub">
          {c.days === 0 ? 'Today!' : c.days === 1 ? 'Tomorrow' : `days · ${c.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`}
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.35rem 0;
  }
  .days {
    min-width: 3.6rem;
    font-size: 2.2rem;
    font-weight: 300;
    text-align: right;
  }
  .name {
    font-size: 1.2rem;
    font-weight: 600;
  }
  .sub {
    font-size: 0.95rem;
    color: var(--text-2);
  }
</style>
