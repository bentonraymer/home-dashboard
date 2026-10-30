import Parser from 'rss-parser';
import { publish } from '../hub.js';
import { errorMessage, log } from '../log.js';
import { startPoller } from '../poller.js';
import { getSettings, onSettingsChange } from '../settings.js';

const parser = new Parser({ timeout: 20_000, headers: { 'User-Agent': 'Mozilla/5.0 (home-dashboard)' } });

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function clean(s: string) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export function startNews() {
  const poller = startPoller('news', async () => {
    const feeds = getSettings().news.feeds;
    const results = await Promise.allSettled(feeds.map((f) => parser.parseURL(f.url)));
    const perFeed = results.map((r, i) => {
      if (r.status === 'rejected') {
        log.warn(`[news] ${feeds[i].name}: ${errorMessage(r.reason)}`);
        return [];
      }
      const dayAgo = Date.now() - 36 * 3600_000;
      return r.value.items
        .map((item) => ({
          title: clean(item.title ?? ''),
          source: feeds[i].name,
          published: item.isoDate ? Date.parse(item.isoDate) : 0,
        }))
        .filter((item) => item.title && (!item.published || item.published > dayAgo))
        .sort((a, b) => b.published - a.published)
        .slice(0, 10);
    });
    if (feeds.length && perFeed.every((items) => !items.length) && results.every((r) => r.status === 'rejected')) {
      throw new Error('every news feed failed');
    }
    // Round-robin across sources so one busy feed doesn't drown out the rest.
    const items = [];
    const seen = new Set<string>();
    for (let i = 0; perFeed.some((f) => i < f.length); i++) {
      for (const feed of perFeed) {
        const item = feed[i];
        if (item && !seen.has(item.title.toLowerCase())) {
          seen.add(item.title.toLowerCase());
          items.push(item);
        }
      }
    }
    publish('news', { items });
    return 15 * 60_000;
  });
  onSettingsChange((s) => s.news.feeds, poller.refresh);
  return poller;
}
