// Vehicle-level view of the Rhapsody model: typed reads and the actions used by the realistic interface.
import { computed } from 'vue';
import { store, attributeValue, writeAttribute, fireEvent } from './store.js';

const num = (name, fallback = 0) => {
  const v = attributeValue(name);
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};
const flag = (name) => attributeValue(name) === true;
const text = (name) => {
  const v = attributeValue(name);
  return typeof v === 'string' ? v : '';
};

// Steps of the Bluetooth pairing as seen from the phone (messages_appairage[] are the engine's own texts).
export function pairingStep({ phoneBluetooth, connected, message, messages }) {
  if (!phoneBluetooth) return 'phone_off';
  if (connected) return 'connected';
  const i = Array.isArray(messages) ? messages.indexOf(message) : -1;
  return ['searching', 'detected', 'password', 'wrong', 'pairing', 'failed'][i] || 'searching';
}

export function speedScaleMax(maxSpeed) {
  return Math.max(60, Math.ceil((maxSpeed + 20) / 20) * 20);
}

export const car = {
  online: computed(() => store.connected),
  speed: computed(() => num('float_speed', num('speed'))),
  maxSpeed: computed(() => num('PARAM_SIMU_max_speed', 120)),
  fuel: computed(() => num('reservoir_carburant')),
  battery: computed(() => num('niveau_batterie')),
  fuelLow: computed(() => flag('carburant_faible')),
  batteryLow: computed(() => flag('batterie_faible')),
  fuelThreshold: computed(() => num('SEUIL_carburant', 5)),
  batteryThreshold: computed(() => num('SEUIL_batterie', 40)),
  distanceKm: computed(() => num('float_distance', num('distance')) / 1000),
  contact: computed(() => flag('cmd_contact')),
  engine: computed(() => flag('ignition')),
  accel: computed(() => num('accelPedal')),
  brake: computed(() => num('brakePedal')),
  cruise: computed(() => flag('voyant_regulateur')),
  limiter: computed(() => flag('voyant_limiteur')),
  limiterWaiting: computed(() => flag('limiteur_attente')),
  limiterExceeded: computed(() => flag('limiteur_depasse')),
  setpoint: computed(() => num('vitesseConsigne')),
  initialLimit: computed(() => num('valeur_initiale_limiteur', 50)),
  vehicleBluetooth: computed(() => flag('VOYANT_bluetooth_vehicule')),
  vehicleConnected: computed(() => flag('VOYANT_vehicule_connecte')),
  phoneConnected: computed(() => flag('VOYANT_telephone_connecte')),
  phoneBluetooth: computed(() => flag('bluetooth_telephone_actif')),
  phoneBattery: computed(() => num('niveau_batterie_telephone')),
  phoneBatteryShown: computed(() => num('niveau_batterie_telephone_vehicule_affichee')),
  charging: computed(() => flag('charge_vehicule_telephone')),
  call: computed(() => flag('VOYANT_vehicule_appel')),
  sms: computed(() => flag('VOYANT_vehicule_sms')),
  kitPaired: computed(() => flag('kit_jumele')),
  pin: computed(() => text('mot_de_passe')),
  deviceList: computed(() => text('affichage_liste_appareils')),
  pairingMessage: computed(() => text('affichage_appairage')),
  messages: computed(() => {
    const v = attributeValue('messages_appairage');
    return Array.isArray(v) ? v : [];
  }),
};

car.mode = computed(() => (car.cruise.value ? 'cruise' : car.limiter.value ? 'limiter' : 'manual'));
car.connected = computed(() => car.vehicleConnected.value && car.phoneConnected.value);
car.step = computed(() =>
  pairingStep({
    phoneBluetooth: car.phoneBluetooth.value,
    connected: car.connected.value,
    message: car.pairingMessage.value,
    messages: car.messages.value,
  }),
);

const quiet = (promise) => promise.catch(() => {});

export const actions = {
  set: (attribute, value) => quiet(writeAttribute(attribute, value)),
  fire: (event, args = {}) => quiet(fireEvent(event, args)),
  contactOn: () => actions.set('cmd_contact', true),
  contactOff: () => actions.set('cmd_contact', false),
  // The starter only works with the contact on: turning the key from OFF goes through ON first.
  async start() {
    if (!car.contact.value) {
      await actions.contactOn();
      await new Promise((r) => setTimeout(r, 500));
    }
    return actions.fire('ev_demarrer');
  },
  async submitPin(pin) {
    await actions.set('champ_mdp', pin);
    return actions.fire('ev_jumeler');
  },
  forgetPhone: async () => {
    await actions.set('kit_jumele', false);
    return actions.set('bluetooth_telephone_actif', false);
  },
};
