import { publish } from '../hub.js';
import { fetchJson, startPoller } from '../poller.js';
import { getSettings, inLayout, onSettingsChange } from '../settings.js';

interface Aircraft {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  true_heading?: number;
  lat?: number;
  lon?: number;
  dst?: number;
  category?: string;
}

interface Route {
  airline: string;
  from: string;
  to: string;
}

const NM = 1.852;
// Only the nearest few get a route lookup; the rest are just dots on the map.
const ROUTE_LOOKUPS = 5;
const routes = new Map<string, { route: Route | null; at: number }>();

/** Origin/destination for a callsign from adsbdb, cached for half a day (an hour if unknown). */
async function route(callsign: string): Promise<Route | null> {
  const cached = routes.get(callsign);
  if (cached && Date.now() - cached.at < (cached.route ? 12 : 1) * 3600_000) return cached.route;
  let result: Route | null = null;
  try {
    const data = await fetchJson<{ response?: { flightroute?: any } }>(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`);
    const r = data.response?.flightroute;
    if (r?.origin && r?.destination) {
      result = { airline: r.airline?.name ?? '', from: r.origin.iata_code || r.origin.icao_code, to: r.destination.iata_code || r.destination.icao_code };
    }
  } catch {
    // adsbdb answers 404 for callsigns it doesn't know; keep the null.
  }
  routes.set(callsign, { route: result, at: Date.now() });
  if (routes.size > 2000) routes.delete(routes.keys().next().value!);
  return result;
}

export function startFlights() {
  const poller = startPoller('flights', async () => {
    const s = getSettings();
    const { latitude, longitude } = s.location;
    if (latitude === null || longitude === null || !inLayout(s, 'flights')) {
      publish('flights', { configured: false, aircraft: [] });
      return 5 * 60_000;
    }
    const nm = Math.max(1, Math.round(s.flights.radiusKm / NM));
    const data = await fetchJson<{ ac?: Aircraft[] }>(`https://api.adsb.lol/v2/point/${latitude}/${longitude}/${nm}`);
    const aircraft = (data.ac ?? [])
      .filter((a) => a.lat !== undefined && a.lon !== undefined && typeof a.alt_baro === 'number' && a.alt_baro > 100)
      .sort((a, b) => (a.dst ?? 0) - (b.dst ?? 0))
      .slice(0, 40)
      .map((a) => ({
        hex: a.hex,
        callsign: a.flight?.trim() || '',
        registration: a.r ?? '',
        type: a.t ?? '',
        lat: a.lat!,
        lon: a.lon!,
        altitudeFt: a.alt_baro as number,
        speedKt: Math.round(a.gs ?? 0),
        track: Math.round(a.track ?? a.true_heading ?? 0),
        distanceKm: Math.round((a.dst ?? 0) * NM * 10) / 10,
        route: null as Route | null,
      }));
    await Promise.all(aircraft.slice(0, ROUTE_LOOKUPS).map(async (a) => (a.route = a.callsign ? await route(a.callsign) : null)));
    publish('flights', { configured: true, radiusKm: s.flights.radiusKm, aircraft });
    return 20_000;
  });
  onSettingsChange((s) => [s.location.latitude, s.location.longitude, s.flights, inLayout(s, 'flights')], poller.refresh);
  return poller;
}
