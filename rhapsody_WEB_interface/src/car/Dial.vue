<script setup>
// Analogue dial drawn in SVG: ticks, labels, coloured zone, needle with inertia.
import { computed } from 'vue';

const props = defineProps({
  value: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  start: { type: Number, default: 135 }, // angle of `min`, degrees clockwise from 3 o'clock
  sweep: { type: Number, default: 270 },
  major: { type: Number, default: 20 },
  minor: { type: Number, default: 10 },
  labelEvery: { type: Number, default: 1 }, // label one major tick out of N
  warnBelow: { type: Number, default: null },
  accent: { type: String, default: '#3ee0ff' },
  caption: { type: String, default: '' },
  unit: { type: String, default: '' },
  digits: { type: Number, default: 0 },
  marker: { type: Number, default: null },
  markerColor: { type: String, default: '#ffd24a' },
  markerTitle: { type: String, default: '' },
});

const C = 100;
const rad = (a) => (a * Math.PI) / 180;
const pt = (a, r) => [C + r * Math.cos(rad(a)), C + r * Math.sin(rad(a))];
const angleOf = (v) => props.start + props.sweep * Math.min(1, Math.max(0, (v - props.min) / (props.max - props.min)));
const arc = (a0, a1, r) => {
  const [x0, y0] = pt(a0, r);
  const [x1, y1] = pt(a1, r);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

const needle = computed(() => angleOf(props.value));
const low = computed(() => props.warnBelow !== null && props.value < props.warnBelow);
const color = computed(() => (low.value ? '#ff4d4d' : props.accent));
const ticks = computed(() => {
  const out = [];
  const count = Math.round((props.max - props.min) / props.minor);
  const perMajor = Math.max(1, Math.round(props.major / props.minor));
  for (let i = 0; i <= count; i++) {
    const v = props.min + i * props.minor;
    const isMajor = i % perMajor === 0;
    const a = angleOf(v);
    const [x0, y0] = pt(a, isMajor ? 80 : 85);
    const [x1, y1] = pt(a, 91);
    const label = isMajor && (i / perMajor) % props.labelEvery === 0 ? { text: Math.round(v), at: pt(a, 66) } : null;
    out.push({ i, isMajor, x0, y0, x1, y1, label, warn: props.warnBelow !== null && v < props.warnBelow });
  }
  return out;
});
const readout = computed(() => props.value.toFixed(props.digits));
const markerPoint = computed(() => props.marker === null ? null : pt(angleOf(props.marker), 88));
</script>

<template>
  <svg class="dial" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="dialface" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stop-color="#1b2433" />
        <stop offset="100%" stop-color="#0a0e15" />
      </radialGradient>
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <circle :cx="C" :cy="C" r="98" fill="url(#dialface)" stroke="#2c3850" stroke-width="3" />
    <path :d="arc(start, start + sweep, 95)" fill="none" stroke="#222c3d" stroke-width="4" stroke-linecap="round" />
    <path v-if="warnBelow !== null" :d="arc(start, angleOf(warnBelow), 95)" fill="none" stroke="#ff4d4d66" stroke-width="4" stroke-linecap="round" />
    <path :d="arc(start, Math.max(start + 0.01, needle), 95)" fill="none" :stroke="color" stroke-width="4" stroke-linecap="round" filter="url(#glow)" />
    <g v-if="markerPoint">
      <title>{{ markerTitle }}</title>
      <line :x1="C" :y1="C" :x2="markerPoint[0]" :y2="markerPoint[1]" :stroke="markerColor" stroke-width="1" stroke-opacity="0.7" stroke-linecap="round" />
    </g>
    <line v-for="t in ticks" :key="t.i" :x1="t.x0" :y1="t.y0" :x2="t.x1" :y2="t.y1" :stroke="t.warn ? '#ff4d4d' : '#9fb2cf'" :stroke-width="t.isMajor ? 2 : 1" />
    <text v-for="t in ticks.filter((x) => x.label)" :key="'l' + t.i" :x="t.label.at[0]" :y="t.label.at[1]" class="lbl" text-anchor="middle" dominant-baseline="central">{{ t.label.text }}</text>
    <g class="needle" :style="{ transform: `rotate(${needle}deg)` }">
      <polygon points="100,98 160,100 100,102" :fill="color" filter="url(#glow)" />
      <polygon points="100,97.5 86,100 100,102.5" fill="#556178" />
    </g>
    <circle :cx="C" :cy="C" r="8" fill="#0d121b" stroke="#3a4760" stroke-width="2" />
    <text v-if="unit" :x="C" y="150" class="read" text-anchor="middle">{{ readout }}</text>
    <text v-if="unit" :x="C" y="164" class="unit" text-anchor="middle">{{ unit }}</text>
    <text v-if="marker !== null" :x="C" y="184" class="marker-read" :fill="markerColor" text-anchor="middle">CONSIGNE</text>
    <text v-if="caption" :x="C" y="62" class="cap" text-anchor="middle">{{ caption }}</text>
  </svg>
</template>

<style scoped>
.dial { width: 100%; height: auto; display: block; }
.lbl { fill: #cfe0ff; font: 600 11px system-ui, sans-serif; }
.read { fill: #fff; font: 700 24px 'Segoe UI', system-ui, sans-serif; font-variant-numeric: tabular-nums; }
.unit { fill: #7f90ad; font: 10px system-ui, sans-serif; letter-spacing: 1px; }
.marker-read { font: 700 8px system-ui, sans-serif; letter-spacing: 0.5px; }
.cap { fill: #7f90ad; font: 600 10px system-ui, sans-serif; letter-spacing: 2px; text-transform: uppercase; }
.needle { transform-origin: 100px 100px; transition: transform 0.18s linear; }
</style>
