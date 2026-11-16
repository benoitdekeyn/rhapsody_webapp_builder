<script setup>
import Dial from './Dial.vue';
import { car, actions } from '../core/car.js';
import { valueFromDialPoint } from '../core/dial.js';
const percent = (value, max) => Math.min(100, Math.max(0, value / max * 100));
const clampSpeed = (value) => Math.min(130, Math.max(0, value));
let speedPointer = null;
let lastSpeedRequest = null;

function updateSpeedFromPointer(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - (rect.left + rect.width / 2);
  const y = e.clientY - (rect.top + rect.height / 2);
  if (Math.hypot(x, y) < rect.width * 0.06) return;
  const value = valueFromDialPoint(x, y, 0, 130, 135, 270);
  if (value !== null && value !== lastSpeedRequest) {
    lastSpeedRequest = value;
    actions.set('vehicleAheadSpeed', value);
  }
}
function startSpeedDrag(e) {
  if (!car.online.value || e.button !== 0) return;
  e.preventDefault();
  speedPointer = e.pointerId;
  lastSpeedRequest = null;
  e.currentTarget.focus();
  e.currentTarget.setPointerCapture(e.pointerId);
  updateSpeedFromPointer(e);
}
function moveSpeedDrag(e) {
  if (car.online.value && speedPointer === e.pointerId) updateSpeedFromPointer(e);
}
function endSpeedDrag(e) {
  if (speedPointer === e.pointerId) speedPointer = null;
}
function changeSpeedByKey(e) {
  if (!car.online.value) return;
  const current = clampSpeed(car.vehicleAheadSpeed.value);
  const value = {
    ArrowRight: current + 1, ArrowUp: current + 1,
    ArrowLeft: current - 1, ArrowDown: current - 1,
    PageUp: current + 10, PageDown: current - 10,
    Home: 0, End: 130,
  }[e.key];
  if (value === undefined) return;
  e.preventDefault();
  actions.set('vehicleAheadSpeed', clampSpeed(value));
}
function setNumber(e, key) {
  actions.set(key, Number(e.target.value));
  e.target.value = car[key].value;
}
function setSimulation(e) {
  actions.set('vehicleAheadSimulation', e.target.checked);
  e.target.checked = car.vehicleAheadSimulation.value;
}
</script>

