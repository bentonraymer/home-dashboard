import '@fontsource-variable/inter';
import './global.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { connect } from './lib/store.svelte';

document.documentElement.classList.add('dashboard');
connect();
mount(App, { target: document.getElementById('app')! });
