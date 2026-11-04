<script setup>
import { computed } from 'vue';
import Panel from './Panel.vue';
import Light from './Light.vue';
import { car, actions } from '../core/car.js';

const scale = computed(() => Math.max(60, Math.ceil((car.maxSpeed.value + 10) / 10) * 10));
const pct = (v) => Math.min(100, Math.max(0, (v / scale.value) * 100)) + '%';
const active = computed(() => car.mode.value !== 'manual');
</script>

<template>
  <Panel title="Régulateur / Limiteur">
    <template #lights>
      <Light label="RÉGUL." color="#3ecf8e" :on="car.cruise.value" />
      <Light label="LIMIT." color="#ffb020" :on="car.limiter.value" />
      <Light label="DÉPASS." color="#ff4d4d" blink :on="car.limiterExceeded.value" />
    </template>

    <div class="stalk">
      <button class="mode cruise" :class="{ on: car.mode.value === 'cruise' }" :disabled="!car.online.value" @click="actions.fire('cruise')"><b>RÉGULATEUR</b><small>CRUISE</small></button>
      <button class="mode limiter" :class="{ on: car.mode.value === 'limiter' }" :disabled="!car.online.value" @click="actions.fire('limiter')"><b>LIMITEUR</b><small>LIMIT</small></button>
    </div>

    <div class="display" :class="[car.mode.value, { over: car.limiterExceeded.value }]">
      <div class="lbl">{{ car.mode.value === 'cruise' ? 'Vitesse régulée' : car.mode.value === 'limiter' ? 'Vitesse limite' : 'Consigne (inactive)' }}</div>
      <div class="big">{{ car.setpoint.value }}<small>km/h</small></div>
      <div class="adjust">
        <button :disabled="!car.online.value" @click="actions.fire('setpointMinus')">−</button>
        <button :disabled="!car.online.value" @click="actions.fire('setpointPlus')">+</button>
      </div>
    </div>

    <div class="rail">
      <div class="fill" :style="{ width: pct(car.speed.value) }"></div>
      <div class="mark" :style="{ left: pct(car.setpoint.value) }"></div>
    </div>
    <div class="now">{{ Math.round(car.speed.value) }} <small>km/h</small></div>
  </Panel>
</template>

<style scoped>
.stalk { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.mode { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 4px; border-radius: 12px; border: 1px solid var(--border); background: linear-gradient(#232c3c, #161d2a); color: var(--text); cursor: pointer; }
.mode b { font-size: 11px; letter-spacing: 1px; }
.mode small { font-size: 9px; opacity: 0.55; letter-spacing: 2px; }
.mode.on.cruise { border-color: #3ecf8e; box-shadow: 0 0 14px #3ecf8e44; }
.mode.on.limiter { border-color: #ffb020; box-shadow: 0 0 14px #ffb02044; }
.mode:disabled { opacity: 0.5; cursor: default; }
.display { text-align: center; padding: 8px; border-radius: 12px; background: #070a10; border: 1px solid #1d2638; color: #7f90ad; }
.display.cruise { color: #3ecf8e; }
.display.limiter { color: #ffb020; }
.display.over { color: #ff4d4d; animation: pulse 0.8s infinite; }
@keyframes pulse { 50% { background: #2a0d0d; } }
.lbl { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8; }
.big { font: 700 32px 'Segoe UI', system-ui, sans-serif; font-variant-numeric: tabular-nums; line-height: 1.1; }
.big small { font-size: 11px; margin-left: 4px; opacity: 0.7; }
.adjust { display: flex; justify-content: center; gap: 12px; margin-top: 4px; }
.adjust button { width: 58px; height: 36px; border-radius: 10px; border: 1px solid var(--border); background: linear-gradient(#2b3548, #1a2231); color: var(--text); font: 700 22px system-ui, sans-serif; cursor: pointer; }
.adjust button:active:not(:disabled) { transform: translateY(1px); filter: brightness(1.3); }
.adjust button:disabled { opacity: 0.35; cursor: default; }
.rail { position: relative; height: 10px; margin-top: 14px; border-radius: 5px; background: #0b0f16; border: 1px solid var(--border); }
.fill { height: 100%; border-radius: 5px; background: linear-gradient(90deg, #1b8fb0, #3ee0ff); transition: width 0.2s linear; }
.mark { position: absolute; top: -4px; width: 3px; height: 18px; transform: translateX(-50%); background: #ffd24a; border-radius: 2px; box-shadow: 0 0 6px #ffd24a; }
.now { text-align: center; font: 700 14px system-ui, sans-serif; margin-top: 8px; font-variant-numeric: tabular-nums; }
.now small { font-weight: 400; opacity: 0.6; }
</style>
