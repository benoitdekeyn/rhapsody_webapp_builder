<script setup>
import { computed } from 'vue';
import Dial from './Dial.vue';
import Light from './Light.vue';
import BatteryGauge from './BatteryGauge.vue';
import { car, actions, speedScaleMax } from '../core/car.js';

const scale = computed(() => speedScaleMax(car.maxSpeed.value));
const throttlePct = computed(() => Math.min(100, Math.max(0, (car.throttle.value / (car.maxThrottle.value || 10)) * 100)));
const odo = computed(() => car.distanceKm.value.toFixed(1).padStart(8, '0'));
</script>

<template>
  <div class="cluster">
    <div class="zone fuel">
      <div class="dial"><Dial :value="car.fuel.value" :min="0" :max="50" :start="150" :sweep="240" :major="10" :minor="5" :label-every="2" :warn-below="car.fuelThreshold.value" accent="#ffb020" caption="" unit="L" :digits="1" /></div>
      <Light label="CARBURANT" color="#ffb020" blink :on="car.fuelLow.value" />
    </div>

    <div class="zone speed">
      <div class="dial"><Dial :value="car.speed.value" :min="0" :max="scale" :major="20" :minor="10" :accent="car.limiterExceeded.value ? '#ff4d4d' : '#3ee0ff'" caption="Vitesse" unit="km/h" /></div>
    </div>

    <div class="zone info">
      <div class="odo"><span>{{ odo }}</span><em>km</em></div>
      <div class="throttle" title="Injection d'essence">
        <span>INJECTION</span>
        <div class="rail"><i :style="{ width: throttlePct + '%' }"></i></div>
        <b>{{ car.throttle.value.toFixed(1) }}</b>
      </div>
    </div>

    <div class="zone battery">
      <BatteryGauge :value="car.battery.value" :warn-below="car.batteryThreshold.value" />
      <Light label="BATTERIE" color="#ff4d4d" blink :on="car.batteryLow.value" />
    </div>
  </div>
</template>

<style scoped>
.cluster { display: flex; align-items: center; justify-content: center; gap: 18px; background: radial-gradient(ellipse at 50% 0%, #1a2233, #070a10 70%); border: 2px solid #2a354a; border-radius: 22px; padding: 10px 16px; box-shadow: inset 0 0 30px #000a, 0 8px 20px #0008; color: #cfe0ff; }
.zone { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.zone.fuel .dial { width: 100px; }
.zone.speed .dial { width: 250px; }
.lights { display: flex; gap: 10px; }
.cap { font: 700 9px system-ui, sans-serif; letter-spacing: 1.5px; color: #7f90ad; }
.zone.slope b { font: 700 14px Consolas, monospace; color: #fff; }
.slider { writing-mode: vertical-lr; direction: rtl; height: 150px; width: 22px; accent-color: #3ee0ff; cursor: pointer; }
.zone.info { align-items: stretch; gap: 14px; }
.throttle { display: flex; flex-direction: column; gap: 4px; font: 700 9px system-ui, sans-serif; letter-spacing: 1.5px; color: #7f90ad; }
.throttle .rail { height: 8px; border-radius: 4px; background: #0b0f16; border: 1px solid #263148; overflow: hidden; }
.throttle .rail i { display: block; height: 100%; background: linear-gradient(90deg, #d98a1b, #ffd24a); transition: width 0.15s linear; }
.throttle b { font: 12px Consolas, monospace; color: #ffd24a; }
.odo { display: flex; align-items: baseline; gap: 6px; font: 13px Consolas, monospace; color: #7f90ad; }
.odo span { font-size: 22px; background: #05080d; border: 1px solid #2a3a58; padding: 3px 10px; border-radius: 6px; color: #fff; letter-spacing: 3px; box-shadow: inset 0 0 10px #000, 0 0 12px #4aa3ff22; }
.odo em { font-style: normal; font-size: 13px; }
.zone button { background: #151c28; color: #cfe0ff; border: 1px solid #2a354a; border-radius: 8px; cursor: pointer; }
.zone button.flat { padding: 2px 10px; font-size: 11px; }
.zone button.big { padding: 9px 14px; font-size: 13px; font-weight: 600; }
.zone button:hover:not(:disabled) { border-color: #3ecf8e; }
.zone button:disabled { opacity: 0.4; cursor: default; }
</style>

