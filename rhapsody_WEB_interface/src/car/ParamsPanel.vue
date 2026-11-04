<script setup>
// "Paramètres" menu: initial values of the model, written straight to the engine (see "parameters" in api-map.jsonc).
import map from '../../api-map.jsonc';
import { car, attributes, actions } from '../core/car.js';

defineEmits(['close']);

const groups = map.parameters || [];
const known = (item) => !!attributes[item.key];
const isText = (item) => attributes[item.key]?.type === 'string';

function commit(item, e) {
  const raw = e.target.value;
  if (isText(item)) return actions.set(item.key, raw);
  const v = Number(raw);
  if (raw !== '' && Number.isFinite(v)) actions.set(item.key, v);
}
</script>

<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <header>
        <h2>Paramètres de la simulation</h2>
        <button class="x" @click="$emit('close')">✕</button>
      </header>
      <p class="hint">Les valeurs sont envoyées au simulateur à la validation (Entrée ou changement de champ). « Reset Simulation » rétablit les valeurs d'origine.</p>
      <div class="groups">
        <fieldset v-for="g in groups" :key="g.group">
          <legend>{{ g.group }}</legend>
          <template v-for="item in g.items" :key="item.key">
            <label v-if="known(item)">
              <span>{{ item.label }}</span>
              <input
                :type="isText(item) ? 'text' : 'number'"
                :step="item.step"
                :value="isText(item) ? car[item.key].value : Math.round(car[item.key].value * 100) / 100"
                :disabled="!car.online.value"
                @change="commit(item, $event)"
              />
              <small>{{ item.unit || '' }}</small>
            </label>
          </template>
        </fieldset>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: #000a; display: grid; place-items: center; z-index: 50; }
.modal { width: min(760px, 94vw); max-height: 90vh; overflow: auto; background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 16px 20px; }
header { display: flex; justify-content: space-between; align-items: center; }
h2 { margin: 0; font-size: 17px; }
.x { background: none; border: 0; color: var(--text); font-size: 18px; cursor: pointer; }
.hint { font-size: 12px; opacity: 0.65; margin: 6px 0 12px; }
.groups { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
fieldset { border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px 10px; display: grid; gap: 6px; align-content: start; }
legend { font: 700 11px system-ui, sans-serif; letter-spacing: 1px; text-transform: uppercase; opacity: 0.8; padding: 0 6px; }
label { display: grid; grid-template-columns: 1fr 90px 34px; align-items: center; gap: 8px; font-size: 12px; }
input { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 4px 6px; width: 100%; box-sizing: border-box; }
small { opacity: 0.6; }
@media (max-width: 700px) { .groups { grid-template-columns: 1fr; } }
</style>
