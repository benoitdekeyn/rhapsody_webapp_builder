<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { car, actions } from '../core/car.js';

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
const callStatus = computed(() => {
  if (car.ringing.value) return 'Appel entrant';
  if (car.phoneCallActive.value) return 'Appel en cours';
  return 'Aucun appel';
});
const canAnswer = computed(() => !car.vehicleConnected.value && car.ringing.value);
const canHangUp = computed(() => !car.vehicleConnected.value && (car.ringing.value || car.phoneCallActive.value));
const canReadSms = computed(() => !car.vehicleConnected.value && car.phoneSmsCount.value > 0);
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
  if (await actions.submitPin(value)) pin.value = '';
}
function toggleBluetooth(e) {
  actions.set('phoneBluetooth', e.target.checked);
  e.target.checked = car.phoneBluetooth.value;
}
const togglePhone = () => actions.set('phoneOn', !car.phoneOn.value);
const toggleCharging = () => actions.set('charging', !car.charging.value);
</script>

<template>
  <div class="holder">
    <div class="external-simulation">
      <span class="simulation-title">Simulation externe</span>
      <div class="simulation-buttons">
        <button :disabled="!car.online.value" @click="actions.fire('incomingCall')">📞 Appeler</button>
        <button :disabled="!car.online.value" @click="actions.fire('incomingSms')">✉ SMS</button>
      </div>
    </div>
    <div class="phone" :class="{ off: !car.phoneOn.value }">
      <div class="notch"></div>
      <div v-if="car.phoneOn.value" class="status">
        <span>{{ clock }}</span>
        <span class="icons">
          <b v-if="car.phoneBluetooth.value" :class="{ on: car.vehicleConnected.value }">ᛒ</b>
          <span class="batt"><span class="cell"><i :style="{ width: battery + '%' }" :class="{ low: battery < 20 }"></i></span></span>
          <span class="pct">{{ battery }}%</span>
          <em :style="{ visibility: car.charging.value ? 'visible' : 'hidden' }">⚡</em>
        </span>
      </div>

      <div class="screen" :class="{ off: !car.phoneOn.value }">
        <label v-if="car.phoneOn.value" class="row toggle">
          <span>Bluetooth</span>
          <input type="checkbox" :checked="car.phoneBluetooth.value" :disabled="!car.online.value" @change="toggleBluetooth" />
          <span class="knob"></span>
        </label>

        <template v-if="car.phoneOn.value && car.phoneBluetooth.value">
          <div class="section">Appareils à proximité</div>
          <div v-if="!car.deviceList.value" class="searching"><i class="spin"></i>Recherche en cours…<small>{{ car.pairingMessage.value }}</small></div>
          <button v-else class="device" :class="{ selectable, connected: car.step.value === 'connected' }" :disabled="!car.online.value || !selectable" @click="actions.fire('selectDevice')">
            <span class="ico">🚗</span>
            <span class="meta"><b>{{ car.deviceList.value }}</b><small>{{ deviceStatus }}</small></span>
            <span v-if="car.step.value === 'connected'" class="check">✓</span>
          </button>
          <div class="msg" :class="car.step.value">{{ car.pairingMessage.value }}</div>
        </template>
        <p v-else-if="car.phoneOn.value" class="muted">Activez le Bluetooth pour jumeler le téléphone avec le kit mains libres du véhicule. Le contact doit être mis.</p>

        <template v-if="car.phoneOn.value">
          <div class="section">Téléphone</div>
          <div class="phone-call" :class="{ ringing: car.ringing.value, active: car.phoneCallActive.value }">
            <span>📞 {{ callStatus }}</span>
            <div class="phone-call-buttons">
              <button class="answer" :disabled="!car.online.value || !canAnswer" @click="actions.fire('phoneAnswer')">Décrocher</button>
              <button class="hang-up" :disabled="!car.online.value || !canHangUp" @click="actions.fire('phoneHangUp')">Raccrocher</button>
            </div>
          </div>
          <div class="phone-sms">
            <span>SMS reçus <b>{{ car.phoneSmsCount.value }}</b></span>
            <button :disabled="!car.online.value || !canReadSms" @click="actions.fire('phoneReadSms')">Lire un SMS</button>
          </div>
          <p v-if="car.vehicleConnected.value" class="muted">Appels et lecture des SMS dirigés vers le kit mains libres.</p>
        </template>


        <div v-if="car.phoneOn.value && needsPin" class="sheet" :class="{ shake }">
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
      <div class="power-bar" :class="{ off: !car.phoneOn.value }">
        <button class="power" :class="{ on: car.phoneOn.value }" :disabled="!car.online.value" @click="togglePhone">
          <span aria-hidden="true">⏻</span>{{ car.phoneOn.value ? 'Éteindre' : 'Allumer' }}
        </button>
      </div>
    </div>
    <div class="charging-control">
      <button
        class="usb-button"
        :class="{ connected: car.charging.value }"
        :disabled="!car.online.value"
        :aria-pressed="car.charging.value"
        :aria-label="car.charging.value ? 'Débrancher le câble USB' : 'Brancher le câble USB'"
        :title="car.charging.value ? 'Débrancher le câble USB' : 'Brancher le câble USB'"
        @click="toggleCharging"
      >
        <svg class="usb-cable" viewBox="0 0 40 42" aria-hidden="true">
          <g class="usb-assembly">
            <path class="cable" d="M20 21v8c0 7 9 6 9 13" />
            <path class="cable-highlight" d="M19 22v7c0 7 9 6 9 13" />
            <rect class="usb-tip" x="14" y="0" width="12" height="8" rx="2" />
            <path class="usb-tip-detail" d="M16 3h8" />
            <path class="usb-plug" d="M11 7h18v10a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4z" />
            <path class="usb-plug-detail" d="M14 9h12M15 18h10" />
          </g>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.holder { height: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.external-simulation { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--border); border-radius: 14px; background: var(--panel); }
