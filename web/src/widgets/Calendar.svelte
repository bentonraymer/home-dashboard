<script lang="ts">
  import { clock, dash } from '../lib/store.svelte';
  import { dayLabel, formatTime, localDate, startOfDay } from '../lib/format';
  import type { CalendarEvent } from '../lib/types';

  const minute = $derived(Math.floor(clock.now / 60_000) * 60_000);
  const use24h = $derived(dash.settings?.clock.use24h ?? false);
  const max = $derived(dash.settings?.calendar.maxEvents ?? 10);

  const range = (e: CalendarEvent) =>
    e.allDay
      ? { start: localDate(e.start).getTime(), end: localDate(e.end).getTime() }
      : { start: Date.parse(e.start), end: Date.parse(e.end) };

  const groups = $derived.by(() => {
    const today = startOfDay(minute).getTime();
    const out: { label: string; events: (CalendarEvent & { status: string })[] }[] = [];
    const upcoming = (dash.calendar?.events ?? []).filter((e) => range(e).end > (e.allDay ? today : minute)).slice(0, max);
    for (const e of upcoming) {
      const { start, end } = range(e);
      const day = Math.max(startOfDay(start).getTime(), today);
      const label = dayLabel(new Date(day), minute);
      let status = '';
      if (!e.allDay && start <= minute && end > minute) status = 'Now';
      else if (!e.allDay && start > minute && start - minute <= 60 * 60_000) status = `in ${Math.round((start - minute) / 60_000)} min`;
      let group = out[out.length - 1];
      if (group?.label !== label) out.push((group = { label, events: [] }));
      group.events.push({ ...e, status });
    }
    return out;
  });
</script>

{#if dash.calendar && !dash.calendar.configured}
  <p class="empty">Add CALENDAR_URLS to your .env to show events.</p>
{:else if !groups.length}
  <p class="empty">Nothing on the calendar. Enjoy the quiet.</p>
{:else}
  <div class="list fade-bottom">
    {#each groups as group (group.label)}
      <div class="day">{group.label}</div>
      {#each group.events as e (e.id)}
        <div class="event" class:now={e.status === 'Now'}>
          <span class="bar" style:background={e.color}></span>
          <div class="main">
            <div class="title">{e.title}</div>
            {#if e.location || e.status}
              <div class="sub">
                {#if e.status}<span class="status">{e.status}</span>{/if}
                {#if e.location}<span class="loc">{e.location}</span>{/if}
              </div>
            {/if}
          </div>
          <div class="when num">
            {#if e.allDay}
              <span>All day</span>
            {:else}
              <span>{formatTime(Date.parse(e.start), use24h)}</span>
              <span class="end">{formatTime(Date.parse(e.end), use24h)}</span>
            {/if}
          </div>
        </div>
      {/each}
    {/each}
  </div>
{/if}

<style>
  .day {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0.9rem 0 0.45rem;
  }
  .day:first-child {
    margin-top: 0;
  }
  .event {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.45rem 0;
  }
  .bar {
    width: 0.26rem;
    align-self: stretch;
    border-radius: 1rem;
    flex: none;
  }
  .main {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: 1.2rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    display: flex;
    gap: 0.5rem;
    font-size: 0.95rem;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
  }
  .loc {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status {
    color: var(--orange);
    font-weight: 600;
  }
  .now .status {
    color: var(--green);
  }
  .when {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: 1rem;
    font-weight: 500;
    flex: none;
  }
  .end {
    color: var(--text-3);
    font-size: 0.9rem;
  }
</style>
