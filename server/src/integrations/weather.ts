import { createRequire } from 'node:module';
import type * as SunCalcTypes from 'suncalc';
import { publish } from '../hub.js';
import { fetchJson, startPoller } from '../poller.js';
import { getSettings, onSettingsChange } from '../settings.js';

// suncalc is a UMD bundle with no ESM entry, so load it the CommonJS way.
const SunCalc: typeof SunCalcTypes = createRequire(import.meta.url)('suncalc');

interface Forecast {
  utc_offset_seconds: number;
  timezone: string;
  current: Record<string, number | string>;
  hourly: Record<string, (number | string)[]>;
  daily: Record<string, (number | string)[]>;
}

interface Air {
  current: Record<string, number | null>;
}

const MOON_PHASES = [
  'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
  'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
];

function moon(date = new Date()) {
  const { phase, fraction } = SunCalc.getMoonIllumination(date);
  return { phase, illumination: fraction, name: MOON_PHASES[Math.round(phase * 8) % 8] };
}

export function startWeather() {
  const poller = startPoller('weather', async () => {
    const { location, units } = getSettings();
    if (location.latitude === null || location.longitude === null) {
      publish('weather', { configured: false });
      return 60 * 60_000;
    }
    const imperial = units === 'imperial';
    const q = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      timezone: 'auto',
      forecast_days: '8',
      temperature_unit: imperial ? 'fahrenheit' : 'celsius',
      wind_speed_unit: imperial ? 'mph' : 'kmh',
      precipitation_unit: imperial ? 'inch' : 'mm',
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,uv_index',
      hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max',
    });
    const airQ = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'us_aqi,pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen',
    });
    const [f, air] = await Promise.all([
      fetchJson<Forecast>(`https://api.open-meteo.com/v1/forecast?${q}`),
      fetchJson<Air>(`https://air-quality-api.open-meteo.com/v1/air-quality?${airQ}`).catch(() => null),
    ]);

    // Open-Meteo returns wall-clock times for the location; turn them into epoch ms.
    const epoch = (t: number | string) => Date.parse(`${t}Z`) - f.utc_offset_seconds * 1000;
    const hourStart = Date.now() - 3600_000;
    const hourly = f.hourly.time
      .map((t, i) => ({
        time: epoch(t),
        temp: f.hourly.temperature_2m[i] as number,
        code: f.hourly.weather_code[i] as number,
        pop: f.hourly.precipitation_probability[i] as number,
        isDay: f.hourly.is_day[i] === 1,
      }))
      .filter((h) => h.time > hourStart)
      .slice(0, 24);
    const daily = f.daily.time.map((d, i) => ({
      date: d as string,
      code: f.daily.weather_code[i] as number,
      hi: f.daily.temperature_2m_max[i] as number,
      lo: f.daily.temperature_2m_min[i] as number,
      pop: f.daily.precipitation_probability_max[i] as number,
      uv: f.daily.uv_index_max[i] as number,
      sunrise: epoch(f.daily.sunrise[i]),
      sunset: epoch(f.daily.sunset[i]),
    }));
    const pollenKeys = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'];
    const pollen = air
      ? pollenKeys
          .map((k) => ({ name: k, value: air.current[`${k}_pollen`] }))
          .filter((p): p is { name: string; value: number } => typeof p.value === 'number')
      : [];

    publish('weather', {
      configured: true,
      location: location.name,
      units,
      current: {
        temp: f.current.temperature_2m,
        feelsLike: f.current.apparent_temperature,
        humidity: f.current.relative_humidity_2m,
        code: f.current.weather_code,
        isDay: f.current.is_day === 1,
        wind: f.current.wind_speed_10m,
        uv: f.current.uv_index,
      },
      hourly,
      daily,
      air: air ? { aqi: air.current.us_aqi, pm25: air.current.pm2_5, pollen } : null,
      moon: moon(),
      updatedAt: Date.now(),
    });
    return 10 * 60_000;
  });
  onSettingsChange((s) => [s.location, s.units], poller.refresh);
  return poller;
}
