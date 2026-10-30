import { publish } from '../hub.js';
import { errorMessage, log } from '../log.js';
import { fetchJson, startPoller } from '../poller.js';
import { getSettings, onSettingsChange, type SportsTeam } from '../settings.js';

export const LEAGUES: Record<string, { label: string; path: string }> = {
  nfl: { label: 'NFL', path: 'football/nfl' },
  nba: { label: 'NBA', path: 'basketball/nba' },
  mlb: { label: 'MLB', path: 'baseball/mlb' },
  nhl: { label: 'NHL', path: 'hockey/nhl' },
  wnba: { label: 'WNBA', path: 'basketball/wnba' },
  mls: { label: 'MLS', path: 'soccer/usa.1' },
  epl: { label: 'Premier League', path: 'soccer/eng.1' },
  ncaaf: { label: 'College Football', path: 'football/college-football' },
  ncaam: { label: "Men's College Basketball", path: 'basketball/mens-college-basketball' },
  ncaaw: { label: "Women's College Basketball", path: 'basketball/womens-college-basketball' },
};

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

interface Competitor {
  homeAway: 'home' | 'away';
  winner?: boolean;
  score?: string | { displayValue?: string };
  team: { id: string; abbreviation: string; displayName: string; shortDisplayName?: string; logos?: { href: string }[]; logo?: string };
}

interface EspnEvent {
  id: string;
  date: string;
  competitions: { status: { type: { state: 'pre' | 'in' | 'post'; shortDetail: string; completed: boolean } }; competitors: Competitor[] }[];
}

const score = (c: Competitor) => (typeof c.score === 'string' ? c.score : (c.score?.displayValue ?? null));

function toGame(event: EspnEvent, teamId: string) {
  const comp = event.competitions[0];
  const us = comp.competitors.find((c) => c.team.id === teamId);
  const them = comp.competitors.find((c) => c.team.id !== teamId);
  if (!us || !them) return null;
  return {
    id: event.id,
    date: event.date,
    state: comp.status.type.state,
    detail: comp.status.type.shortDetail,
    home: us.homeAway === 'home',
    us: score(us),
    them: score(them),
    won: us.winner ?? null,
    opponent: {
      abbr: them.team.abbreviation,
      name: them.team.shortDisplayName ?? them.team.displayName,
      logo: them.team.logos?.[0]?.href ?? them.team.logo ?? '',
    },
  };
}

async function teamSummary(team: SportsTeam) {
  const league = LEAGUES[team.league];
  if (!league) throw new Error(`unknown league ${team.league}`);
  const [info, schedule] = await Promise.all([
    fetchJson<{ team: { color?: string; logos?: { href: string }[]; nextEvent?: EspnEvent[]; record?: { items?: { summary: string }[] } } }>(
      `${BASE}/${league.path}/teams/${team.id}`,
    ),
    fetchJson<{ events?: EspnEvent[] }>(`${BASE}/${league.path}/teams/${team.id}/schedule`).catch(() => ({ events: [] })),
  ]);
  const upcoming = info.team.nextEvent?.[0] ? toGame(info.team.nextEvent[0], team.id) : null;
  const completed = (schedule.events ?? []).filter((e) => e.competitions[0]?.status.type.completed);
  let last = completed.length ? toGame(completed[completed.length - 1], team.id) : null;
  let next = upcoming;
  // Right after the final whistle ESPN can still list the finished game as "next".
  if (upcoming?.state === 'post') {
    last = upcoming;
    next = null;
  }
  return {
    key: `${team.league}-${team.id}`,
    league: league.label,
    name: team.name,
    abbr: team.abbr,
    logo: info.team.logos?.[0]?.href ?? team.logo,
    color: info.team.color ? `#${info.team.color}` : '#888888',
    record: info.team.record?.items?.[0]?.summary ?? '',
    live: next?.state === 'in' ? next : null,
    next: next?.state === 'pre' ? next : null,
    last,
  };
}

export async function listTeams(leagueKey: string) {
  const league = LEAGUES[leagueKey];
  if (!league) return [];
  const data = await fetchJson<{ sports: { leagues: { teams: { team: { id: string; displayName: string; abbreviation: string; logos?: { href: string }[] } }[] }[] }[] }>(
    `${BASE}/${league.path}/teams?limit=1000`,
  );
  return (data.sports[0]?.leagues[0]?.teams ?? [])
    .map(({ team }) => ({ league: leagueKey, id: team.id, name: team.displayName, abbr: team.abbreviation, logo: team.logos?.[0]?.href ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function startSports() {
  const poller = startPoller('sports', async () => {
    const teams = getSettings().sports.teams;
    const results = await Promise.allSettled(teams.map(teamSummary));
    const summaries = results.flatMap((r, i) => {
      if (r.status === 'fulfilled') return [r.value];
      log.warn(`[sports] ${teams[i].name}: ${errorMessage(r.reason)}`);
      return [];
    });
    publish('sports', { teams: summaries });
    const soon = summaries.some((t) => t.live || (t.next && Date.parse(t.next.date) - Date.now() < 15 * 60_000));
    return soon ? 30_000 : 10 * 60_000;
  });
  onSettingsChange((s) => s.sports.teams, poller.refresh);
  return poller;
}
