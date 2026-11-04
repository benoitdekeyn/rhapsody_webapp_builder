<script setup>
import { computed } from 'vue';
import ModalShell from './ModalShell.vue';
import { car, actions } from '../core/car.js';

defineEmits(['close']);

const steps = computed(() => {
  const s = car.step.value;
  const rank = { phone_off: 1, searching: 2, detected: 3, password: 4, wrong: 4, failed: 3, pairing: 5, connected: 6 }[s] ?? 1;
  const list = [
    { text: 'Contact mis (Bluetooth du véhicule actif)', ok: car.vehicleBluetooth.value },
    { text: 'Bluetooth du téléphone activé', ok: rank >= 2 && car.phoneBluetooth.value },
    { text: 'Kit détecté par le téléphone', ok: rank >= 3 },
    { text: 'Code de jumelage saisi', ok: rank >= 5 },
    { text: 'Téléphone connecté au kit', ok: car.connected.value },
  ];
  const firstTodo = list.findIndex((x) => !x.ok);
  return list.map((x, i) => ({ ...x, current: i === firstTodo }));
});

const screen = computed(() => {
  if (!car.contact.value) return { title: 'Système éteint', detail: 'Mettez le contact pour activer le kit mains libres.', tone: 'off' };
  if (!car.vehicleBluetooth.value) return { title: 'Démarrage du Bluetooth…', detail: '', tone: 'wait' };
  if (car.connected.value) return { title: 'Téléphone connecté', detail: 'Appels et messages disponibles', tone: 'ok' };
  return { title: 'Bluetooth actif', detail: `En attente d'un téléphone — code de jumelage ${car.pin.value || '----'}`, tone: 'bt' };
});
const battery = computed(() => Math.round(car.phoneBatteryShown.value));
function setPin(e) {
  actions.set('mot_de_passe', e.target.value);
}
</script>

<template>
  <ModalShell title="Kit mains libres · Bluetooth" :x="540" :y="90" :width="440" @close="$emit('close')">
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

    <ol class="steps">
      <li v-for="(s, i) in steps" :key="i" :class="{ ok: s.ok, cur: s.current }"><i>{{ s.ok ? '✓' : i + 1 }}</i>{{ s.text }}</li>
    </ol>

    <div class="tools">
      <label class="switch" :class="{ disabled: !car.online.value }">
        <input type="checkbox" :checked="car.charging.value" :disabled="!car.online.value" @change="actions.set('charge_vehicule_telephone', $event.target.checked)" />
        <span class="knob"></span> Recharger le téléphone (USB véhicule)
      </label>
      <label class="pin">
        Code de jumelage du kit
        <input type="text" maxlength="8" :value="car.pin.value" :disabled="!car.online.value" @change="setPin" />
      </label>
      <button class="forget" :disabled="!car.online.value || (!car.kitPaired.value && !car.phoneBluetooth.value)" @click="actions.forgetPhone()">Oublier le téléphone</button>
    </div>
  </ModalShell>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: 14px; background: linear-gradient(135deg, #0a1322, #11203a); border: 1px solid #1f3355; margin-bottom: 14px; }
.logo { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; font-size: 26px; font-weight: 700; background: #1b2740; color: #4aa3ff; }
.head.off .logo { color: #566; }
.head.ok .logo { background: #0b3a5e; box-shadow: 0 0 18px #4aa3ff88; color: #fff; }
.head.bt .logo { animation: pulse 1.6s infinite; }
@keyframes pulse { 50% { box-shadow: 0 0 20px #4aa3ff99; } }
.t { font: 700 16px system-ui, sans-serif; }
.d { font-size: 12px; opacity: 0.7; margin-top: 2px; }
.phone { border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; margin-bottom: 14px; display: grid; gap: 6px; }
.row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.batt { display: inline-flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
.batt em { font-style: normal; font-size: 11px; color: #ffd24a; }
.cell { width: 34px; height: 14px; border: 1.5px solid currentColor; border-radius: 3px; padding: 1px; box-sizing: border-box; }
.cell i { display: block; height: 100%; background: #3ecf8e; border-radius: 1px; }
.batt.low .cell i { background: #ff4d4d; }
.notif { font-size: 12px; opacity: 0.45; }
.notif.on { opacity: 1; color: #ffd24a; font-weight: 600; }
.steps { list-style: none; padding: 0; margin: 0 0 14px; display: grid; gap: 6px; font-size: 12px; }
.steps li { display: flex; align-items: center; gap: 10px; opacity: 0.55; }
.steps li.ok { opacity: 1; color: #3ecf8e; }
.steps li.cur { opacity: 1; color: #ffd24a; }
.steps i { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-size: 11px; border: 1px solid currentColor; }
.tools { display: grid; gap: 10px; border-top: 1px solid var(--border); padding-top: 12px; font-size: 12px; }
.switch { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.switch.disabled { opacity: 0.5; }
.switch input { display: none; }
.knob { position: relative; width: 36px; height: 20px; border-radius: 10px; background: #2a3344; transition: background 0.2s; }
.knob::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
input:checked + .knob { background: #3ecf8e; }
input:checked + .knob::after { transform: translateX(16px); }
.pin { display: flex; align-items: center; gap: 10px; }
.pin input { width: 80px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 5px 8px; letter-spacing: 3px; text-align: center; }
.forget { justify-self: start; background: #ff4d4d22; color: #ff6b6b; border: 1px solid #ff4d4d66; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
.forget:disabled { opacity: 0.4; cursor: default; }
</style>
