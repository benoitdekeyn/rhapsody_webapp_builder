<script setup>
// Circular gauge (speedometer style) bound to a numeric attribute.
import { computed } from 'vue';
import { bindingProps, useOptions, useAttribute, ratio } from '../../../core/binding.js';
import defaults from './defaults.json';

const props = defineProps({ ...bindingProps });
const o = useOptions(defaults, props);
const { value } = useAttribute(props);

const cx = 100;
const cy = 100;
const polar = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
};
const arc = (r, a0, a1) => {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};

const angleOf = (v) => o.value.startAngle + ratio(v, o.value.min, o.value.max) * (o.value.endAngle - o.value.startAngle);
const current = computed(() => (typeof value.value === 'number' ? value.value : o.value.min));
const angle = computed(() => angleOf(current.value));
const color = computed(() => {
  const c = o.value.colors;
  if (o.value.dangerFrom != null && current.value >= o.value.dangerFrom) return c.danger;
  if (o.value.warnFrom != null && current.value >= o.value.warnFrom) return c.warn;
  return c.fill;
});
const ticks = computed(() => {
  const { min, max, majorStep, minorPerMajor } = o.value;
  const list = [];
  const step = majorStep / Math.max(1, minorPerMajor);
  for (let v = min; v <= max + 1e-9; v += step) {
    const major = Math.abs((v - min) / majorStep - Math.round((v - min) / majorStep)) < 1e-6;
    const a = angleOf(v);
    const [x0, y0] = polar(major ? 70 : 76, a);
    const [x1, y1] = polar(84, a);
    const [tx, ty] = polar(58, a);
    list.push({ v, major, x0, y0, x1, y1, tx, ty });
  }
  return list;
});
const text = computed(() => (typeof value.value === 'number' ? value.value.toFixed(o.value.decimals) : '–'));
const trackPath = computed(() => arc(88, o.value.startAngle, o.value.endAngle));
const fillPath = computed(() => (angle.value > o.value.startAngle + 0.1 ? arc(88, o.value.startAngle, angle.value) : ''));
</script>

<template>
  <div class="gauge" :style="{ width: o.size + 'px', color: o.colors.text }">
    <svg viewBox="0 0 200 200">
      <path :d="trackPath" fill="none" :stroke="o.colors.track" stroke-width="10" stroke-linecap="round" />
      <path v-if="fillPath" :d="fillPath" fill="none" :stroke="color" stroke-width="10" stroke-linecap="round" />
      <g v-for="t in ticks" :key="t.v">
        <line :x1="t.x0" :y1="t.y0" :x2="t.x1" :y2="t.y1" :stroke="o.colors.text" :stroke-width="t.major ? 1.6 : 0.7" opacity="0.7" />
        <text v-if="t.major" :x="t.tx" :y="t.ty" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="currentColor" opacity="0.85">{{ t.v }}</text>
      </g>
      <g class="needle" :style="{ transform: `rotate(${angle}deg)`, transformOrigin: '100px 100px' }">
        <polygon points="98,100 102,100 100,28" :fill="o.colors.needle" />
      </g>
      <circle cx="100" cy="100" r="7" fill="#1a2030" :stroke="o.colors.needle" stroke-width="2" />
      <text x="100" y="138" text-anchor="middle" font-size="26" font-weight="700" fill="currentColor">{{ text }}</text>
      <text x="100" y="152" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.7">{{ o.unit }}</text>
      <text x="100" y="170" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.5" letter-spacing="1">{{ o.label.toUpperCase() }}</text>
    </svg>
  </div>
</template>

<style scoped>
.gauge svg { width: 100%; display: block; }
.needle { transition: transform 0.25s ease-out; }
</style>
