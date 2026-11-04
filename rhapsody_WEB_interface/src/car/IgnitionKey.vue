<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import Light from './Light.vue';
import { car, actions } from '../core/car.js';

// START is a spring-loaded position: held while the pointer is down, the key goes back to ON on release.
const cranking = ref(false);
const position = computed(() => (cranking.value ? 'start' : car.contact.value ? 'on' : 'off'));
const angle = computed(() => ({ off: -48, on: 0, start: 48 })[position.value]);

function crankDown(e) {
  if (!car.online.value || !car.contact.value || cranking.value) return;
  cranking.value = true;
  e.currentTarget.setPointerCapture?.(e.pointerId);
  actions.start();
}
const crankUp = () => (cranking.value = false);
onBeforeUnmount(crankUp);

function keyClick() {
  if (!car.online.value) return;
  if (car.contact.value) actions.contactOff();
  else actions.contactOn();
}
</script>

<template>
  <div class="ignition" :class="{ disabled: !car.online.value }">
    <svg viewBox="0 0 160 130" class="lock" @click="keyClick">
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
      <circle cx="80" cy="72" r="52" fill="#10151f" stroke="#2c3850" stroke-width="3" />
      <g font-family="system-ui" font-size="10" font-weight="700" text-anchor="middle">
        <text x="30" y="36" :fill="position === 'off' ? '#fff' : '#6c7c99'">OFF</text>
        <text x="80" y="14" :fill="position === 'on' ? '#3ecf8e' : '#6c7c99'">ON</text>
        <text x="128" y="36" :fill="position === 'start' ? '#ffb020' : '#6c7c99'">DÉMARRER</text>
      </g>
      <circle cx="80" cy="72" r="36" fill="url(#steel)" stroke="#1a2030" stroke-width="3" />
      <circle cx="80" cy="72" r="27" fill="#1d2432" />
      <g class="key" :class="{ springing: !cranking }" :style="{ transform: `rotate(${angle}deg)` }">
        <rect x="72" y="26" width="16" height="54" rx="8" fill="url(#keygold)" stroke="#5c4710" stroke-width="1.5" />
        <circle cx="80" cy="37" r="3.5" fill="#1d2432" />
        <rect x="76.5" y="78" width="7" height="24" fill="#cfd6e4" stroke="#6b7488" />
        <path d="M83.5 85h5v4h-5zM83.5 93h4v4h-4z" fill="#cfd6e4" stroke="#6b7488" />
      </g>
    </svg>
    <div class="side">
      <Light label="MOTEUR" color="#3ecf8e" :on="car.engine.value" />
      <button class="start" :class="{ active: cranking }" :disabled="!car.online.value" @pointerdown.prevent="crankDown" @pointerup="crankUp" @pointercancel="crankUp" @lostpointercapture="crankUp">Démarrer</button>
    </div>
  </div>
</template>

<style scoped>
.ignition { display: flex; flex-direction: row; align-items: center; gap: 14px; user-select: none; }
.side { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ignition.disabled { opacity: 0.5; }
.lock { width: 130px; cursor: pointer; filter: drop-shadow(0 6px 10px #0008); }
.key { transform-origin: 80px 72px; transition: transform 0.12s ease-out; }
.key.springing { transition: transform 0.3s cubic-bezier(0.3, 1.5, 0.5, 1); }
.start { background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: 7px 18px; font: 700 11px system-ui, sans-serif; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; touch-action: none; }
.start.active { background: #ffb020; color: #1b1100; border-color: #ffb020; }
.start:disabled { cursor: default; opacity: 0.5; }</style>
