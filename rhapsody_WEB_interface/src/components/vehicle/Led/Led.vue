<script setup>
// Indicator light bound to a boolean attribute.
import { computed } from 'vue';
import { bindingProps, useOptions, useAttribute } from '../../../core/binding.js';
import defaults from './defaults.json';

const props = defineProps({ ...bindingProps });
const o = useOptions(defaults, props);
const { value } = useAttribute(props);

const on = computed(() => !!value.value !== !!o.value.invert && value.value !== undefined);
const color = computed(() => (on.value ? o.value.onColor : o.value.offColor));
</script>

<template>
  <div class="led">
    <span
      class="dot"
      :class="{ on, blink: on && o.blink }"
      :style="{ width: o.size + 'px', height: o.size + 'px', background: color, boxShadow: on ? `0 0 12px ${color}` : 'none' }"
    ></span>
    <span class="label">{{ o.label }}</span>
  </div>
</template>

<style scoped>
.led { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.dot { border-radius: 50%; display: block; transition: background 0.15s, box-shadow 0.15s; }
.blink { animation: blink 0.8s steps(2, jump-none) infinite; }
.label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.65; text-align: center; max-width: 80px; }
@keyframes blink { 50% { opacity: 0.25; } }
</style>
