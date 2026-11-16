<script setup>
import { computed } from 'vue';
import Light from './Light.vue';
import { car, actions } from '../core/car.js';

const waitingForPlay = computed(() => car.musicTitle.value === 'Press PLAY');
const status = computed(() => {
  if (!car.radioIndicator.value) return 'Radio éteinte';
  return waitingForPlay.value ? 'Prête à lire' : 'Radio allumée';
});
</script>

<template>
  <section class="radio" aria-label="Autoradio">
    <div class="radio-top"><span>AUDIO</span><span class="slot" aria-hidden="true"></span><Light label="RADIO" color="#3ee0ff" :on="car.radioIndicator.value" /></div>
    <div class="radio-controls">
      <div class="power-control">
        <button class="power" :class="{ on: car.radioOn.value }" :disabled="!car.online.value"
          :aria-pressed="car.radioOn.value" :aria-label="car.radioOn.value ? 'Éteindre la radio' : 'Allumer la radio'"
          :title="car.radioOn.value ? 'Éteindre la radio' : 'Allumer la radio'" @click="actions.set('radioOn', !car.radioOn.value)">
          <span aria-hidden="true">⏻</span>
        </button>
        <span>POWER</span>
      </div>
      <div class="display" :class="{ lit: car.radioIndicator.value }">
        <div class="display-status"><span>{{ status }}</span><span aria-hidden="true">♫</span></div>
        <b>{{ car.musicTitle.value || 'Aucune piste' }}</b>
      </div>
      <div class="transport">
        <button :disabled="!car.online.value || !waitingForPlay || !car.radioIndicator.value" @click="actions.fire('radioPlay')"><span aria-hidden="true">▶</span> Lecture</button>
        <button :disabled="!car.online.value || !car.radioIndicator.value || waitingForPlay" @click="actions.fire('radioSkip')"><span aria-hidden="true">⏭</span> Suivant</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.radio { display: flex; flex-direction: column; gap: 10px; padding: 10px; border: 1px solid #45536b; border-radius: 12px; background: linear-gradient(160deg, #303949, #151d2b 45%, #0c111a); box-shadow: inset 0 1px #ffffff18, 0 5px 12px #0006; }
.radio-top { display: flex; align-items: center; gap: 6px; color: #8f9db0; font: 700 8px system-ui, sans-serif; letter-spacing: 1px; }
.slot { flex: 1; height: 4px; border-radius: 3px; background: #070a0f; box-shadow: 0 1px #ffffff20; }
.display { display: flex; flex: 1; flex-direction: column; gap: 7px; min-width: 0; padding: 10px; border: 2px solid #080c12; border-radius: 5px; background: #080e16; box-shadow: inset 0 0 10px #000; }
.display-status { display: flex; justify-content: space-between; gap: 5px; color: #7f90a6; font: 700 8px system-ui, sans-serif; letter-spacing: 0.8px; text-transform: uppercase; }
.display b { overflow: hidden; color: #8c9aaa; font: 700 12px Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
.display.lit { background: linear-gradient(#0b1c2a, #102d3a); box-shadow: inset 0 0 12px #0009, 0 0 8px #3ee0ff18; }
.display.lit .display-status, .display.lit b { color: #a4efff; }
.radio-controls { display: flex; align-items: center; gap: 10px; }
.power-control { display: flex; flex: none; flex-direction: column; align-items: center; gap: 3px; color: #8998ae; font: 700 8px system-ui, sans-serif; letter-spacing: 0.8px; }
.radio button { color: var(--text); cursor: pointer; }
.power { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 3px solid #67758a; border-radius: 50%; background: radial-gradient(circle at 35% 25%, #465264, #1a2331 65%, #0d131d); box-shadow: inset 0 0 0 2px #121822, 0 3px 6px #0009; }
.power span { color: #a7b3c3; font: 700 21px system-ui, sans-serif; line-height: 1; }
.power.on { border-color: #3b8ca5; }
.power.on span { color: #7ceaff; text-shadow: 0 0 8px #3ee0ff; }
.transport { display: grid; flex: 0 0 140px; min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.transport button { min-width: 0; padding: 9px 3px; border: 1px solid #3a485e; border-radius: 5px; background: linear-gradient(#303c4c, #1b2533); box-shadow: inset 0 1px #ffffff15, 0 2px 3px #0006; font: 700 10px system-ui, sans-serif; }
.transport button:not(:disabled) { color: #b8edfa; border-color: #3b8ca5; }
.radio button:active:not(:disabled) { transform: translateY(1px); }
.radio button:focus-visible { outline: 2px solid #3ee0ff; outline-offset: 2px; }
.radio button:disabled { opacity: 0.42; cursor: default; }
@media (max-width: 500px) {
  .transport { flex-basis: 110px; }
  .radio-controls { gap: 6px; }
}
</style>
