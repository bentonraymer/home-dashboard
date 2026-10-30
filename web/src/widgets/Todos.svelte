<script lang="ts">
  import { clock, dash } from '../lib/store.svelte';
  import { dayLabel, daysBetween, formatTime, localDate } from '../lib/format';
  import type { Task } from '../lib/types';

  const PRIORITY: Record<number, string> = { 4: 'var(--red)', 3: 'var(--orange)', 2: 'var(--blue)' };
  const minute = $derived(Math.floor(clock.now / 60_000) * 60_000);
  const use24h = $derived(dash.settings?.clock.use24h ?? false);
  const tasks = $derived((dash.todos?.tasks ?? []).slice(0, dash.settings?.todos.maxTasks ?? 8));

  function due(t: Task) {
    if (!t.due) return { text: '', overdue: false };
    const date = localDate(t.due);
    const diff = daysBetween(new Date(minute), date);
    const time = t.hasTime ? formatTime(Date.parse(t.due), use24h) : '';
    if (diff < 0) return { text: `Overdue · ${dayLabel(date, minute, false)}`, overdue: true };
    if (diff === 0) return { text: time, overdue: t.hasTime && Date.parse(t.due) < minute };
    return { text: [dayLabel(date, minute, false), time].filter(Boolean).join(' · '), overdue: false };
  }
</script>

{#if dash.todos && !dash.todos.configured}
  <p class="empty">Add TODOIST_TOKEN to your .env to show tasks.</p>
{:else if !tasks.length}
  <p class="empty">All clear for today.</p>
{:else}
  <div class="list fade-bottom">
    {#each tasks as t (t.id)}
      {@const d = due(t)}
      <div class="task">
        <span class="check" style:border-color={PRIORITY[t.priority] ?? 'rgba(255,255,255,0.45)'}></span>
        <div class="main">
          <div class="content">{t.content}</div>
          {#if d.text || t.project}
            <div class="sub">
              {#if d.text}<span class:overdue={d.overdue}>{d.text}</span>{/if}
              {#if t.project}<span class="project"><i style:background={t.project.color}></i>{t.project.name}</span>{/if}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .task {
    display: flex;
    gap: 0.8rem;
    padding: 0.45rem 0;
    align-items: flex-start;
  }
  .check {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    border: 0.14rem solid;
    flex: none;
    margin-top: 0.12rem;
  }
  .main {
    min-width: 0;
  }
  .content {
    font-size: 1.2rem;
    font-weight: 500;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .sub {
    display: flex;
    gap: 0.8rem;
    font-size: 0.95rem;
    color: var(--text-2);
    margin-top: 0.1rem;
  }
  .overdue {
    color: var(--red);
    font-weight: 600;
  }
  .project {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .project i {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }
</style>
