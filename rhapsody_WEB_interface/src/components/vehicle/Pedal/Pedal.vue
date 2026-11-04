<script setup>
// Pedal: click / drag vertically to press it (top = released, bottom = fully pressed).
import { ref, computed } from 'vue';
import { bindingProps, useOptions, useAttribute, ratio, clamp } from '../../../core/binding.js';
import defaults from './defaults.json';

const props = defineProps({ ...bindingProps });
const o = useOptions(defaults, props);
const { value, writable, set } = useAttribute(props);

const pad = ref(null);
const dragging = ref(false);
const dragValue = ref(0);
let lastSent = 0;

const shown = computed(() => (dragging.value ? dragValue.value : typeof value.value === 'number' ? value.value : o.value.min));
const level = computed(() => ratio(shown.value, o.value.min, o.value.max));

function valueAt(event) {
  const r = pad.value.getBoundingClientRect();
  const t = clamp((event.clientY - r.top) / r.height, 0, 1);
  return o.value.min + t * (o.value.max - o.value.min);
}

function send(v, force = false) {
  const now = performance.now();
  if (!force && now - lastSent < o.value.sendIntervalMs) return;
  lastSent = now;
  set(Math.round(v * 100) / 100);
}

function down(e) {
  if (!writable.value) return;
  dragging.value = true;
  pad.value.setPointerCapture(e.pointerId);
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
  send(o.value.springBack ? o.value.min : dragValue.value, true);
}
</script>

<template>
  <div class="pedal" :style="{ color: o.colors.text }">
    <div
      ref="pad"
      class="pad"
      :class="{ ro: !writable, active: dragging }"
      :style="{ width: o.width + 'px', height: o.height + 'px', background: o.colors.pad }"
      @pointerdown.prevent="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
    >
      <div class="fill" :style="{ height: level * 100 + '%', background: o.colors.fill }"></div>
      <div class="ribs" :style="{ '--rib': o.colors.ribs }"></div>
    </div>
    <div class="value">{{ shown.toFixed(1) }}</div>
    <div class="label">{{ o.label }}</div>
  </div>
</template>

<style scoped>
.pedal { display: flex; flex-direction: column; align-items: center; gap: 6px; user-select: none; }
.pad { position: relative; border-radius: 14px; overflow: hidden; cursor: ns-resize; touch-action: none; box-shadow: inset 0 0 0 2px #0006, 0 4px 10px #0005; }
.pad.ro { cursor: default; }
.pad.active { box-shadow: inset 0 0 0 2px #fff4, 0 4px 10px #0005; }
.fill { position: absolute; left: 0; right: 0; top: 0; opacity: 0.85; }
.ribs { position: absolute; inset: 0; background: repeating-linear-gradient(to bottom, transparent 0 14px, var(--rib) 14px 18px); opacity: 0.8; pointer-events: none; }
.value { font-variant-numeric: tabular-nums; font-weight: 600; }
.label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.6; }
</style>
