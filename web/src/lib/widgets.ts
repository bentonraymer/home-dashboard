import type { Component } from 'svelte';
import CalendarDays from '@lucide/svelte/icons/calendar-days';
import CircleCheck from '@lucide/svelte/icons/circle-check';
import Clock from '@lucide/svelte/icons/clock';
import Gauge from '@lucide/svelte/icons/gauge';
import Hourglass from '@lucide/svelte/icons/hourglass';
import Thermometer from '@lucide/svelte/icons/thermometer';
import Trophy from '@lucide/svelte/icons/trophy';
import Air from '../widgets/Air.svelte';
import Calendar from '../widgets/Calendar.svelte';
import Countdowns from '../widgets/Countdowns.svelte';
import Daily from '../widgets/Daily.svelte';
import Hourly from '../widgets/Hourly.svelte';
import Sports from '../widgets/Sports.svelte';
import Todos from '../widgets/Todos.svelte';
import type { DashboardState, WidgetId } from './types';

interface WidgetDef {
  title: string;
  icon: Component;
  accent: string;
  component: Component;
  /** Whether there is anything worth showing; empty views are skipped in the rotator. */
  ready: (d: DashboardState) => boolean;
}

const weatherReady = (d: DashboardState) => !!d.weather?.configured;

export const WIDGETS: Record<WidgetId, WidgetDef> = {
  calendar: { title: 'Calendar', icon: CalendarDays, accent: '#ff453a', component: Calendar, ready: (d) => !!d.calendar },
  todos: { title: 'To Do', icon: CircleCheck, accent: '#0a84ff', component: Todos, ready: (d) => !!d.todos },
  hourly: { title: 'Hourly Forecast', icon: Clock, accent: '#64d2ff', component: Hourly, ready: weatherReady },
  daily: { title: '6-Day Forecast', icon: Thermometer, accent: '#ff9f0a', component: Daily, ready: weatherReady },
  air: { title: 'Conditions', icon: Gauge, accent: '#30d158', component: Air, ready: weatherReady },
  countdowns: { title: 'Countdowns', icon: Hourglass, accent: '#bf5af2', component: Countdowns, ready: (d) => !!d.settings?.countdowns.length },
  sports: { title: 'Scores', icon: Trophy, accent: '#ffd60a', component: Sports, ready: (d) => !!d.sports?.teams.length },
};