.simulation-title { display: block; margin-bottom: 6px; color: #8d9db7; font: 700 9px system-ui, sans-serif; letter-spacing: 1.2px; text-transform: uppercase; }
.simulation-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.simulation-buttons button { min-width: 0; padding: 8px 4px; border: 1px solid #34445e; border-radius: 9px; background: #1a2433; color: #e8eef7; font: 700 11px system-ui, sans-serif; cursor: pointer; }
.simulation-buttons button:disabled { opacity: 0.4; cursor: default; }
.phone { position: relative; z-index: 1; flex: 1; min-height: 0; width: 100%; box-sizing: border-box; border-radius: 38px; background: #05070b; border: 6px solid #2b3345; box-shadow: 0 0 0 2px #0c0f16, 0 14px 30px #000a; overflow: hidden; color: #f2f5fb; display: flex; flex-direction: column; }
.phone.off { background: #000; }
.phone::after { content: ''; position: absolute; z-index: 3; bottom: 0; left: 50%; width: 20px; height: 4px; transform: translateX(-50%); border-radius: 4px 4px 0 0; background: #020306; }
.charging-control { width: 100%; flex: none; display: flex; justify-content: center; margin-top: -8px; }
.usb-button { display: flex; align-items: center; justify-content: center; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; cursor: pointer; }
.usb-button:disabled { opacity: 0.45; cursor: default; }
.usb-button:focus-visible { outline: 2px solid #4aa3ff; outline-offset: 2px; }
.usb-cable { width: 40px; height: 42px; overflow: visible; flex: none; }
.usb-assembly { transform: translateY(6px); transition: transform 0.2s ease; }
.connected .usb-assembly { transform: translateY(-7px); }
.usb-tip { fill: #aeb5bc; stroke: #6b747e; stroke-width: 1; }
.usb-tip-detail { fill: none; stroke: #707982; stroke-width: 1; }
.usb-plug { fill: #737b84; stroke: #a3aab1; stroke-width: 1; }
.usb-plug-detail { fill: none; stroke: #b6bdc3; stroke-width: 0.8; }
.cable { fill: none; stroke: #373d44; stroke-width: 5; stroke-linecap: round; }
.cable-highlight { fill: none; stroke: #737b84; stroke-width: 1; stroke-linecap: round; }
.notch { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 56px; height: 16px; background: #000; border-radius: 12px; z-index: 1; }
.status { position: relative; display: flex; justify-content: space-between; align-items: center; padding: 10px 16px 6px; font: 600 11px system-ui, sans-serif; z-index: 2; }
.icons { display: inline-flex; align-items: center; gap: 5px; }
.icons b { color: #8aa; font-size: 12px; }
.icons b.on { color: #4aa3ff; }
.icons em { font-style: normal; color: #ffd24a; width: 10px; text-align: center; flex: none; }
.icons .pct { white-space: nowrap; flex: none; }
.icons .batt { display: inline-flex; align-items: center; flex: none; margin-left: 2px; }
.icons .batt::after { content: ''; width: 2px; height: 5px; background: #cfd6e4; border-radius: 0 1px 1px 0; }
.cell { width: 22px; height: 11px; border: 1px solid #cfd6e4; border-radius: 3px; padding: 1px; box-sizing: border-box; display: inline-block; flex: none; overflow: hidden; }
.cell i { display: block; height: 100%; background: #3ecf8e; border-radius: 1px; }
.cell i.low { background: #ff4d4d; }
.screen { position: relative; flex: 1; min-height: 0; padding: 10px 16px 16px; overflow: hidden auto; background: linear-gradient(#0c1220, #070a12); }
.screen.off { background: #000; }
.power-bar { flex: none; display: flex; justify-content: center; padding: 4px 12px 12px; background: #070a12; }
.power-bar.off { background: #000; }
.power { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border: 1px solid #34c759; border-radius: 10px; background: #34c759; color: #04140d; font: 800 11px system-ui, sans-serif; cursor: pointer; white-space: nowrap; box-shadow: 0 0 14px #34c75955; }
.power span { font-size: 17px; line-height: 1; }
.power.on { border-color: #ff6b6b; background: #ff4d4d; color: #200707; box-shadow: 0 0 14px #ff4d4d55; }
.power:disabled { opacity: 0.45; cursor: default; box-shadow: none; }
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
.phone-call, .phone-sms { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 8px 10px; border: 1px solid #263148; border-radius: 10px; background: #141b2b; font-size: 11px; }
.phone-call { align-items: stretch; flex-direction: column; }
.phone-sms { margin-top: 10px; }
.phone-call.ringing { border-color: #ffb020; color: #ffd27b; }
.phone-call.active { border-color: #3ecf8e; }
.phone-call-buttons { display: flex; gap: 5px; }
.phone-call-buttons button { flex: 1; }
.phone-call-buttons button, .phone-sms button { padding: 6px 7px; border: 1px solid #34445e; border-radius: 8px; background: #1a2433; color: inherit; font: 700 9px system-ui, sans-serif; cursor: pointer; white-space: nowrap; }
.phone-call-buttons .answer:not(:disabled) { border-color: #3ecf8e; background: #155936; }
.phone-call-buttons .hang-up:not(:disabled) { border-color: #ff6b6b; background: #662b32; }
.phone-sms > span { display: flex; align-items: center; gap: 7px; }
.phone-sms b { min-width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: #263650; font: 700 11px Consolas, monospace; }
.phone-call-buttons button:disabled, .phone-sms button:disabled { opacity: 0.42; cursor: default; }
.sheet { position: absolute; inset: 0; padding: 16px; background: #0b101ce6; backdrop-filter: blur(6px); display: flex; flex-direction: column; align-items: center; gap: 4px; z-index: 4; }
.sheet.shake { animation: shake 0.4s; }
@keyframes shake { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
.q { font: 700 16px system-ui, sans-serif; margin-top: 14px; }
.sub { font-size: 12px; opacity: 0.7; text-align: center; }
.dots { display: flex; gap: 10px; margin: 12px 0; }
.dots i { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid #8aa; }
.dots i.f { background: #fff; border-color: #fff; }
.pad { display: grid; grid-template-columns: repeat(3, 44px); gap: 8px; }
.pad button { height: 44px; border-radius: 50%; border: 0; background: #1d2638; color: #fff; font: 600 18px system-ui, sans-serif; cursor: pointer; }
.pad button:active { background: #34415c; }
.pad .aux { background: transparent; font-size: 15px; opacity: 0.8; }
.go { margin-top: 12px; padding: 10px 30px; border-radius: 22px; border: 0; background: #34c759; color: #04140d; font: 700 14px system-ui, sans-serif; cursor: pointer; }
.go:disabled { opacity: 0.4; cursor: default; }
</style>
