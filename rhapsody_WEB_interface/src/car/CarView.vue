<script setup>
import Cluster from './Cluster.vue';
import IgnitionKey from './IgnitionKey.vue';
import PedalControl from './PedalControl.vue';
import SpeedControl from './SpeedControl.vue';
import HandsFree from './HandsFree.vue';
import Phone from './Phone.vue';
</script>

<template>
  <div class="car">
    <div class="main">
      <Cluster />
      <div class="row">
        <div class="controls">
          <IgnitionKey />
          <div class="pedals">
            <PedalControl label="Frein" kind="brake" />
            <PedalControl label="Accélérateur" kind="accel" />
          </div>
        </div>
        <SpeedControl />
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
.controls { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 10px 14px; background: var(--panel); border: 1px solid var(--border); border-radius: 16px; }
.pedals { display: flex; gap: 14px; align-items: flex-end; }
.side { flex: none; height: 100%; }
@media (max-width: 1100px) { .row { grid-template-columns: 1fr 1fr; } }
</style>