<template>
  <div class="slope" title="Pente et simulation du véhicule précédent">
    <div class="slope-control">
      <span class="cap">PENTE</span>
      <div class="slope-scene" aria-hidden="true">
        <div class="slope-road" :style="{ transform: 'translate(-50%, -50%) rotate(' + -car.slope.value + 'deg)' }">
          <svg class="slope-car" viewBox="0 0 46 22">
            <path d="M4 13l3-5 8-1 5-5h12l6 5 4 2v5H4z" fill="#d3deec" stroke="#f1f7ff" stroke-width="1" />
            <path d="M19 7l3-3h9l4 3z" fill="#33475e" />
            <circle cx="12" cy="15" r="4" fill="#070a10" stroke="#8fa2ba" stroke-width="1.5" />
            <circle cx="35" cy="15" r="4" fill="#070a10" stroke="#8fa2ba" stroke-width="1.5" />
          </svg>
        </div>
      </div>
      <input class="slope-slider" type="range" min="-20" max="20" step="1" aria-label="Pente de la route" :value="car.slope.value" :disabled="!car.online.value" @input="setNumber($event, 'slope')" />
      <b>{{ car.slope.value > 0 ? '+' : '' }}{{ car.slope.value }}°</b>
    </div>
    <div class="vehicle-simulation">
      <label class="simulation-switch">
        <span class="switch-label">Véhicule devant <small>{{ car.vehicleAheadSimulation.value ? 'Simulation active' : 'Simulation arrêtée' }}</small></span>
        <span class="switch">
          <input type="checkbox" :checked="car.vehicleAheadSimulation.value" :disabled="!car.online.value" @change="setSimulation" />
          <span class="switch-track"></span>
        </span>
      </label>

      <div class="distance-control">
        <div class="control-heading"><span>Distance</span><b>{{ Math.round(car.interVehicleDistance.value) }} <small>m</small></b></div>
        <div class="road" :class="{ offline: !car.online.value }">
          <div class="road-line"></div>
          <div class="car-icon ahead-car" title="Véhicule devant">
            <svg viewBox="0 0 54 28" aria-hidden="true">
              <path class="wheels" d="M10 3h9v3h-9zm25 0h9v3h-9zM10 22h9v3h-9zm25 0h9v3h-9z" />
              <path class="car-body" d="M4 10Q4 6 10 5L39 5Q48 6 51 10L52 14l-1 4q-3 4-12 5H10q-6-1-6-5z" />
              <path class="windows" d="M17 7h15l4 4v6l-4 4H17l-3-4v-6z" />
              <path class="windscreen" d="M36 8q5 1 7 3v6q-2 2-7 3z" />
            </svg>
          </div>
          <div class="own-track">
            <div class="car-icon own-car" :style="{ left: (100 - percent(car.interVehicleDistance.value, 50)) + '%' }">
              <svg viewBox="0 0 54 28" aria-hidden="true">
                <path class="wheels" d="M10 3h9v3h-9zm25 0h9v3h-9zM10 22h9v3h-9zm25 0h9v3h-9z" />
                <path class="car-body" d="M4 10Q4 6 10 5L39 5Q48 6 51 10L52 14l-1 4q-3 4-12 5H10q-6-1-6-5z" />
                <path class="windows" d="M17 7h15l4 4v6l-4 4H17l-3-4v-6z" />
                <path class="windscreen" d="M36 8q5 1 7 3v6q-2 2-7 3z" />
              </svg>
            </div>
            <input class="distance-slider" type="range" min="0" max="50" step="1"
              aria-label="Distance du véhicule devant" :aria-valuetext="Math.round(car.interVehicleDistance.value) + ' mètres'"
              :value="car.interVehicleDistance.value" :disabled="!car.online.value" @input="setNumber($event, 'interVehicleDistance')" />
          </div>
        </div>
        <div class="road-caption"><span>Glisser votre voiture · 0 à 50 m</span><span>Devant</span></div>
        <small v-if="car.vehicleAheadSimulation.value" class="distance-hint">La simulation peut modifier la distance.</small>
      </div>

      <div class="speed-instrument">
        <div class="speed-dial" :class="{ offline: !car.online.value }"
          role="slider" aria-label="Vitesse du véhicule devant" aria-valuemin="0" aria-valuemax="130"
          :aria-valuenow="clampSpeed(car.vehicleAheadSpeed.value)"
          :aria-valuetext="Math.round(car.vehicleAheadSpeed.value) + ' kilomètres par heure'"
          :aria-disabled="!car.online.value" :tabindex="car.online.value ? 0 : -1"
          @pointerdown="startSpeedDrag" @pointermove="moveSpeedDrag" @pointerup="endSpeedDrag"
          @pointercancel="endSpeedDrag" @lostpointercapture="endSpeedDrag" @keydown="changeSpeedByKey">
          <Dial :value="car.vehicleAheadSpeed.value" :min="0" :max="130" :major="20" :minor="10" unit="km/h" />
        </div>
        <div class="speed-detail">
          <span>Vitesse devant</span>
          <b>{{ Math.round(car.vehicleAheadSpeed.value) }} <small>km/h</small></b>
          <small>Tourner l'aiguille<br />0 à 130 km/h</small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slope { display: flex; align-items: stretch; gap: 12px; padding: 10px 12px; background: var(--panel); border: 1px solid var(--border); border-radius: 16px; color: #cfe0ff; }
