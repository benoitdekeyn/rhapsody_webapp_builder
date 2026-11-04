<script setup>
// Digital readout (number with unit, or plain text).
import { computed } from 'vue';
import { bindingProps, useOptions, useAttribute } from '../../../core/binding.js';
import defaults from './defaults.json';

const props = defineProps({ ...bindingProps });
const o = useOptions(defaults, props);
const { value } = useAttribute(props);

const text = computed(() => {
  const v = value.value;
  if (v === undefined || v === null) return '–';
  return typeof v === 'number' ? v.toFixed(o.value.decimals) : String(v);
});
</script>

<template>
  <div class="display">
    <div class="label">{{ o.label }}</div>
    <div class="val" :style="{ color: o.color, fontSize: o.fontSize + 'px' }">{{ text }}<small v-if="o.unit"> {{ o.unit }}</small></div>
  </div>
</template>

<style scoped>
.display { background: #0b0f17; border: 1px solid #243047; border-radius: 8px; padding: 6px 12px; text-align: center; min-width: 90px; }
.label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.6; }
.val { font-family: Consolas, monospace; font-weight: 700; font-variant-numeric: tabular-nums; }
small { font-size: 0.5em; opacity: 0.7; }
</style>
