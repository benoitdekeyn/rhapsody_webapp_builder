<script setup>
// Pedal: drag it down to press; it springs back on release unless "Maintenir" is ticked.
import { ref, computed } from 'vue';
import { car, actions } from '../core/car.js';

const props = defineProps({
  label: { type: String, required: true },
  kind: { type: String, default: 'accel' }, // 'accel' | 'brake'
});

const MAX = 10;
const TRACK = 120;
const PAD = 52;
const track = ref(null);
const dragging = ref(false);
const hold = ref(false);
const dragValue = ref(0);
let lastSent = 0;

const remote = computed(() => (props.kind === 'brake' ? car.brake.value : car.accel.value));
const shown = computed(() => remote.value);
const top = computed(() => (Math.min(MAX, Math.max(0, shown.value)) / MAX) * (TRACK - PAD));

function valueAt(e) {
  const r = track.value.getBoundingClientRect();
  const t = Math.min(1, Math.max(0, (e.clientY - r.top - PAD / 2) / (TRACK - PAD)));
  return Math.round(t * MAX * 100) / 100;
}
function send(v, force = false) {
  const now = performance.now();
  if (!force && now - lastSent < 50) return;
  lastSent = now;
  actions.set(props.kind === 'brake' ? 'brake' : 'accel', v);
}
function down(e) {
  if (!car.online.value) return;
  dragging.value = true;
  track.value.setPointerCapture(e.pointerId);
  dragValue.value = valueAt(e);
  send(dragValue.value, true);
}
function move(e) {
  if (!dragging.value) return;
  dragValue.value = valueAt(e);
  send(dragValue.value);
}
function up() {
  if (!dragging.value) return;
  dragging.value = false;
  send(hold.value ? dragValue.value : 0, true);
}
function toggleHold() {
  hold.value = !hold.value;
  if (!hold.value && !dragging.value) send(0, true);
}
</script>

<template>
  <div class="pedal" :class="[kind, { disabled: !car.online.value }]">
    <div ref="track" class="track" :style="{ height: TRACK + 'px' }" @pointerdown.prevent="down" @pointermove="move" @pointerup="up" @pointercancel="up">
      <div class="pad" :class="{ active: dragging }" :style="{ top: top + 'px', height: PAD + 'px' }">
        <i v-for="n in 6" :key="n"></i>
      </div>
    </div>
    <div class="value">{{ Math.round((shown / MAX) * 100) }}<small>%</small></div>
    <div class="label">{{ label }}</div>
    <label class="hold"><input type="checkbox" :checked="hold" @change="toggleHold" /> Maintenir</label>
  </div>
</template>

<style scoped>
.pedal { display: flex; flex-direction: column; align-items: center; gap: 4px; user-select: none; }
.pedal.disabled { opacity: 0.5; pointer-events: none; }
.track { position: relative; width: 70px; border-radius: 14px; background: linear-gradient(#0b0f16, #171e2b); border: 1px solid var(--border); box-shadow: inset 0 4px 14px #000a; touch-action: none; cursor: ns-resize; }
.pedal.brake .track { width: 96px; }
.pad { position: absolute; left: 6px; right: 6px; border-radius: 10px; background: linear-gradient(#4a5468, #2a3242); box-shadow: 0 6px 10px #000a, inset 0 1px 0 #fff3; display: flex; flex-direction: column; justify-content: space-evenly; padding: 6px 10px; box-sizing: border-box; }
.pedal.accel .pad { background: linear-gradient(#5a6476, #2c3444); }
.pedal.brake .pad { background: linear-gradient(#5a6476, #2c3444); }
.pad.active { box-shadow: 0 2px 4px #000a, inset 0 1px 0 #fff5; filter: brightness(1.15); }
.pad i { height: 5px; border-radius: 3px; background: #0006; box-shadow: 0 1px 0 #fff2; }
.value { font: 700 18px system-ui, sans-serif; font-variant-numeric: tabular-nums; }
.value small { font-size: 11px; opacity: 0.6; margin-left: 1px; }
.label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.6; }
.hold { font-size: 11px; opacity: 0.75; cursor: pointer; }
</style>
