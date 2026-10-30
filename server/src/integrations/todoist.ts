import { config } from '../config.js';
import { publish } from '../hub.js';
import { fetchJson, startPoller } from '../poller.js';
import { getSettings, onSettingsChange } from '../settings.js';

const API = 'https://api.todoist.com/api/v1';

// Todoist names its project colors; these are the hex values its apps use.
const COLORS: Record<string, string> = {
  berry_red: '#b8256f', red: '#db4035', orange: '#ff9933', yellow: '#fad000', olive_green: '#afb83b',
  lime_green: '#7ecc49', green: '#299438', mint_green: '#6accbc', teal: '#158fad', sky_blue: '#14aaf5',
  light_blue: '#96c3eb', blue: '#4073ff', grape: '#884dff', violet: '#af38eb', lavender: '#eb96eb',
  magenta: '#e05194', salmon: '#ff8d85', charcoal: '#808080', grey: '#b8b8b8', taupe: '#ccac93',
};

interface Paged<T> {
  results: T[];
  next_cursor: string | null;
}

interface RawTask {
  id: string;
  content: string;
  priority: number;
  project_id: string;
  child_order?: number;
  due?: { date: string; datetime?: string | null; is_recurring?: boolean; string?: string } | null;
}

interface RawProject {
  id: string;
  name: string;
  color: string;
}

async function getAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries({ ...params, limit: '200' })) url.searchParams.set(k, v);
    if (cursor) url.searchParams.set('cursor', cursor);
    const page: Paged<T> = await fetchJson(url.toString(), { headers: { Authorization: `Bearer ${config.todoistToken}` } });
    out.push(...page.results);
    cursor = page.next_cursor;
  } while (cursor && out.length < 1000);
  return out;
}

// Markdown links like [label](https://…) become just the label.
const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '');

let projects = new Map<string, RawProject>();
let projectsFetched = 0;

export function startTodoist() {
  const poller = startPoller('todoist', async () => {
    if (!config.todoistToken) {
      publish('todos', { configured: false, tasks: [] });
      return 60 * 60_000;
    }
    if (Date.now() - projectsFetched > 60 * 60_000) {
      projects = new Map((await getAll<RawProject>('/projects')).map((p) => [p.id, p]));
      projectsFetched = Date.now();
    }
    const raw = await getAll<RawTask>('/tasks/filter', { query: getSettings().todos.filter || 'today | overdue' });
    const tasks = raw.map((t) => {
      const project = projects.get(t.project_id);
      const due = t.due ? (t.due.datetime ?? t.due.date) : null;
      return {
        id: t.id,
        content: plain(t.content),
        priority: t.priority,
        due,
        hasTime: !!due && due.length > 10,
        recurring: !!t.due?.is_recurring,
        project: project && project.name !== 'Inbox' ? { name: project.name, color: COLORS[project.color] ?? '#808080' } : null,
        order: t.child_order ?? 0,
      };
    });
    tasks.sort(
      (a, b) =>
        (a.due ?? '9999').slice(0, 10).localeCompare((b.due ?? '9999').slice(0, 10)) ||
        b.priority - a.priority ||
        (a.due ?? '').localeCompare(b.due ?? '') ||
        a.order - b.order,
    );
    publish('todos', { configured: true, tasks });
    return 2 * 60_000;
  });
  onSettingsChange((s) => s.todos.filter, poller.refresh);
  return poller;
}
