import { publish } from '../hub.js';
import { errorMessage, log } from '../log.js';
import { startPoller } from '../poller.js';
import { getSettings, inLayout, onSettingsChange, type YouTubeChannel } from '../settings.js';

// YouTube's own pages tell us who is live without an API key. The SOCS cookie skips the EU consent page.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Cookie: 'SOCS=CAI',
};

async function page(url: string) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`YouTube responded ${res.status}`);
  return res.text();
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const meta = (html: string, attr: string, name: string) =>
  decode(html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1] ?? '');

/** Turn a handle, channel URL or channel id into the channel's id, name and avatar. */
export async function resolveChannel(input: string): Promise<YouTubeChannel> {
  const q = input.trim();
  let url: string;
  if (/^UC[\w-]{22}$/.test(q)) url = `https://www.youtube.com/channel/${q}`;
  else if (/^https?:\/\/(www\.|m\.)?youtube\.com\//.test(q)) url = q.replace(/\/(live|videos|featured|streams)\/?$/, '');
  else url = `https://www.youtube.com/@${encodeURIComponent(q.replace(/^@/, ''))}`;
  const html = await page(url);
  const id = html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] ?? html.match(/<meta itemprop="identifier" content="(UC[\w-]{22})"/)?.[1];
  if (!id) throw new Error('Channel not found');
  const handle = html.match(/"vanityChannelUrl":"https?:\/\/www\.youtube\.com\/(@[^"]+)"/)?.[1] ?? '';
  return { id, name: meta(html, 'property', 'og:title') || handle || id, handle: decodeURIComponent(handle), avatar: meta(html, 'property', 'og:image').replace(/=s\d+-/, '=s88-') };
}

async function liveStream(channel: YouTubeChannel) {
  // A channel's /live address lands on its current stream, or on the channel page when it isn't live.
  const html = await page(`https://www.youtube.com/channel/${channel.id}/live`);
  const videoId = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1];
  // Depending on the page variant, a stream in progress is marked one of these two ways; scheduled
  // streams and replays carry neither.
  if (!videoId || !/"isLiveNow":true|"isLive":true/.test(html)) return null;
  const viewers = Number(html.match(/"originalViewCount":"(\d+)"/)?.[1] ?? NaN);
  return {
    channelId: channel.id,
    channel: channel.name,
    avatar: channel.avatar,
    videoId,
    title: meta(html, 'name', 'title'),
    viewers: Number.isFinite(viewers) ? viewers : null,
  };
}

export function startYouTube() {
  const poller = startPoller('youtube', async () => {
    const s = getSettings();
    const channels = s.youtube.channels;
    if (!channels.length || !inLayout(s, 'youtube')) {
      publish('youtube', { live: [] });
      return 10 * 60_000;
    }
    const results = await Promise.allSettled(channels.map(liveStream));
    const live = results.flatMap((r, i) => {
      if (r.status === 'rejected') log.warn(`[youtube] ${channels[i].name}: ${errorMessage(r.reason)}`);
      return r.status === 'fulfilled' && r.value ? [r.value] : [];
    });
    if (results.every((r) => r.status === 'rejected')) throw new Error('could not reach YouTube');
    publish('youtube', { live });
    return 3 * 60_000;
  });
  onSettingsChange((s) => [s.youtube.channels.map((c) => c.id), inLayout(s, 'youtube')], poller.refresh);
  return poller;
}
