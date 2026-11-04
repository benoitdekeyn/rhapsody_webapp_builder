<script setup>
import { car, actions } from '../core/car.js';
const setSlope = (e) => actions.set('slope', Number(e.target.value));
</script>

<template>
  <div class="slope" title="Pente de la route">
    <span class="cap">PENTE</span>
    <input class="slider" type="range" min="-20" max="20" step="1" :value="car.slope.value" :disabled="!car.online.value" @input="setSlope" />
    <b>{{ car.slope.value > 0 ? '+' : '' }}{{ car.slope.value }}</b>
  </div>
</template>

<style scoped>
.slope { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 12px; background: var(--panel); border: 1px solid var(--border); border-radius: 16px; color: #cfe0ff; }
.cap { font: 700 9px system-ui, sans-serif; letter-spacing: 1.5px; color: #7f90ad; }
b { font: 700 14px Consolas, monospace; color: #fff; }
.slider { writing-mode: vertical-lr; direction: rtl; height: 150px; width: 22px; accent-color: #3ee0ff; cursor: pointer; }
button { padding: 2px 10px; font-size: 11px; background: #151c28; color: #cfe0ff; border: 1px solid #2a354a; border-radius: 8px; cursor: pointer; }
button:disabled { opacity: 0.4; cursor: default; }
</style>
