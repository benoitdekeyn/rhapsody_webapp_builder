<script setup>
import Cluster from './Cluster.vue';
import IgnitionKey from './IgnitionKey.vue';
import PedalControl from './PedalControl.vue';
import SpeedControl from './SpeedControl.vue';
import HandsFree from './HandsFree.vue';
import Phone from './Phone.vue';
import Slope from './Slope.vue';
import { car, actions } from '../core/car.js';
</script>

<template>
  <div class="car">
    <div class="main">
      <div class="top"><Slope /><Cluster class="grow" /></div>
      <div class="row">
        <div class="left">
          <div class="refills">
            <button :disabled="!car.online.value" @click="actions.fire('refuel')">⛽ Faire le plein</button>
            <button :disabled="!car.online.value" @click="actions.fire('jumpStart')">🔋 Dépanner batterie</button>
          </div>
          <SpeedControl />
        </div>
        <div class="controls">
          <IgnitionKey />
          <div class="pedals">
            <PedalControl label="Frein" kind="brake" />
            <PedalControl label="Accélérateur" kind="accel" />
          </div>
        </div>
        <HandsFree />
      </div>
    </div>
    <div class="side"><Phone /></div>
  </div>
</template>

<style scoped>
.car { height: 100%; display: flex; gap: 16px; align-items: stretch; }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.row { flex: 1; min-height: 0; display: grid; grid-template-columns: auto minmax(200px, 1fr) minmax(220px, 1fr); gap: 12px; align-items: start; }
.top { display: flex; gap: 12px; align-items: stretch; }
.grow { flex: 1; min-width: 0; }
.left { display: flex; flex-direction: column; gap: 10px; }
.refills { display: flex; gap: 8px; }
.refills button { flex: 1; padding: 10px 14px; font-size: 13px; font-weight: 600; background: #151c28; color: #cfe0ff; border: 1px solid #2a354a; border-radius: 10px; cursor: pointer; }
.refills button:hover:not(:disabled) { border-color: #3ecf8e; }
.refills button:disabled { opacity: 0.4; cursor: default; }
.controls { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 10px 14px; background: var(--panel); border: 1px solid var(--border); border-radius: 16px; }
.pedals { display: flex; gap: 14px; align-items: flex-end; }
.side { flex: none; height: 100%; }
@media (max-width: 1100px) { .row { grid-template-columns: 1fr 1fr; } }
</style>
