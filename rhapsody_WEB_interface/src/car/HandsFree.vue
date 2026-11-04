<script setup>
import { computed } from 'vue';
import Panel from './Panel.vue';
import Light from './Light.vue';
import { car, actions } from '../core/car.js';

// The statechart owns the pairing logic; this only turns its state into a message for the driver.
const screen = computed(() => {
  if (!car.contact.value) return { title: 'Système éteint', detail: 'Mettez le contact pour activer le kit mains libres.', tone: 'off' };
  if (!car.vehicleBluetooth.value) return { title: 'Démarrage du Bluetooth…', detail: 'Veuillez patienter.', tone: 'wait' };
  if (car.connected.value) return { title: 'Téléphone connecté', detail: 'Appels et messages disponibles.', tone: 'ok' };
  return { title: 'Bluetooth prêt', detail: `En attente de jumelage. Code du kit : ${car.pin.value}`, tone: 'bt' };
});
const battery = computed(() => Math.round(car.phoneBatteryShown.value));
</script>

<template>
  <Panel title="Kit mains libres · Bluetooth">
    <template #lights>
      <Light label="BT" color="#4aa3ff" :on="car.vehicleBluetooth.value" />
      <Light label="TÉL." color="#4aa3ff" :on="car.connected.value" />
      <Light label="APPEL" color="#3ecf8e" blink :on="car.call.value" />
      <Light label="SMS" color="#ffd24a" blink :on="car.sms.value" />
    </template>
    <div class="head" :class="screen.tone">
      <div class="logo">ᛒ</div>
      <div>
        <div class="t">{{ screen.title }}</div>
        <div class="d">{{ screen.detail }}</div>
      </div>
    </div>

    <div v-if="car.connected.value" class="phone">
      <div class="row">
        <span class="name">📱 Téléphone</span>
        <span class="batt" :class="{ low: battery < 20 }">
          <span class="cell"><i :style="{ width: battery + '%' }"></i></span>
          {{ battery }}%
          <em v-if="car.charging.value">⚡ en charge</em>
        </span>
      </div>
      <div class="notif" :class="{ on: car.call.value }">📞 {{ car.call.value ? 'Appel entrant' : 'Aucun appel' }}</div>
      <div class="notif" :class="{ on: car.sms.value }">✉ {{ car.sms.value ? 'Nouveau message reçu' : 'Aucun nouveau message' }}</div>
    </div>

    <div class="tools">
      <label class="switch" :class="{ disabled: !car.online.value }">
        <input type="checkbox" :checked="car.charging.value" :disabled="!car.online.value" @change="actions.set('charging', $event.target.checked)" />
        <span class="knob"></span> Recharger le téléphone (USB véhicule)
      </label>
    </div>
  </Panel>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 14px; background: linear-gradient(135deg, #0a1322, #11203a); border: 1px solid #1f3355; margin-bottom: 8px; }
.logo { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; font-weight: 700; background: #1b2740; color: #4aa3ff; }
.head.bad .logo { color: #ff6b6b; }
.head.off .logo { color: #566; }
.head.ok .logo { background: #0b3a5e; box-shadow: 0 0 18px #4aa3ff88; color: #fff; }
.head.bt .logo { animation: pulse 1.6s infinite; }
@keyframes pulse { 50% { box-shadow: 0 0 20px #4aa3ff99; } }
.t { font: 700 14px system-ui, sans-serif; }
.d { font-size: 12px; opacity: 0.8; margin-top: 2px; }
.phone { border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; margin-bottom: 10px; display: grid; gap: 6px; }
.row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.batt { display: inline-flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
.batt em { font-style: normal; font-size: 11px; color: #ffd24a; }
.cell { width: 34px; height: 14px; border: 1.5px solid currentColor; border-radius: 3px; padding: 1px; box-sizing: border-box; }
.cell i { display: block; height: 100%; background: #3ecf8e; border-radius: 1px; }
.batt.low .cell i { background: #ff4d4d; }
.notif { font-size: 12px; opacity: 0.45; }
.notif.on { opacity: 1; color: #ffd24a; font-weight: 600; }
.tools { display: grid; gap: 10px; border-top: 1px solid var(--border); padding-top: 12px; font-size: 12px; }
.switch { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.switch.disabled { opacity: 0.5; }
.switch input { display: none; }
.knob { position: relative; width: 36px; height: 20px; border-radius: 10px; background: #2a3344; transition: background 0.2s; }
.knob::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
input:checked + .knob { background: #3ecf8e; }
input:checked + .knob::after { transform: translateX(16px); }
</style>
