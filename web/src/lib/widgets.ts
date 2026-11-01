import type { Component } from 'svelte';
import CalendarDays from '@lucide/svelte/icons/calendar-days';
import CircleCheck from '@lucide/svelte/icons/circle-check';
import Clock from '@lucide/svelte/icons/clock';
import Gauge from '@lucide/svelte/icons/gauge';
import Hourglass from '@lucide/svelte/icons/hourglass';
import Plane from '@lucide/svelte/icons/plane';
import Radar from '@lucide/svelte/icons/radar';
import Thermometer from '@lucide/svelte/icons/thermometer';
import Trophy from '@lucide/svelte/icons/trophy';
import Tv from '@lucide/svelte/icons/tv';
import Air from '../widgets/Air.svelte';
import Calendar from '../widgets/Calendar.svelte';
import Countdowns from '../widgets/Countdowns.svelte';
import Daily from '../widgets/Daily.svelte';
import Flights from '../widgets/Flights.svelte';
import Hourly from '../widgets/Hourly.svelte';
import RadarMap from '../widgets/Radar.svelte';
import Sports from '../widgets/Sports.svelte';
import Todos from '../widgets/Todos.svelte';
import YouTube from '../widgets/YouTube.svelte';
import type { DashboardState, WidgetId } from './types';

interface WidgetDef {
  title: string;
  icon: Component;
  accent: string;
  component: Component;
  /** Whether there is anything worth showing; empty views are skipped in the rotator. */
  ready: (d: DashboardState) => boolean;
  /** Lists can lose rows when a column is crowded; charts and maps keep their full height. */
  shrinks?: boolean;
}

const weatherReady = (d: DashboardState) => !!d.weather?.configured;

export const WIDGETS: Record<WidgetId, WidgetDef> = {
  calendar: { title: 'Calendar', icon: CalendarDays, accent: '#ff453a', component: Calendar, ready: (d) => !!d.calendar, shrinks: true },
  todos: { title: 'To Do', icon: CircleCheck, accent: '#0a84ff', component: Todos, ready: (d) => !!d.todos, shrinks: true },
  hourly: { title: 'Hourly Forecast', icon: Clock, accent: '#64d2ff', component: Hourly, ready: weatherReady },
  daily: { title: '6-Day Forecast', icon: Thermometer, accent: '#ff9f0a', component: Daily, ready: weatherReady },
  air: { title: 'Conditions', icon: Gauge, accent: '#30d158', component: Air, ready: weatherReady },
  countdowns: { title: 'Countdowns', icon: Hourglass, accent: '#bf5af2', component: Countdowns, ready: (d) => !!d.settings?.countdowns.length, shrinks: true },
  radar: { title: 'Radar', icon: Radar, accent: '#5ac8fa', component: RadarMap, ready: (d) => !!d.radar?.active },
  flights: { title: 'Overhead', icon: Plane, accent: '#ff9f0a', component: Flights, ready: (d) => !!d.flights?.aircraft.length },
  youtube: { title: 'Live on YouTube', icon: Tv, accent: '#ff3b30', component: YouTube, ready: (d) => !!d.youtube?.live.length, shrinks: true },
  sports: { title: 'Scores', icon: Trophy, accent: '#ffd60a', component: Sports, ready: (d) => !!d.sports?.teams.length, shrinks: true },
};
