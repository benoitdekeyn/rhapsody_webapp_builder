<script setup>
import { computed, onBeforeUnmount } from 'vue';
import ModalShell from './ModalShell.vue';
import { car, actions } from '../core/car.js';

defineEmits(['close']);

const scale = computed(() => Math.max(60, Math.ceil((car.maxSpeed.value + 10) / 10) * 10));
const pct = (v) => Math.min(100, Math.max(0, (v / scale.value) * 100)) + '%';
const active = computed(() => car.mode.value !== 'manual');
const conditions = computed(() => [
  { ok: car.engine.value, text: 'Moteur tournant' },
  { ok: car.speed.value >= 30, text: 'Vitesse ≥ 30 km/h (régulateur)' },
  { ok: car.brake.value < 0.5, text: 'Pied levé du frein' },
]);

let timer = null;
let repeat = null;
function press(event) {
  actions.fire(event);
  timer = setTimeout(() => (repeat = setInterval(() => actions.fire(event), 180)), 450);
}
function release() {
  clearTimeout(timer);
  clearInterval(repeat);
  timer = repeat = null;
}
onBeforeUnmount(release);

function setInitial(e) {
  const v = Number(e.target.value);
  if (Number.isFinite(v)) actions.set('valeur_initiale_limiteur', Math.round(v));
}
</script>

<template>
  <ModalShell title="Régulateur / Limiteur de vitesse" :x="60" :y="110" :width="440" @close="$emit('close')">
    <div class="stalk">
      <button class="mode cruise" :class="{ on: car.mode.value === 'cruise' }" :disabled="!car.online.value" @click="actions.fire('ev_regulateur')">
        <b>RÉGULATEUR</b><small>CRUISE</small>
        <i class="led"></i>
      </button>
      <button class="mode limiter" :class="{ on: car.mode.value === 'limiter' }" :disabled="!car.online.value" @click="actions.fire('ev_limiteur')">
        <b>LIMITEUR</b><small>LIMIT</small>
        <i class="led"></i>
      </button>
    </div>

    <div class="display" :class="[car.mode.value, { over: car.limiterExceeded.value }]">
      <div class="lbl">{{ car.mode.value === 'cruise' ? 'Vitesse régulée' : car.mode.value === 'limiter' ? 'Vitesse limite' : 'Consigne' }}</div>
      <div class="big">{{ active ? car.setpoint.value : '--' }}<small>km/h</small></div>
      <div class="adjust">
        <button :disabled="!active" @pointerdown.prevent="press('ev_vitesseConsigne_moins')" @pointerup="release" @pointerleave="release" @pointercancel="release">−</button>
        <button :disabled="!active" @pointerdown.prevent="press('ev_vitesseConsigne_plus')" @pointerup="release" @pointerleave="release" @pointercancel="release">+</button>
      </div>
      <div class="hint">Maintenir pour répéter</div>
    </div>

    <div class="bar">
      <div class="scale"><span v-for="n in 7" :key="n">{{ Math.round(((n - 1) * scale) / 6) }}</span></div>
      <div class="rail">
        <div class="fill" :style="{ width: pct(car.speed.value) }"></div>
        <div v-if="active" class="mark" :style="{ left: pct(car.setpoint.value) }"><i></i><small>{{ car.setpoint.value }}</small></div>
      </div>
      <div class="now">Vitesse actuelle <b>{{ Math.round(car.speed.value) }}</b> km/h</div>
    </div>

    <div v-if="car.limiterExceeded.value" class="alarm">⚠ Limite dépassée — relâchez l'accélérateur (alarme sonore sur le simulateur)</div>
    <div v-else-if="car.limiterWaiting.value" class="note">Limiteur en attente de stabilisation…</div>

    <ul class="conds">
      <li v-for="c in conditions" :key="c.text" :class="{ ok: c.ok }"><i>{{ c.ok ? '✓' : '○' }}</i>{{ c.text }}</li>
    </ul>

    <label class="initial">
      Consigne initiale du limiteur
      <input type="number" min="0" :max="car.maxSpeed.value" step="5" :value="car.initialLimit.value" :disabled="!car.online.value" @change="setInitial" />
      <small>km/h</small>
    </label>
  </ModalShell>
