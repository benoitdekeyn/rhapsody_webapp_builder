<script setup>
import { computed } from 'vue';
import Dial from './Dial.vue';
import { car, speedScaleMax } from '../core/car.js';

const scale = computed(() => speedScaleMax(car.maxSpeed.value));
const modeText = computed(() => {
  if (car.limiterExceeded.value) return 'LIMITE DÉPASSÉE';
  if (car.mode.value === 'cruise') return `RÉGULATEUR ${car.setpoint.value} km/h`;
  if (car.mode.value === 'limiter') return `LIMITEUR ${car.setpoint.value} km/h`;
  return car.engine.value ? 'MANUEL' : car.contact.value ? 'CONTACT MIS' : 'VÉHICULE ÉTEINT';
});

const lights = computed(() => [
  { key: 'engine', label: 'MOTEUR', on: car.engine.value, color: '#3ecf8e' },
  { key: 'fuel', label: 'CARBURANT', on: car.fuelLow.value, color: '#ffb020', blink: true },
  { key: 'battery', label: 'BATTERIE', on: car.batteryLow.value, color: '#ff4d4d', blink: true },
  { key: 'cruise', label: 'RÉGUL.', on: car.cruise.value, color: '#3ecf8e' },
  { key: 'limiter', label: 'LIMIT.', on: car.limiter.value, color: '#ffb020' },
  { key: 'over', label: 'DÉPASS.', on: car.limiterExceeded.value, color: '#ff4d4d', blink: true },
  { key: 'bt', label: 'BLUETOOTH', on: car.vehicleBluetooth.value, color: '#4aa3ff' },
  { key: 'phone', label: 'TÉLÉPHONE', on: car.connected.value, color: '#4aa3ff' },
  { key: 'call', label: 'APPEL', on: car.call.value, color: '#3ecf8e', blink: true },
  { key: 'sms', label: 'SMS', on: car.sms.value, color: '#ffd24a', blink: true },
]);
const odo = computed(() => car.distanceKm.value.toFixed(1).padStart(8, '0'));
</script>

<template>
  <div class="cluster" :class="{ off: !car.contact.value }">
    <div class="lights">
      <span v-for="l in lights" :key="l.key" class="light" :class="{ on: l.on, blink: l.on && l.blink }" :style="{ '--c': l.color }">
        <i></i>{{ l.label }}
      </span>
    </div>
    <div class="dials">
      <div class="small">
        <Dial :value="car.fuel.value" :min="0" :max="50" :start="150" :sweep="240" :major="10" :minor="5" :warn-below="car.fuelThreshold.value" accent="#ffb020" caption="Carburant" unit="L" :digits="1" />
      </div>
      <div class="big">
        <Dial :value="car.speed.value" :min="0" :max="scale" :major="20" :minor="10" :label-every="1" :accent="car.limiterExceeded.value ? '#ff4d4d' : '#3ee0ff'" caption="Vitesse" unit="km/h" />
      </div>
      <div class="small">
        <Dial :value="car.battery.value" :min="0" :max="100" :start="150" :sweep="240" :major="50" :minor="10" :warn-below="car.batteryThreshold.value" accent="#4aa3ff" caption="Batterie" unit="%" />
      </div>
    </div>
    <div class="info">
      <div class="mode" :class="[car.mode.value, { over: car.limiterExceeded.value }]">{{ modeText }}</div>
      <div class="odo"><span>{{ odo }}</span> km</div>
    </div>
  </div>
</template>

<style scoped>
.cluster { background: radial-gradient(ellipse at 50% 0%, #1a2233, #070a10 70%); border: 2px solid #2a354a; border-radius: 28px; padding: 14px 22px 12px; box-shadow: inset 0 0 40px #000a, 0 12px 30px #0008; color: #cfe0ff; transition: filter 0.4s; }
.cluster.off { filter: saturate(0.2) brightness(0.55); }
.lights { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; margin-bottom: 4px; }
.light { display: inline-flex; align-items: center; gap: 5px; font: 600 9px system-ui, sans-serif; letter-spacing: 1px; color: #43506a; }
.light i { width: 9px; height: 9px; border-radius: 50%; background: #1a2232; box-shadow: inset 0 0 0 1px #2c3850; }
.light.on { color: var(--c); }
.light.on i { background: var(--c); box-shadow: 0 0 10px var(--c); }
.light.blink i { animation: blink 0.8s steps(2, jump-none) infinite; }
@keyframes blink { 50% { opacity: 0.15; } }
.dials { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; gap: 6px; }
.small { opacity: 0.95; }
.info { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 2px; }
.mode { font: 700 13px system-ui, sans-serif; letter-spacing: 2px; padding: 4px 16px; border-radius: 999px; background: #0c111a; border: 1px solid #263148; color: #7f90ad; }
.mode.cruise { color: #3ecf8e; border-color: #3ecf8e66; }
.mode.limiter { color: #ffb020; border-color: #ffb02066; }
.mode.over { color: #fff; background: #b3261e; border-color: #ff4d4d; animation: blink 0.8s steps(2, jump-none) infinite; }
.odo { font: 12px Consolas, monospace; color: #7f90ad; }
.odo span { background: #05080d; border: 1px solid #1d2638; padding: 2px 6px; border-radius: 4px; color: #e8eef7; letter-spacing: 2px; }
</style>