.slope-control { display: flex; flex-direction: column; align-items: center; gap: 6px; padding-right: 12px; border-right: 1px solid var(--border); }
.cap { font: 700 9px system-ui, sans-serif; letter-spacing: 1.5px; color: #7f90ad; }
b { font: 700 14px Consolas, monospace; color: #fff; }
.slope-scene { position: relative; width: 72px; height: 52px; border: 1px solid #34445c; border-radius: 9px; background: linear-gradient(#1b2a3d, #101a28); overflow: hidden; }
.slope-road { position: absolute; left: 50%; top: 66%; width: 62px; height: 3px; border-radius: 2px; background: #8d9db4; }
.slope-car { position: absolute; width: 30px; left: 50%; bottom: -2px; transform: translateX(-50%) scaleX(-1); filter: drop-shadow(0 2px 2px #0008); }
.slope-slider { writing-mode: vertical-lr; direction: rtl; height: 100px; width: 22px; accent-color: #3ee0ff; cursor: pointer; }
.vehicle-simulation { display: flex; flex: 1; min-width: 190px; flex-direction: column; justify-content: space-between; gap: 9px; }
.simulation-switch, .control-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.simulation-switch { cursor: pointer; }
.switch-label { display: flex; flex-direction: column; gap: 2px; font: 700 11px system-ui, sans-serif; }
.switch-label small { color: #8c9db8; font: 500 9px system-ui, sans-serif; }
.switch { position: relative; flex: none; width: 36px; height: 20px; }
.switch input { position: absolute; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.switch-track { display: block; height: 100%; border-radius: 12px; background: #344158; box-shadow: inset 0 0 0 1px #526079; pointer-events: none; transition: background 0.2s; }
.switch-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #c5d0df; transition: transform 0.2s; }
.switch input:checked + .switch-track { background: #147c61; box-shadow: inset 0 0 0 1px #3ecf8e; }
.switch input:checked + .switch-track::after { transform: translateX(16px); background: #e6fff1; }
.switch input:focus-visible + .switch-track { outline: 2px solid #3ee0ff; outline-offset: 3px; }
.switch input:disabled + .switch-track { opacity: 0.45; }
.switch input:disabled { cursor: default; }
.distance-control { display: flex; flex-direction: column; gap: 4px; font: 600 11px system-ui, sans-serif; }
.control-heading > span { color: #9eacc2; }
.control-heading b { white-space: nowrap; }
.control-heading b small { color: #9eacc2; font: 600 9px system-ui, sans-serif; }
.road { position: relative; height: 48px; border: 1px solid #34445c; border-radius: 9px; background: linear-gradient(#1b2737, #101a28); overflow: hidden; }
.road.offline { opacity: 0.5; }
.road-line { position: absolute; inset: 50% 5px auto; height: 1px; background: repeating-linear-gradient(90deg, #71829b80 0 10px, transparent 10px 18px); }
.car-icon { position: absolute; top: 50%; width: 38px; transform: translateY(-50%); pointer-events: none; }
.car-icon svg { display: block; width: 100%; filter: drop-shadow(0 2px 3px #0009); }
.wheels { fill: #070a10; }
.car-body { fill: #d3deec; stroke: #f1f7ff; stroke-width: 1; }
.windows, .windscreen { fill: #33475e; }
.ahead-car { right: -19px; }
.ahead-car .car-body { fill: #13b5d3; stroke: #8bebfa; }
.ahead-car .windows, .ahead-car .windscreen { fill: #174259; }
.own-track { position: absolute; inset: 0 42px 0 24px; }
.own-car { transform: translate(-50%, -50%); }
.own-track:focus-within .own-car { outline: 2px solid #3ee0ff; outline-offset: 2px; border-radius: 8px; }
.distance-slider { position: absolute; inset: 0 auto 0 -19px; width: calc(100% + 38px); height: 100%; margin: 0; appearance: none; direction: rtl; opacity: 0; cursor: grab; }
.distance-slider::-webkit-slider-runnable-track { height: 100%; }
.distance-slider::-webkit-slider-thumb { width: 38px; height: 48px; appearance: none; }
.distance-slider::-moz-range-track { height: 100%; }
.distance-slider::-moz-range-thumb { width: 38px; height: 48px; border: 0; }
.distance-slider:active { cursor: grabbing; }
.distance-slider:disabled { cursor: default; }
.road-caption { display: flex; justify-content: space-between; gap: 6px; color: #7f90ad; font: 500 9px system-ui, sans-serif; }
.distance-hint { color: #b4a57f; font: 500 9px system-ui, sans-serif; }
.speed-instrument { display: flex; align-items: center; gap: 10px; }
.speed-dial { width: 86px; flex: none; border-radius: 50%; cursor: crosshair; touch-action: none; }
.speed-dial.offline { opacity: 0.45; cursor: default; }
.speed-dial:focus-visible { outline: 2px solid #3ee0ff; outline-offset: 3px; }
.speed-detail { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; color: #9eacc2; font: 600 11px system-ui, sans-serif; }
.speed-detail b small { color: #9eacc2; font: 600 9px system-ui, sans-serif; }
.speed-detail > small { color: #7f90ad; font: 500 9px/1.35 system-ui, sans-serif; }
.slope-slider:disabled { opacity: 0.45; cursor: default; }
</style>
