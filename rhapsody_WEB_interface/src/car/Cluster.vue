<script setup>
import { computed } from 'vue';
import Dial from './Dial.vue';
import Light from './Light.vue';
import BatteryGauge from './BatteryGauge.vue';
import { car, actions, speedScaleMax } from '../core/car.js';

const scale = computed(() => speedScaleMax(car.maxSpeed.value));
const odo = computed(() => car.distanceKm.value.toFixed(1).padStart(8, '0'));
</script>

<template>
  <div class="cluster" :class="{ off: !car.contact.value }">
    <div class="zone fuel">
      <div class="dial"><Dial :value="car.fuel.value" :min="0" :max="50" :start="150" :sweep="240" :major="10" :minor="5" :warn-below="car.fuelThreshold.value" accent="#ffb020" caption="Carburant" unit="L" :digits="1" /></div>
      <Light label="CARBURANT" color="#ffb020" blink :on="car.fuelLow.value" />
      <button :disabled="!car.online.value" @click="actions.fire('refuel')">⛽ Faire le plein</button>
    </div>

    <div class="zone speed">
      <div class="dial"><Dial :value="car.speed.value" :min="0" :max="scale" :major="20" :minor="10" :accent="car.limiterExceeded.value ? '#ff4d4d' : '#3ee0ff'" caption="Vitesse" unit="km/h" /></div>
      <div class="lights">
        <Light label="RÉGUL." color="#3ecf8e" :on="car.cruise.value" />
        <Light label="LIMIT." color="#ffb020" :on="car.limiter.value" />
        <Light label="DÉPASS." color="#ff4d4d" blink :on="car.limiterExceeded.value" />
      </div>
      <div class="odo"><span>{{ odo }}</span> km</div>
    </div>

    <div class="zone battery">
      <BatteryGauge :value="car.battery.value" :warn-below="car.batteryThreshold.value" />
      <Light label="BATTERIE" color="#ff4d4d" blink :on="car.batteryLow.value" />
      <button :disabled="!car.online.value" @click="actions.fire('jumpStart')">🔋 Dépanner</button>
    </div>
  </div>
</template>

<style scoped>
.cluster { display: flex; align-items: center; justify-content: center; gap: 28px; background: radial-gradient(ellipse at 50% 0%, #1a2233, #070a10 70%); border: 2px solid #2a354a; border-radius: 22px; padding: 10px 22px; box-shadow: inset 0 0 30px #000a, 0 8px 20px #0008; color: #cfe0ff; transition: filter 0.4s; }
.cluster.off { filter: saturate(0.25) brightness(0.55); }
.zone { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.zone .dial { width: 120px; }
.zone.speed .dial { width: 170px; }
.lights { display: flex; gap: 10px; }
.odo { font: 11px Consolas, monospace; color: #7f90ad; }
.odo span { background: #05080d; border: 1px solid #1d2638; padding: 1px 5px; border-radius: 4px; color: #e8eef7; letter-spacing: 2px; }
.zone button { background: #151c28; color: #cfe0ff; border: 1px solid #2a354a; border-radius: 8px; padding: 3px 9px; font-size: 10px; cursor: pointer; }
.zone button:hover:not(:disabled) { border-color: #3ecf8e; }
.zone button:disabled { opacity: 0.4; cursor: default; }
</style>
