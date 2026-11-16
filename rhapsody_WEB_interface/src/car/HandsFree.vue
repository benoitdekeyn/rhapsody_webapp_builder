<script setup>
import { computed } from 'vue';
import Panel from './Panel.vue';
import Light from './Light.vue';
import { car, actions } from '../core/car.js';

// The statechart owns the pairing logic; this only turns its state into a message for the driver.
const screen = computed(() => {
  if (!car.contact.value) return { title: 'Système éteint', detail: 'Mettez le contact pour activer le kit mains libres.', tone: 'off' };
  if (!car.vehicleBluetooth.value) return { title: 'Démarrage du Bluetooth…', detail: 'Veuillez patienter.', tone: 'wait' };
  if (car.phoneConnected.value) return { title: 'Téléphone connecté', detail: 'Appels et messages disponibles.', tone: 'ok' };
  return { title: 'Bluetooth prêt', detail: `En attente de jumelage. Code du kit : ${car.pin.value}`, tone: 'bt' };
});
const battery = computed(() => Math.round(car.kitBatteryLevel.value));
const callStatus = computed(() => {
  if (car.ringing.value) return 'Appel entrant';
  if (car.call.value || car.phoneCallActive.value) return 'Communication en cours';
  return 'Aucun appel';
});
const canAnswer = computed(() => car.ringing.value);
const canHangUp = computed(() => car.ringing.value || car.call.value || car.phoneCallActive.value);
const canReadSms = computed(() => car.kitSmsCount.value > 0 && car.speedInteger.value <= 0);
</script>

<template>
  <Panel title="Kit mains libres · Bluetooth" :scrollable="false">
    <template #lights>
      <Light label="BT" color="#4aa3ff" :on="car.vehicleBluetooth.value" />
      <Light label="TÉL." color="#4aa3ff" :on="car.phoneConnected.value" />
      <Light label="APPEL" color="#3ecf8e" :on="car.call.value" />
      <Light label="SMS" color="#ffd24a" :on="car.sms.value" />
    </template>
    <div class="head" :class="screen.tone">
      <div class="logo">ᛒ</div>
      <div>
        <div class="t">{{ screen.title }}</div>
        <div class="d">{{ screen.detail }}</div>
      </div>
    </div>

    <div v-if="car.phoneConnected.value" class="phone">
      <div class="row">
        <span class="name">📱 Téléphone</span>
        <span class="batt" :class="{ low: battery < 20 }">
          <span class="cell"><i :style="{ width: battery + '%' }"></i></span>
          {{ battery }}%
          <em v-if="car.charging.value">⚡ USB branché</em>
        </span>
      </div>
    </div>

    <div v-if="car.phoneConnected.value" class="communication">
      <div class="call-status" :class="{ ringing: car.ringing.value, active: canHangUp }">
        <span>📞 {{ callStatus }}</span>
        <div class="call-actions">
          <button class="answer" :disabled="!car.online.value || !canAnswer" @click="actions.fire('kitAnswerButton')">Décrocher</button>
          <button class="hang-up" :disabled="!car.online.value || !canHangUp" @click="actions.fire('kitHangUpButton')">Raccrocher</button>
        </div>
      </div>

      <div class="sms">
        <div class="sms-summary">
          <span>Messages en attente</span>
          <b>{{ car.kitSmsCount.value }}</b>
        </div>
        <button class="read-sms" :disabled="!car.online.value || !canReadSms" @click="actions.fire('kitReadSms')">
          {{ car.kitSmsCount.value ? 'Lire le prochain message' : 'Aucun message à lire' }}
        </button>
        <small v-if="car.speedInteger.value > 0" class="hint">Arrêtez le véhicule pour lire un message.</small>
        <small v-else class="hint">La lecture est déclenchée par le kit mains libres.</small>
      </div>
    </div>

  </Panel>
</template>

<style scoped>
:deep(header) { flex-wrap: wrap; }
.head { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 14px; background: linear-gradient(135deg, #0a1322, #11203a); border: 1px solid #1f3355; margin-bottom: 8px; }
.logo { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; font-weight: 700; background: #1b2740; color: #4aa3ff; }
.head.bad .logo { color: #ff6b6b; }
.head.off .logo { color: #566; }
.head.ok .logo { background: #0b3a5e; box-shadow: 0 0 18px #4aa3ff88; color: #fff; }
.head.bt .logo { animation: pulse 1.6s infinite; }
@keyframes pulse { 50% { box-shadow: 0 0 20px #4aa3ff99; } }
.t { font: 700 14px system-ui, sans-serif; }
.d { font-size: 12px; opacity: 0.8; margin-top: 2px; }
.phone { border: 1px solid var(--border); border-radius: 12px; padding: 7px 10px; margin-bottom: 8px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; justify-content: space-between; align-items: center; font-size: 13px; }
.batt { display: inline-flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
.batt em { font-style: normal; font-size: 11px; color: #ffd24a; }
.cell { width: 34px; height: 14px; border: 1.5px solid currentColor; border-radius: 3px; padding: 1px; box-sizing: border-box; }
.cell i { display: block; height: 100%; background: #3ecf8e; border-radius: 1px; }
.batt.low .cell i { background: #ff4d4d; }
.communication { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.call-status, .sms { border: 1px solid var(--border); border-radius: 12px; padding: 9px 10px; }
.call-status { display: grid; gap: 8px; font-size: 12px; }
.call-status.ringing { border-color: #ffb020; color: #ffd27b; }
.call-status.active { border-color: #3ecf8e; }
.call-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.call-actions button, .read-sms { padding: 8px 10px; border: 1px solid var(--border); border-radius: 9px; color: var(--text); background: #1a2433; font: 700 11px system-ui, sans-serif; cursor: pointer; }
.call-actions .answer:not(:disabled) { background: #155936; border-color: #3ecf8e; color: #e6fff1; }
.call-actions .hang-up:not(:disabled) { background: #662b32; border-color: #ff6b6b; color: #fff0f0; }
.call-actions button:disabled, .read-sms:disabled { opacity: 0.42; cursor: default; }
.sms { display: grid; gap: 7px; }
.sms-summary { display: flex; align-items: center; justify-content: space-between; font-size: 12px; }
.sms-summary b { min-width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: #263650; color: #fff; font: 700 14px Consolas, monospace; }
.read-sms:not(:disabled) { border-color: #4aa3ff; background: #122b48; }
.hint { color: #98a8c0; font-size: 10px; line-height: 1.35; }
@media (max-width: 500px) {
  .communication { grid-template-columns: minmax(0, 1fr); }
}
</style>