</template>

<style scoped>
.stalk { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
.mode { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 14px 8px; border-radius: 14px; border: 1px solid var(--border); background: linear-gradient(#232c3c, #161d2a); color: var(--text); cursor: pointer; }
.mode b { font-size: 13px; letter-spacing: 1.5px; }
.mode small { font-size: 10px; opacity: 0.55; letter-spacing: 2px; }
.mode .led { position: absolute; top: 8px; right: 10px; width: 9px; height: 9px; border-radius: 50%; background: #2a3344; }
.mode.on.cruise { border-color: #3ecf8e; box-shadow: 0 0 18px #3ecf8e44; }
.mode.on.cruise .led { background: #3ecf8e; box-shadow: 0 0 8px #3ecf8e; }
.mode.on.limiter { border-color: #ffb020; box-shadow: 0 0 18px #ffb02044; }
.mode.on.limiter .led { background: #ffb020; box-shadow: 0 0 8px #ffb020; }
.mode:disabled { opacity: 0.5; cursor: default; }
.display { text-align: center; padding: 14px; border-radius: 14px; background: #070a10; border: 1px solid #1d2638; color: #7f90ad; }
.display.cruise { color: #3ecf8e; }
.display.limiter { color: #ffb020; }
.display.over { color: #ff4d4d; animation: pulse 0.8s infinite; }
@keyframes pulse { 50% { background: #2a0d0d; } }
.display .lbl { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8; }
.display .big { font: 700 56px 'Segoe UI', system-ui, sans-serif; font-variant-numeric: tabular-nums; line-height: 1.1; }
.display .big small { font-size: 14px; margin-left: 6px; opacity: 0.7; }
.adjust { display: flex; justify-content: center; gap: 16px; margin-top: 6px; }
.adjust button { width: 76px; height: 46px; border-radius: 12px; border: 1px solid var(--border); background: linear-gradient(#2b3548, #1a2231); color: var(--text); font: 700 26px system-ui, sans-serif; cursor: pointer; touch-action: none; }
.adjust button:active:not(:disabled) { transform: translateY(1px); filter: brightness(1.3); }
.adjust button:disabled { opacity: 0.35; cursor: default; }
.hint { font-size: 10px; opacity: 0.5; margin-top: 6px; }
.bar { margin: 16px 2px 6px; }
.scale { display: flex; justify-content: space-between; font-size: 9px; opacity: 0.5; margin-bottom: 3px; }
.rail { position: relative; height: 12px; border-radius: 6px; background: #0b0f16; border: 1px solid var(--border); }
.fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #1b8fb0, #3ee0ff); transition: width 0.2s linear; }
.mark { position: absolute; top: -5px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; }
.mark i { width: 3px; height: 22px; background: #ffd24a; border-radius: 2px; box-shadow: 0 0 6px #ffd24a; }
.mark small { font-size: 10px; color: #ffd24a; margin-top: 2px; }
.now { font-size: 12px; opacity: 0.8; margin-top: 18px; text-align: center; }
.alarm { margin-top: 12px; padding: 8px 12px; border-radius: 10px; background: #b3261e33; border: 1px solid #ff4d4d; color: #ff8a8a; font-size: 12px; }
.note { margin-top: 12px; font-size: 12px; color: #ffb020; text-align: center; }
.conds { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 3px; font-size: 12px; opacity: 0.9; }
.conds li { color: #7f90ad; display: flex; gap: 8px; }
.conds li.ok { color: #3ecf8e; }
.conds i { font-style: normal; width: 14px; text-align: center; }
.initial { display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.85; }
.initial input { width: 70px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 5px 8px; }
</style>
