import './lib/fonts';
import './global.css';
import { mount } from 'svelte';
import SettingsApp from './settings/SettingsApp.svelte';

mount(SettingsApp, { target: document.getElementById('app')! });
