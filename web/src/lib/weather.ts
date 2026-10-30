import type { Component } from 'svelte';
import Cloud from '@lucide/svelte/icons/cloud';
import CloudDrizzle from '@lucide/svelte/icons/cloud-drizzle';
import CloudFog from '@lucide/svelte/icons/cloud-fog';
import CloudHail from '@lucide/svelte/icons/cloud-hail';
import CloudLightning from '@lucide/svelte/icons/cloud-lightning';
import CloudMoon from '@lucide/svelte/icons/cloud-moon';
import CloudMoonRain from '@lucide/svelte/icons/cloud-moon-rain';
import CloudRain from '@lucide/svelte/icons/cloud-rain';
import CloudSnow from '@lucide/svelte/icons/cloud-snow';
import CloudSun from '@lucide/svelte/icons/cloud-sun';
import CloudSunRain from '@lucide/svelte/icons/cloud-sun-rain';
import Moon from '@lucide/svelte/icons/moon';
import Snowflake from '@lucide/svelte/icons/snowflake';
import Sun from '@lucide/svelte/icons/sun';

interface Condition {
  label: string;
  icon: Component;
  nightIcon?: Component;
  color: string;
}

const SUN = '#ffd60a';
const CLOUD = '#f2f2f7';
const RAIN = '#64d2ff';

// WMO weather interpretation codes, as returned by Open-Meteo.
const CODES: Record<number, Condition> = {
  0: { label: 'Clear', icon: Sun, nightIcon: Moon, color: SUN },
  1: { label: 'Mostly Clear', icon: Sun, nightIcon: Moon, color: SUN },
  2: { label: 'Partly Cloudy', icon: CloudSun, nightIcon: CloudMoon, color: CLOUD },
  3: { label: 'Cloudy', icon: Cloud, color: CLOUD },
  45: { label: 'Fog', icon: CloudFog, color: CLOUD },
  48: { label: 'Freezing Fog', icon: CloudFog, color: CLOUD },
  51: { label: 'Light Drizzle', icon: CloudDrizzle, color: RAIN },
  53: { label: 'Drizzle', icon: CloudDrizzle, color: RAIN },
  55: { label: 'Heavy Drizzle', icon: CloudDrizzle, color: RAIN },
  56: { label: 'Freezing Drizzle', icon: CloudDrizzle, color: RAIN },
  57: { label: 'Freezing Drizzle', icon: CloudDrizzle, color: RAIN },
  61: { label: 'Light Rain', icon: CloudRain, color: RAIN },
  63: { label: 'Rain', icon: CloudRain, color: RAIN },
  65: { label: 'Heavy Rain', icon: CloudRain, color: RAIN },
  66: { label: 'Freezing Rain', icon: CloudHail, color: RAIN },
  67: { label: 'Freezing Rain', icon: CloudHail, color: RAIN },
  71: { label: 'Light Snow', icon: CloudSnow, color: CLOUD },
  73: { label: 'Snow', icon: CloudSnow, color: CLOUD },
  75: { label: 'Heavy Snow', icon: Snowflake, color: CLOUD },
  77: { label: 'Snow Grains', icon: CloudSnow, color: CLOUD },
  80: { label: 'Showers', icon: CloudSunRain, nightIcon: CloudMoonRain, color: RAIN },
  81: { label: 'Showers', icon: CloudRain, color: RAIN },
  82: { label: 'Heavy Showers', icon: CloudRain, color: RAIN },
  85: { label: 'Snow Showers', icon: CloudSnow, color: CLOUD },
  86: { label: 'Snow Showers', icon: CloudSnow, color: CLOUD },
  95: { label: 'Thunderstorms', icon: CloudLightning, color: SUN },
  96: { label: 'Thunderstorms', icon: CloudLightning, color: SUN },
  99: { label: 'Severe Storms', icon: CloudLightning, color: SUN },
};

export function condition(code: number, isDay = true) {
  const c = CODES[code] ?? CODES[3];
  const icon = !isDay && c.nightIcon ? c.nightIcon : c.icon;
  const color = !isDay && c.color === SUN && c.nightIcon ? '#e5e5ea' : c.color;
  return { label: c.label, icon, color };
}

export function aqiCategory(aqi: number) {
  if (aqi <= 50) return { label: 'Good', color: '#30d158' };
  if (aqi <= 100) return { label: 'Moderate', color: '#ffd60a' };
  if (aqi <= 150) return { label: 'Unhealthy for Some', color: '#ff9f0a' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ff453a' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#bf5af2' };
  return { label: 'Hazardous', color: '#a2384b' };
}

export function uvCategory(uv: number) {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very High';
  return 'Extreme';
}

/** Color for a temperature on the Apple-Weather-style range bars. */
export function tempColor(temp: number, units: 'imperial' | 'metric') {
  const f = units === 'metric' ? temp * 1.8 + 32 : temp;
  const stops: [number, string][] = [
    [10, '#5e5ce6'], [32, '#64d2ff'], [50, '#30d158'], [65, '#ffd60a'], [80, '#ff9f0a'], [95, '#ff453a'],
  ];
  for (const [limit, color] of stops) if (f <= limit) return color;
  return stops[stops.length - 1][1];
}
