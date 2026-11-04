<script setup>
// Gear panel: runtime overrides of site.config.jsonc, stored in localStorage.
import { reactive, ref } from 'vue';
import { settings, saveSettings, resetSettings } from '../core/settings.js';
import { testConnection } from '../core/store.js';

const emit = defineEmits(['close', 'apply']);
const form = reactive({
  url: settings.api.url,
  token: settings.api.token,
  reconnectMs: settings.api.reconnectMs,
  theme: settings.ui.theme,
  showDebug: settings.ui.showDebug,
  view: settings.ui.view,
});
const result = ref('');
const ok = ref(true);

const toApi = () => ({ url: form.url.trim(), token: form.token, reconnectMs: Number(form.reconnectMs) || 1000 });

async function test() {
  result.value = 'Test…';
  try {
    result.value = await testConnection(toApi());
    ok.value = true;
  } catch (e) {
    result.value = e.message;
    ok.value = false;
  }
}
function save() {
  saveSettings({ api: toApi(), ui: { theme: form.theme, showDebug: form.showDebug, view: form.view } });
  emit('apply');
  emit('close');
}
function reset() {
  resetSettings();
  emit('apply');
  emit('close');
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <h2>Réglages</h2>
      <label>URL de l'API<input v-model="form.url" placeholder="http://127.0.0.1:8080" /></label>
      <label>Token (optionnel)<input v-model="form.token" /></label>
      <label>Reconnexion (ms)<input v-model="form.reconnectMs" type="number" min="100" /></label>
      <label>Thème
        <select v-model="form.theme"><option value="dark">Sombre</option><option value="light">Clair</option></select>
      </label>
      <label>Vue
        <select v-model="form.view"><option value="car">Voiture (réaliste)</option><option value="technical">Technique (composants)</option></select>
      </label>
      <label class="chk"><input v-model="form.showDebug" type="checkbox" /> Panneau debug</label>
      <div v-if="result" class="result" :class="{ bad: !ok }">{{ result }}</div>
      <div class="actions">
        <button @click="test">Tester</button>
        <button @click="reset">Réinitialiser</button>
        <span class="spacer"></span>
        <button @click="emit('close')">Annuler</button>
        <button class="primary" @click="save">Enregistrer</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: #000a; display: flex; align-items: center; justify-content: center; z-index: 10; }
.modal { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 20px; width: 380px; display: flex; flex-direction: column; gap: 12px; }
h2 { margin: 0; font-size: 16px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; opacity: 0.9; }
label.chk { flex-direction: row; align-items: center; gap: 8px; }
input, select { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 7px 9px; font: inherit; }
.actions { display: flex; gap: 8px; align-items: center; }
.spacer { flex: 1; }
button { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 7px 12px; cursor: pointer; font: inherit; }
button.primary { background: #2f6fed; border-color: #2f6fed; color: #fff; }
.result { font-size: 12px; color: #3ecf8e; }
.result.bad { color: #ff4d4d; }
</style>
