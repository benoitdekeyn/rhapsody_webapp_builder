<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import ModalShell from './ModalShell.vue';
import { car, actions } from '../core/car.js';

defineEmits(['close']);

const pin = ref('');
const shake = ref(false);
const clock = ref('');
let tick = null;
const updateClock = () => (clock.value = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
onMounted(() => {
  updateClock();
  tick = setInterval(updateClock, 15000);
});
onBeforeUnmount(() => clearInterval(tick));

const needsPin = computed(() => car.step.value === 'password' || car.step.value === 'wrong');
const selectable = computed(() => ['detected', 'failed'].includes(car.step.value) && !!car.deviceList.value);
const battery = computed(() => Math.round(car.phoneBattery.value));
const deviceStatus = computed(() => {
  switch (car.step.value) {
    case 'connected': return 'Connecté';
    case 'pairing': return 'Connexion…';
    case 'password':
    case 'wrong': return 'Jumelage…';
    default: return 'Non jumelé';
  }
});

watch(() => car.step.value, (s, old) => {
  if (s === 'wrong') {
    shake.value = true;
    setTimeout(() => (shake.value = false), 450);
  }
  if (s !== old) pin.value = '';
});

const digit = (d) => pin.value.length < 8 && (pin.value += d);
const back = () => (pin.value = pin.value.slice(0, -1));
async function pair() {
  const value = pin.value;
  pin.value = '';
  await actions.submitPin(value);
}
const toggleBluetooth = (e) => actions.set('bluetooth_telephone_actif', e.target.checked);
</script>

<template>
  <ModalShell title="Téléphone" :x="1010" :y="60" :width="330" @close="$emit('close')">
    <div class="phone">
      <div class="notch"></div>
      <div class="status">
        <span>{{ clock }}</span>
        <span class="icons">
          <b v-if="car.phoneBluetooth.value" :class="{ on: car.connected.value }">ᛒ</b>
          <span class="cell"><i :style="{ width: battery + '%' }" :class="{ low: battery < 20 }"></i></span>{{ battery }}%
          <em v-if="car.charging.value">⚡</em>
        </span>
      </div>

      <div class="screen">
        <h4>Réglages</h4>
        <label class="row toggle">
          <span>Bluetooth</span>
          <input type="checkbox" :checked="car.phoneBluetooth.value" :disabled="!car.online.value" @change="toggleBluetooth" />
          <span class="knob"></span>
        </label>

        <template v-if="car.phoneBluetooth.value">
          <div class="section">Appareils à proximité</div>
          <div v-if="!car.deviceList.value" class="searching"><i class="spin"></i>Recherche en cours…<small>{{ car.pairingMessage.value }}</small></div>
          <button v-else class="device" :class="{ selectable, connected: car.step.value === 'connected' }" :disabled="!selectable" @click="actions.fire('ev_ok')">
            <span class="ico">🚗</span>
            <span class="meta"><b>{{ car.deviceList.value }}</b><small>{{ deviceStatus }}</small></span>
            <span v-if="car.step.value === 'connected'" class="check">✓</span>
          </button>
          <div class="msg" :class="car.step.value">{{ car.pairingMessage.value }}</div>
        </template>
        <p v-else class="muted">Activez le Bluetooth pour jumeler le téléphone avec le kit mains libres du véhicule. Le contact doit être mis.</p>

        <template v-if="car.connected.value">
          <div class="section">Simulation</div>
          <div class="sim">
            <button :class="{ on: car.call.value }" @click="actions.set('VOYANT_vehicule_appel', !car.call.value)">📞 {{ car.call.value ? 'Raccrocher' : 'Appel entrant' }}</button>
            <button :class="{ on: car.sms.value }" @click="actions.set('VOYANT_vehicule_sms', !car.sms.value)">✉ {{ car.sms.value ? 'Marquer lu' : 'SMS reçu' }}</button>
          </div>
        </template>

        <div class="section">Batterie du téléphone</div>
        <input class="range" type="range" min="0" max="100" step="1" :value="battery" :disabled="!car.online.value" @input="actions.set('niveau_batterie_telephone', Number($event.target.value))" />

        <div v-if="needsPin" class="sheet" :class="{ shake }">
          <div class="q">Demande de jumelage</div>
          <div class="sub">{{ car.deviceList.value }}</div>
          <div class="sub">{{ car.step.value === 'wrong' ? car.pairingMessage.value : 'Saisissez le code du véhicule' }}</div>
          <div class="dots"><i v-for="n in Math.max(4, pin.length)" :key="n" :class="{ f: n <= pin.length }"></i></div>
          <div class="pad">
            <button v-for="d in ['1','2','3','4','5','6','7','8','9']" :key="d" @click="digit(d)">{{ d }}</button>
            <button class="aux" @click="pin = ''">C</button>
            <button @click="digit('0')">0</button>
            <button class="aux" @click="back">⌫</button>
          </div>
          <button class="go" :disabled="!pin" @click="pair">Jumeler</button>
        </div>
      </div>
    </div>
  </ModalShell>
</template>

<style scoped>
.phone { position: relative; margin: 0 auto; width: 270px; height: 500px; border-radius: 38px; background: #05070b; border: 6px solid #2b3345; box-shadow: 0 0 0 2px #0c0f16, 0 14px 30px #000a; overflow: hidden; color: #f2f5fb; display: flex; flex-direction: column; }
.notch { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 80px; height: 18px; background: #000; border-radius: 12px; z-index: 3; }
.status { display: flex; justify-content: space-between; align-items: center; padding: 10px 22px 6px; font: 600 11px system-ui, sans-serif; z-index: 2; }
.icons { display: inline-flex; align-items: center; gap: 5px; }
.icons b { color: #8aa; font-size: 12px; }
.icons b.on { color: #4aa3ff; }
.icons em { font-style: normal; color: #ffd24a; }
.cell { width: 22px; height: 10px; border: 1.2px solid #cfd6e4; border-radius: 3px; padding: 1px; box-sizing: border-box; display: inline-block; }
.cell i { display: block; height: 100%; background: #3ecf8e; border-radius: 1px; }
.cell i.low { background: #ff4d4d; }
.screen { position: relative; flex: 1; padding: 10px 16px 16px; overflow: hidden auto; background: linear-gradient(#0c1220, #070a12); }
h4 { margin: 6px 0 10px; font: 700 20px system-ui, sans-serif; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 12px; background: #141b2b; font-size: 14px; }
.toggle input { display: none; }
.knob { position: relative; width: 42px; height: 24px; border-radius: 12px; background: #3a4357; transition: background 0.2s; }
.knob::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
input:checked ~ .knob { background: #34c759; }
input:checked ~ .knob::after { transform: translateX(18px); }
.section { margin: 14px 4px 6px; font: 600 10px system-ui, sans-serif; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.55; }
.searching { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px; font-size: 13px; opacity: 0.85; background: #141b2b; border-radius: 12px; }
.searching small { opacity: 0.6; font-size: 11px; }
.spin { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #4aa3ff44; border-top-color: #4aa3ff; animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.device { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: #141b2b; border: 1px solid transparent; color: inherit; text-align: left; font: inherit; cursor: default; }
.device.selectable { border-color: #4aa3ff; cursor: pointer; animation: glow 1.4s infinite; }
@keyframes glow { 50% { box-shadow: 0 0 12px #4aa3ff66; } }
.ico { font-size: 22px; }
.meta { flex: 1; display: flex; flex-direction: column; }
.meta small { opacity: 0.6; font-size: 11px; }
.check { color: #34c759; font-size: 18px; }
.msg { margin: 8px 4px 0; font-size: 12px; color: #9fb2cf; }
.msg.wrong, .msg.failed { color: #ff6b6b; }
.msg.connected, .msg.pairing { color: #34c759; }
.muted { font-size: 12px; opacity: 0.6; line-height: 1.5; }
.sim { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sim button { padding: 10px 6px; border-radius: 12px; border: 1px solid #263148; background: #141b2b; color: inherit; font-size: 12px; cursor: pointer; }
.sim button.on { background: #1f6f3d; border-color: #34c759; }
.range { width: 100%; accent-color: #34c759; }
.sheet { position: absolute; inset: 0; padding: 16px; background: #0b101ce6; backdrop-filter: blur(6px); display: flex; flex-direction: column; align-items: center; gap: 4px; z-index: 4; }
.sheet.shake { animation: shake 0.4s; }
@keyframes shake { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
.q { font: 700 16px system-ui, sans-serif; margin-top: 14px; }
.sub { font-size: 12px; opacity: 0.7; text-align: center; }
.dots { display: flex; gap: 10px; margin: 12px 0; }
.dots i { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid #8aa; }
.dots i.f { background: #fff; border-color: #fff; }
.pad { display: grid; grid-template-columns: repeat(3, 58px); gap: 8px; }
.pad button { height: 44px; border-radius: 50%; border: 0; background: #1d2638; color: #fff; font: 600 18px system-ui, sans-serif; cursor: pointer; }
.pad button:active { background: #34415c; }
.pad .aux { background: transparent; font-size: 15px; opacity: 0.8; }
.go { margin-top: 12px; padding: 10px 30px; border-radius: 22px; border: 0; background: #34c759; color: #04140d; font: 700 14px system-ui, sans-serif; cursor: pointer; }
.go:disabled { opacity: 0.4; cursor: default; }
</style>
