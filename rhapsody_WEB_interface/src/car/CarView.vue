<script setup>
import { ref, computed } from 'vue';
import Cluster from './Cluster.vue';
import IgnitionKey from './IgnitionKey.vue';
import PedalControl from './PedalControl.vue';
import SpeedControlModal from './SpeedControlModal.vue';
import HandsFreeModal from './HandsFreeModal.vue';
import PhoneModal from './PhoneModal.vue';
import { car, actions } from '../core/car.js';

const open = ref({ speed: false, kit: false, phone: false });
const toggle = (k) => (open.value[k] = !open.value[k]);

const alerts = computed(() => {
  const out = [];
  if (car.fuelLow.value) out.push({ key: 'fuel', text: 'Réservoir presque vide — le moteur s’arrête sans carburant', action: 'Faire le plein', run: () => actions.fire('ev_remplir_carburant') });
  if (car.batteryLow.value) out.push({ key: 'batt', text: 'Batterie faible — le moteur ne démarre plus', action: 'Dépanner la batterie', run: () => actions.fire('ev_depanner_batterie') });
  return out;
});

const badges = computed(() => ({
  speed: car.mode.value === 'cruise' ? 'CRUISE' : car.mode.value === 'limiter' ? 'LIMIT' : '',
  kit: car.connected.value ? 'connecté' : car.vehicleBluetooth.value ? 'BT actif' : '',
  phone: car.call.value ? 'appel' : car.sms.value ? 'SMS' : car.phoneBluetooth.value ? 'BT' : '',
}));
</script>

<template>
  <div class="car">
    <div v-for="a in alerts" :key="a.key" class="alert">
      <span>⚠ {{ a.text }}</span>
      <button :disabled="!car.online.value" @click="a.run">{{ a.action }}</button>
    </div>

    <Cluster />

    <div class="deck">
      <div class="col key">
        <IgnitionKey />
        <div class="garage">
          <button :disabled="!car.online.value" @click="actions.fire('ev_remplir_carburant')">⛽ Faire le plein</button>
          <button :disabled="!car.online.value" @click="actions.fire('ev_depanner_batterie')">🔋 Dépanner batterie</button>
        </div>
      </div>

      <div class="col center">
        <div class="menu">
          <button class="tile" :class="{ active: open.speed }" @click="toggle('speed')">
            <span class="ico">⏱</span><b>Régulateur<br />Limiteur</b><em v-if="badges.speed">{{ badges.speed }}</em>
          </button>
          <button class="tile" :class="{ active: open.kit }" @click="toggle('kit')">
            <span class="ico">🔊</span><b>Kit mains libres<br />Bluetooth</b><em v-if="badges.kit">{{ badges.kit }}</em>
          </button>
          <button class="tile" :class="{ active: open.phone }" @click="toggle('phone')">
            <span class="ico">📱</span><b>Téléphone</b><em v-if="badges.phone">{{ badges.phone }}</em>
          </button>
        </div>
        <p class="tip">Les fenêtres sont déplaçables et peuvent rester ouvertes ensemble.</p>
      </div>

      <div class="col pedals">
        <PedalControl attribute="brakePedal" label="Frein" kind="brake" />
        <PedalControl attribute="accelPedal" label="Accélérateur" kind="accel" />
      </div>
    </div>

    <SpeedControlModal v-if="open.speed" @close="open.speed = false" />
    <HandsFreeModal v-if="open.kit" @close="open.kit = false" />
    <PhoneModal v-if="open.phone" @close="open.phone = false" />
  </div>
</template>

<style scoped>
.car { max-width: 980px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
.alert { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-radius: 12px; background: #ffb02018; border: 1px solid #ffb02088; color: #ffb020; font-size: 13px; }
.alert button { background: #ffb020; color: #1b1100; border: 0; border-radius: 8px; padding: 6px 12px; font-weight: 700; cursor: pointer; }
.deck { display: grid; grid-template-columns: auto 1fr auto; gap: 22px; align-items: start; background: var(--panel); border: 1px solid var(--border); border-radius: 24px; padding: 22px; }
.col { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.pedals { flex-direction: row; align-items: flex-end; gap: 26px; }
.garage { display: grid; gap: 8px; width: 100%; }
.garage button { padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border); background: transparent; color: var(--text); font-size: 12px; cursor: pointer; }
.garage button:hover:not(:disabled) { border-color: #3ecf8e; }
.garage button:disabled { opacity: 0.4; cursor: default; }
.menu { display: grid; gap: 12px; width: 100%; max-width: 280px; }
.tile { position: relative; display: flex; align-items: center; gap: 14px; text-align: left; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--border); background: linear-gradient(#202a3c, #151c29); color: var(--text); cursor: pointer; transition: transform 0.1s, border-color 0.2s; }
.tile:hover { border-color: #4aa3ff; }
.tile:active { transform: scale(0.98); }
.tile.active { border-color: #3ecf8e; box-shadow: 0 0 16px #3ecf8e33; }
.tile .ico { font-size: 28px; }
.tile b { font-size: 13px; line-height: 1.3; }
.tile em { position: absolute; top: 8px; right: 10px; font: 700 9px system-ui, sans-serif; letter-spacing: 1px; padding: 2px 7px; border-radius: 999px; background: #3ecf8e; color: #04140d; text-transform: uppercase; font-style: normal; }
.tip { font-size: 11px; opacity: 0.5; text-align: center; margin: 0; }
@media (max-width: 800px) { .deck { grid-template-columns: 1fr; justify-items: center; } }
</style>
