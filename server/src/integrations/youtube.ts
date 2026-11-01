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

interface PlayerResponse {
  playabilityStatus?: { status?: string };
  videoDetails?: { videoId?: string; title?: string; isLive?: boolean; isUpcoming?: boolean };
  microformat?: { playerMicroformatRenderer?: { liveBroadcastDetails?: { isLiveNow?: boolean; endTimestamp?: string } } };
}

/** The JSON object assigned to `name` in one of the page's inline scripts. */
function embeddedJson<T>(html: string, name: string): T | null {
  const start = html.indexOf('{', html.indexOf(`${name} = `));
  if (start < 0 || html.indexOf(`${name} = `) < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1)) as T;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** The stream a channel's /live page shows, if it's on air now (not scheduled, not finished). */
export function liveVideo(html: string) {
  const player = embeddedJson<PlayerResponse>(html, 'ytInitialPlayerResponse');
  const video = player?.videoDetails;
  const broadcast = player?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails;
  // Scheduled streams are marked upcoming (and "offline"); finished ones are no longer live.
  const live =
    video?.isLive === true &&
    !video.isUpcoming &&
    player?.playabilityStatus?.status !== 'LIVE_STREAM_OFFLINE' &&
    broadcast?.isLiveNow !== false &&
    !broadcast?.endTimestamp;
  if (!live || !video.videoId) return null;
  return { videoId: video.videoId, title: video.title || meta(html, 'name', 'title') };
}

async function liveStream(channel: YouTubeChannel) {
  // A channel's /live address lands on its current stream, its next scheduled one, or the channel page.
  const html = await page(`https://www.youtube.com/channel/${channel.id}/live`);
  const video = liveVideo(html);
  if (!video) return null;
  const viewers = Number(html.match(/"originalViewCount":"(\d+)"/)?.[1] ?? NaN);
  return {
    channelId: channel.id,
    channel: channel.name,
    avatar: channel.avatar,
    ...video,
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
