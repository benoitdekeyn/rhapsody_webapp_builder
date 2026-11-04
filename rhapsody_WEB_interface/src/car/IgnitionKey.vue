<script setup>
import { ref, computed } from 'vue';
import { car, actions } from '../core/car.js';

const starting = ref(false);
const position = computed(() => (starting.value ? 'start' : car.contact.value ? 'on' : 'off'));
const angle = computed(() => ({ off: -48, on: 0, start: 48 })[position.value]);
const status = computed(() => {
  if (!car.online.value) return 'Simulation hors ligne';
  if (car.engine.value) return 'Moteur tournant';
  if (car.contact.value) return car.fuelLow.value || car.batteryLow.value ? 'Panne : démarrage impossible' : 'Contact mis';
  return 'Contact coupé';
});

async function crank() {
  if (starting.value || car.engine.value) return;
  starting.value = true;
  const done = actions.start();
  setTimeout(() => (starting.value = false), 900);
  await done;
}
const off = () => actions.contactOff();
const on = () => actions.contactOn();
function keyClick() {
  if (!car.contact.value) on();
  else if (car.engine.value) off();
  else crank();
}
</script>

<template>
  <div class="ignition" :class="{ disabled: !car.online.value }">
    <svg viewBox="0 0 160 150" class="lock" @click="keyClick">
      <defs>
        <radialGradient id="steel" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stop-color="#c9d3e3" />
          <stop offset="100%" stop-color="#4b5568" />
        </radialGradient>
        <linearGradient id="keygold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f1d98a" />
          <stop offset="100%" stop-color="#a8832c" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="82" r="58" fill="#10151f" stroke="#2c3850" stroke-width="3" />
      <g class="marks" font-family="system-ui" font-size="10" font-weight="700" text-anchor="middle">
        <text x="30" y="48" :fill="position === 'off' ? '#fff' : '#6c7c99'">OFF</text>
        <text x="80" y="20" :fill="position === 'on' ? '#3ecf8e' : '#6c7c99'">ON</text>
        <text x="130" y="48" :fill="position === 'start' ? '#ffb020' : '#6c7c99'">START</text>
      </g>
      <circle cx="80" cy="82" r="40" fill="url(#steel)" stroke="#1a2030" stroke-width="3" />
      <circle cx="80" cy="82" r="30" fill="#1d2432" />
      <g class="key" :style="{ transform: `rotate(${angle}deg)` }">
        <rect x="71" y="30" width="18" height="60" rx="9" fill="url(#keygold)" stroke="#5c4710" stroke-width="1.5" />
        <circle cx="80" cy="42" r="4" fill="#1d2432" />
        <rect x="76" y="88" width="8" height="26" fill="#cfd6e4" stroke="#6b7488" />
        <path d="M84 96h5v4h-5zM84 104h4v4h-4z" fill="#cfd6e4" stroke="#6b7488" />
      </g>
    </svg>
    <div class="seg">
      <button :class="{ active: position === 'off' }" :disabled="!car.online.value" @click="off">OFF</button>
      <button :class="{ active: position === 'on' }" :disabled="!car.online.value" @click="on">ON</button>
      <button class="start" :class="{ active: position === 'start' }" :disabled="!car.online.value || car.engine.value" @click="crank">START</button>
    </div>
    <div class="status" :class="{ run: car.engine.value }">{{ status }}</div>
  </div>
</template>

<style scoped>
.ignition { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 190px; user-select: none; }
.ignition.disabled { opacity: 0.5; }
.lock { width: 160px; cursor: pointer; filter: drop-shadow(0 6px 10px #0008); }
.key { transform-origin: 80px 82px; transition: transform 0.25s cubic-bezier(0.3, 1.4, 0.5, 1); }
.seg { display: flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.seg button { background: var(--panel); color: var(--text); border: 0; padding: 7px 14px; font: 700 11px system-ui, sans-serif; letter-spacing: 1px; cursor: pointer; border-right: 1px solid var(--border); }
.seg button:last-child { border-right: 0; }
.seg button.active { background: #3ecf8e; color: #04140d; }
.seg button.start.active { background: #ffb020; color: #1b1100; }
.seg button:disabled { cursor: default; opacity: 0.5; }
.status { font-size: 12px; opacity: 0.75; }
.status.run { color: #3ecf8e; opacity: 1; font-weight: 600; }
</style>
