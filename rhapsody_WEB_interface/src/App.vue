<script setup>
import { ref, computed, watch, watchEffect, onMounted, onBeforeUnmount } from 'vue';
import Dashboard from './dashboard/Dashboard.vue';
import CarView from './car/CarView.vue';
import SettingsPanel from './settings/SettingsPanel.vue';
import { settings, setUiOption } from './core/settings.js';
import { store, connect, disconnect, resetSimulation } from './core/store.js';
import { validateDashboard } from './core/resolve.js';
import dashboard from './dashboard/dashboard.config.jsonc';
import defaults from '../site.config.jsonc';

const showSettings = ref(false);
const resetting = ref(false);
const warnings = computed(() => validateDashboard(dashboard, store.schema));
const title = defaults.title || 'Rhapsody';
const technical = computed(() => settings.ui.view === 'technical');
const switchView = () => setUiOption('view', technical.value ? 'car' : 'technical');

async function reset() {
  if (!window.confirm('Relancer la simulation depuis le début ?')) return;
  resetting.value = true;
  try {
    await resetSimulation();
  } catch {
    resetting.value = false;
  }
}
// the engine restarts itself: the button is available again once the connection is back
watch(() => store.connected, (on) => {
  if (on) resetting.value = false;
});

watchEffect(() => {
  document.documentElement.dataset.theme = settings.ui.theme;
});
const apply = () => connect(settings.api);
onMounted(apply);
onBeforeUnmount(disconnect);
</script>

<template>
  <header>
    <h1>{{ title }}</h1>
    <span class="status" :class="{ on: store.connected }">
      <i></i>{{ store.connected ? 'Connecté' : store.connecting ? 'Connexion…' : 'Déconnecté' }}
      <small>{{ settings.api.url }}</small>
    </span>
    <span class="warn" v-if="technical && warnings.length" :title="warnings.map((w) => `${w.kind} ${w.name}`).join('\n')">⚠ {{ warnings.length }} élément(s) absent(s) du schéma</span>
    <span class="spacer"></span>
    <button class="view" title="Changer de vue" @click="switchView">{{ technical ? 'Vue voiture' : 'Vue technique' }}</button>
    <button class="reset" :disabled="!store.connected || resetting" title="Relance la simulation depuis le début" @click="reset">
      {{ resetting ? 'Redémarrage…' : 'Reset Simulation' }}
    </button>
    <button class="gear" title="Réglages" @click="showSettings = true">⚙</button>
  </header>
  <div v-if="store.error" class="error">{{ store.error }}</div>
  <main><Dashboard v-if="technical" /><CarView v-else /></main>
  <section v-if="settings.ui.showDebug" class="debug">
    <h4>Événements reçus</h4>
    <div v-for="(e, i) in store.eventLog.slice(0, 15)" :key="i">{{ e.name }} {{ e.instance }} {{ JSON.stringify(e.args) }}</div>
    <h4>État</h4>
    <pre>{{ JSON.stringify(store.state, null, 1) }}</pre>
  </section>
  <SettingsPanel v-if="showSettings" @close="showSettings = false" @apply="apply" />
</template>

<style>
:root { --bg: #0e131c; --panel: #151c28; --border: #243047; --text: #e8eef7; }
:root[data-theme='light'] { --bg: #eef2f7; --panel: #fff; --border: #cfd8e6; --text: #1b2433; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, Segoe UI, sans-serif; }
header { display: flex; align-items: center; gap: 16px; padding: 10px 20px; border-bottom: 1px solid var(--border); background: var(--panel); }
h1 { margin: 0; font-size: 16px; }
.status { font-size: 12px; display: flex; align-items: center; gap: 6px; }
.status i { width: 9px; height: 9px; border-radius: 50%; background: #ff4d4d; display: inline-block; }
.status.on i { background: #3ecf8e; }
.status small { opacity: 0.55; }
.warn { font-size: 12px; color: #ffb020; cursor: help; }
.spacer { flex: 1; }
.gear { background: none; border: 0; color: var(--text); font-size: 22px; cursor: pointer; }
.reset { background: #ff4d4d22; color: #ff6b6b; border: 1px solid #ff4d4d66; border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
.reset:hover:not(:disabled) { background: #ff4d4d44; }
.reset:disabled { opacity: 0.5; cursor: default; }
.view { background: none; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
.error { background: #ff4d4d22; color: #ff6b6b; padding: 6px 20px; font-size: 12px; }
main { padding: 22px; }
.debug { margin: 0 22px 22px; font: 11px Consolas, monospace; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 10px; max-height: 260px; overflow: auto; }
.debug h4 { margin: 6px 0; }
</style>
